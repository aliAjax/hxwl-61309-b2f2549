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
  indexCount,
} from './offlineDB';
import { generateId } from './repositories';

export const OPERATION_TYPES = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
};

export const OPERATION_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  SYNCED: 'synced',
  FAILED: 'failed',
  CONFLICT: 'conflict',
  CANCELLED: 'cancelled',
};

export const ENTITY_TYPES = {
  RECORD: 'record',
  DEVIATION: 'deviation',
  TEMPLATE: 'template',
  CENTER: 'center',
  VERSION: 'version',
  AUDIT: 'audit',
};

export const SYNC_PRIORITY = {
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

function generateOpId() {
  return 'op_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export const OperationLog = {
  async logOperation({ entityType, entityId, operationType, data, previousData, metadata = {}, priority = SYNC_PRIORITY.NORMAL, operator = '操作员' }) {
    return withDB(async (db) => {
      const opId = metadata.opId || generateOpId();
      const operation = {
        opId,
        entityType,
        entityId,
        operationType,
        data,
        previousData,
        status: OPERATION_STATUS.PENDING,
        timestamp: new Date().toISOString(),
        retryCount: 0,
        lastError: null,
        syncedAt: null,
        operator,
        syncPriority: priority,
        clientId: metadata.clientId || 'local-client',
        baseVersion: metadata.baseVersion || null,
        ...metadata,
      };

      const auditEntry = {
        id: generateId(),
        timestamp: operation.timestamp,
        action: `op_${operationType}`,
        target: entityId,
        entityType,
        opId,
        detail: `[操作日志] ${entityType}.${operationType} id=${entityId}`,
        operator,
        data: data ? Object.keys(data).join(',') : null,
      };

      await runTransaction(db, [STORES.OPERATION_LOG, STORES.AUDITS], 'readwrite', (stores) => {
        storePut(stores[STORES.OPERATION_LOG], operation);
        storePut(stores[STORES.AUDITS], auditEntry);
      });

      return operation;
    });
  },

  async createEntity(entityType, entity, operator = '操作员') {
    return this.logOperation({
      entityType,
      entityId: entity.id,
      operationType: OPERATION_TYPES.CREATE,
      data: entity,
      previousData: null,
      operator,
      priority: entity._syncPriority || SYNC_PRIORITY.NORMAL,
      metadata: entity._opMetadata || {},
    });
  },

  async updateEntity(entityType, entityId, updates, previousData, operator = '操作员') {
    return this.logOperation({
      entityType,
      entityId,
      operationType: OPERATION_TYPES.UPDATE,
      data: updates,
      previousData,
      operator,
      priority: updates._syncPriority || SYNC_PRIORITY.NORMAL,
      metadata: updates._opMetadata || {},
    });
  },

  async deleteEntity(entityType, entityId, previousData, operator = '操作员') {
    return this.logOperation({
      entityType,
      entityId,
      operationType: OPERATION_TYPES.DELETE,
      data: null,
      previousData,
      operator,
      priority: SYNC_PRIORITY.HIGH,
    });
  },

  async getPendingOperations(limit = 100) {
    return withDB(async (db) => {
      return runTransactionWithResult(db, [STORES.OPERATION_LOG], 'readonly', (stores, tx, setResult) => {
        const store = stores[STORES.OPERATION_LOG];
        const results = [];

        const collectNormal = () => {
          if (results.length >= limit) {
            finalize();
            return;
          }
          openCursor(store, 'syncPriority', IDBKeyRange.lowerBound(SYNC_PRIORITY.NORMAL), 'next', (cursor) => {
            if ((cursor.value.status === OPERATION_STATUS.PENDING || cursor.value.status === OPERATION_STATUS.FAILED)
                && !results.find(r => r.opId === cursor.value.opId)) {
              if (results.length < limit) {
                results.push(cursor.value);
                return true;
              }
              return false;
            }
            return true;
          }).then(finalize);
        };

        const finalize = () => {
          results.sort((a, b) => {
            const prio = (a.syncPriority || SYNC_PRIORITY.NORMAL) - (b.syncPriority || SYNC_PRIORITY.NORMAL);
            if (prio !== 0) return prio;
            return new Date(a.timestamp) - new Date(b.timestamp);
          });
          setResult(results);
        };

        openCursor(store, 'syncPriority', IDBKeyRange.only(SYNC_PRIORITY.HIGH), 'next', (cursor) => {
          if (cursor.value.status === OPERATION_STATUS.PENDING || cursor.value.status === OPERATION_STATUS.FAILED) {
            if (results.length < limit) {
              results.push(cursor.value);
              return true;
            }
            return false;
          }
          return true;
        }).then(collectNormal);
      });
    });
  },

  async getOperation(opId) {
    return withDB(async (db) => {
      return runTransactionWithResult(db, [STORES.OPERATION_LOG], 'readonly', (stores, tx, setResult) => {
        storeGet(stores[STORES.OPERATION_LOG], opId).then(setResult);
      });
    });
  },

  async updateStatus(opId, status, error = null) {
    return withDB(async (db) => {
      return runTransactionWithResult(db, [STORES.OPERATION_LOG], 'readwrite', (stores, tx, setResult) => {
        const store = stores[STORES.OPERATION_LOG];
        storeGet(store, opId).then((existing) => {
          if (!existing) throw new Error(`Operation ${opId} not found`);

          const updates = {
            ...existing,
            status,
            lastError: error ? String(error) : null,
          };

          if (status === OPERATION_STATUS.SYNCED) {
            updates.syncedAt = new Date().toISOString();
          }
          if (status === OPERATION_STATUS.FAILED) {
            updates.retryCount = (existing.retryCount || 0) + 1;
          }

          storePut(store, updates).then(() => setResult(updates));
        });
      });
    });
  },

  async markSynced(opId) {
    return this.updateStatus(opId, OPERATION_STATUS.SYNCED);
  },

  async markFailed(opId, error) {
    return this.updateStatus(opId, OPERATION_STATUS.FAILED, error);
  },

  async markConflict(opId) {
    return this.updateStatus(opId, OPERATION_STATUS.CONFLICT);
  },

  async markCancelled(opId) {
    return this.updateStatus(opId, OPERATION_STATUS.CANCELLED);
  },

  async removeSyncedOperations(beforeDate = null) {
    return withDB(async (db) => {
      return runTransactionWithResult(db, [STORES.OPERATION_LOG], 'readwrite', (stores, tx, setResult) => {
        const store = stores[STORES.OPERATION_LOG];
        const cutoffDate = beforeDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        let count = 0;

        openCursor(store, null, null, 'next', (cursor) => {
          const op = cursor.value;
          if (op.status === OPERATION_STATUS.SYNCED && op.syncedAt && op.syncedAt < cutoffDate) {
            cursor.delete();
            count++;
          }
          return true;
        }).then(() => setResult(count));
      });
    });
  },

  async getOperationsByEntity(entityType, entityId) {
    return withDB(async (db) => {
      return runTransactionWithResult(db, [STORES.OPERATION_LOG], 'readonly', (stores, tx, setResult) => {
        const store = stores[STORES.OPERATION_LOG];
        const results = [];

        openCursor(store, 'entityId', IDBKeyRange.only(entityId), 'prev', (cursor) => {
          if (cursor.value.entityType === entityType) {
            results.push(cursor.value);
          }
          return true;
        }).then(() => setResult(results));
      });
    });
  },

  async getFailedOperations() {
    return withDB(async (db) => {
      return runTransactionWithResult(db, [STORES.OPERATION_LOG], 'readonly', (stores, tx, setResult) => {
        const store = stores[STORES.OPERATION_LOG];
        const results = [];

        openCursor(store, 'status', IDBKeyRange.only(OPERATION_STATUS.FAILED), 'prev', (cursor) => {
          results.push(cursor.value);
          return true;
        }).then(() => setResult(results));
      });
    });
  },

  async getConflictOperations() {
    return withDB(async (db) => {
      return runTransactionWithResult(db, [STORES.OPERATION_LOG], 'readonly', (stores, tx, setResult) => {
        const store = stores[STORES.OPERATION_LOG];
        const results = [];

        openCursor(store, 'status', IDBKeyRange.only(OPERATION_STATUS.CONFLICT), 'prev', (cursor) => {
          results.push(cursor.value);
          return true;
        }).then(() => setResult(results));
      });
    });
  },

  async getStats() {
    return withDB(async (db) => {
      return runTransactionWithResult(db, [STORES.OPERATION_LOG], 'readonly', (stores, tx, setResult) => {
        const store = stores[STORES.OPERATION_LOG];

        Promise.all([
          indexCount(store, 'status', OPERATION_STATUS.PENDING),
          indexCount(store, 'status', OPERATION_STATUS.FAILED),
          indexCount(store, 'status', OPERATION_STATUS.CONFLICT),
          storeGetAll(store).then(a => a.length),
        ]).then(([pending, failed, conflict, total]) => {
          setResult({ pending, failed, conflict, total });
        });
      });
    });
  },

  async getAll() {
    return withDB(async (db) => {
      return runTransactionWithResult(db, [STORES.OPERATION_LOG], 'readonly', (stores, tx, setResult) => {
        const store = stores[STORES.OPERATION_LOG];
        const results = [];

        openCursor(store, 'timestamp', null, 'prev', (cursor) => {
          results.push(cursor.value);
          return true;
        }).then(() => setResult(results));
      });
    });
  },

  async replayOperations(operations, applyFn) {
    const results = [];
    for (const op of operations) {
      try {
        const result = await applyFn(op);
        results.push({ op, success: true, result });
      } catch (err) {
        results.push({ op, success: false, error: err });
      }
    }
    return results;
  },

  async getOperationTimeline(entityType, entityId) {
    const ops = await this.getOperationsByEntity(entityType, entityId);
    return ops.map(op => ({
      opId: op.opId,
      type: op.operationType,
      timestamp: op.timestamp,
      operator: op.operator,
      status: op.status,
      data: op.data,
      previousData: op.previousData,
    }));
  },
};

export function diffEntities(oldEntity, newEntity, ignoreFields = ['updatedAt', 'version', 'createdAt', '_syncPriority', '_opMetadata']) {
  const changes = {};
  const allKeys = new Set([...Object.keys(oldEntity || {}), ...Object.keys(newEntity || {})]);

  for (const key of allKeys) {
    if (ignoreFields.includes(key)) continue;
    const oldVal = oldEntity?.[key];
    const newVal = newEntity?.[key];
    const oldJson = JSON.stringify(oldVal);
    const newJson = JSON.stringify(newVal);
    if (oldJson !== newJson) {
      changes[key] = { old: oldVal, new: newVal };
    }
  }

  return changes;
}

export function applyOperationToEntity(entity, operation) {
  if (!entity && operation.operationType === OPERATION_TYPES.CREATE) {
    return { ...operation.data };
  }

  if (operation.operationType === OPERATION_TYPES.DELETE) {
    return null;
  }

  if (operation.operationType === OPERATION_TYPES.UPDATE) {
    return { ...entity, ...operation.data };
  }

  return entity;
}
