import {
  openDB,
  STORES,
  withDB,
  runTransaction,
  runTransactionWithResult,
  storeGet,
  storeGetAll,
  storePut,
  storeDelete,
  indexGetAll,
  openCursor,
} from './offlineDB';

function withTimestamps(entity, isNew = false) {
  const now = new Date().toISOString();
  if (isNew) {
    return {
      ...entity,
      createdAt: entity.createdAt || now,
      updatedAt: now,
      version: (entity.version || 0) + 1,
    };
  }
  return {
    ...entity,
    updatedAt: now,
    version: (entity.version || 0) + 1,
  };
}

function generateId() {
  return 'local_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function createSimpleRepo(storeName, extra = {}) {
  return {
    async getAll() {
      return withDB(async (db) => {
        return runTransactionWithResult(db, [storeName], 'readonly', (stores, tx, setResult) => {
          storeGetAll(stores[storeName]).then(setResult);
        });
      });
    },

    async getById(id) {
      return withDB(async (db) => {
        return runTransactionWithResult(db, [storeName], 'readonly', (stores, tx, setResult) => {
          storeGet(stores[storeName], id).then(setResult);
        });
      });
    },

    async create(entity) {
      return withDB(async (db) => {
        const withData = withTimestamps({
          id: entity.id || generateId(),
          ...entity,
        }, true);
        await runTransaction(db, [storeName], 'readwrite', (stores) => {
          storePut(stores[storeName], withData);
        });
        return withData;
      });
    },

    async update(id, updates) {
      return withDB(async (db) => {
        return runTransactionWithResult(db, [storeName], 'readwrite', (stores, tx, setResult) => {
          storeGet(stores[storeName], id).then((existing) => {
            if (!existing) throw new Error(`${storeName} ${id} not found`);
            const merged = withTimestamps({ ...existing, ...updates, id }, false);
            storePut(stores[storeName], merged).then(() => setResult(merged));
          });
        });
      });
    },

    async upsert(entity) {
      return withDB(async (db) => {
        return runTransactionWithResult(db, [storeName], 'readwrite', (stores, tx, setResult) => {
          storeGet(stores[storeName], entity.id).then((existing) => {
            const withData = withTimestamps(entity, !existing);
            storePut(stores[storeName], withData).then(() => setResult(withData));
          });
        });
      });
    },

    async remove(id) {
      return withDB(async (db) => {
        await runTransaction(db, [storeName], 'readwrite', (stores) => {
          storeDelete(stores[storeName], id);
        });
      });
    },

    ...extra,
  };
}

export const RecordRepo = createSimpleRepo(STORES.RECORDS, {
  async getByCenter(centerId) {
    return withDB(async (db) => {
      return runTransactionWithResult(db, [STORES.RECORDS], 'readonly', (stores, tx, setResult) => {
        indexGetAll(stores[STORES.RECORDS], 'centerId', centerId).then(setResult);
      });
    });
  },

  async bulkUpsert(records) {
    return withDB(async (db) => {
      return runTransactionWithResult(db, [STORES.RECORDS], 'readwrite', (stores, tx, setResult) => {
        const store = stores[STORES.RECORDS];
        const results = [];
        let pending = records.length;
        if (pending === 0) { setResult([]); return; }
        records.forEach((rec) => {
          storeGet(store, rec.id).then((existing) => {
            const entity = withTimestamps(rec, !existing);
            storePut(store, entity).then(() => {
              results.push(entity);
              pending--;
              if (pending === 0) setResult(results);
            });
          });
        });
      });
    });
  },
});

export const DeviationRepo = createSimpleRepo(STORES.DEVIATIONS, {
  async getByCenter(centerId) {
    return withDB(async (db) => {
      return runTransactionWithResult(db, [STORES.DEVIATIONS], 'readonly', (stores, tx, setResult) => {
        indexGetAll(stores[STORES.DEVIATIONS], 'centerId', centerId).then(setResult);
      });
    });
  },
});

export const TemplateRepo = createSimpleRepo(STORES.TEMPLATES);
export const CenterRepo = createSimpleRepo(STORES.CENTERS);
export const VersionRepo = createSimpleRepo(STORES.VERSIONS);

export const AuditRepo = {
  async getAll() {
    return withDB(async (db) => {
      return runTransactionWithResult(db, [STORES.AUDITS], 'readonly', (stores, tx, setResult) => {
        const results = [];
        openCursor(stores[STORES.AUDITS], 'timestamp', null, 'prev', (cursor) => {
          results.push(cursor.value);
          return true;
        }).then(() => setResult(results));
      });
    });
  },

  async create(audit) {
    return withDB(async (db) => {
      const entity = {
        id: audit.id || generateId(),
        timestamp: audit.timestamp || new Date().toISOString(),
        ...audit,
      };
      await runTransaction(db, [STORES.AUDITS], 'readwrite', (stores) => {
        storePut(stores[STORES.AUDITS], entity);
      });
      return entity;
    });
  },

  async getByTarget(targetId) {
    return withDB(async (db) => {
      return runTransactionWithResult(db, [STORES.AUDITS], 'readonly', (stores, tx, setResult) => {
        indexGetAll(stores[STORES.AUDITS], 'target', targetId).then(setResult);
      });
    });
  },
};

export const SyncStateRepo = {
  async get(key) {
    return withDB(async (db) => {
      return runTransactionWithResult(db, [STORES.SYNC_STATE], 'readonly', (stores, tx, setResult) => {
        storeGet(stores[STORES.SYNC_STATE], key).then((row) => setResult(row ? row.value : undefined));
      });
    });
  },

  async set(key, value) {
    return withDB(async (db) => {
      await runTransaction(db, [STORES.SYNC_STATE], 'readwrite', (stores) => {
        storePut(stores[STORES.SYNC_STATE], { key, value, updatedAt: new Date().toISOString() });
      });
    });
  },

  async getAll() {
    return withDB(async (db) => {
      return runTransactionWithResult(db, [STORES.SYNC_STATE], 'readonly', (stores, tx, setResult) => {
        storeGetAll(stores[STORES.SYNC_STATE]).then(setResult);
      });
    });
  },
};

export const EntityMetadataRepo = {
  async get(entityType, entityId) {
    return withDB(async (db) => {
      return runTransactionWithResult(db, [STORES.ENTITY_METADATA], 'readonly', (stores, tx, setResult) => {
        storeGet(stores[STORES.ENTITY_METADATA], [entityType, entityId]).then(setResult);
      });
    });
  },

  async set(entityType, entityId, metadata) {
    return withDB(async (db) => {
      await runTransaction(db, [STORES.ENTITY_METADATA], 'readwrite', (stores) => {
        storePut(stores[STORES.ENTITY_METADATA], {
          entityType,
          entityId,
          ...metadata,
          updatedAt: new Date().toISOString(),
        });
      });
    });
  },

  async getAllByType(entityType) {
    return withDB(async (db) => {
      return runTransactionWithResult(db, [STORES.ENTITY_METADATA], 'readonly', (stores, tx, setResult) => {
        indexGetAll(stores[STORES.ENTITY_METADATA], 'entityType', entityType).then(setResult);
      });
    });
  },
};

export { generateId };
