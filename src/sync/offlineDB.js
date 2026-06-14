export const DB_NAME = 'hxwl-clinical-sync-db';
export const DB_VERSION = 1;

export const STORES = {
  RECORDS: 'records',
  DEVIATIONS: 'deviations',
  TEMPLATES: 'templates',
  CENTERS: 'centers',
  VERSIONS: 'versions',
  AUDITS: 'audits',
  OPERATION_LOG: 'operation_log',
  SYNC_STATE: 'sync_state',
  CONFLICTS: 'conflicts',
  ENTITY_METADATA: 'entity_metadata',
};

let dbInstance = null;

export function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORES.RECORDS)) {
        const store = db.createObjectStore(STORES.RECORDS, { keyPath: 'id' });
        store.createIndex('centerId', 'centerId', { unique: false });
        store.createIndex('subjectNo', 'subjectNo', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.DEVIATIONS)) {
        const store = db.createObjectStore(STORES.DEVIATIONS, { keyPath: 'id' });
        store.createIndex('centerId', 'centerId', { unique: false });
        store.createIndex('subjectNo', 'subjectNo', { unique: false });
        store.createIndex('sourceRecordId', 'sourceRecordId', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.TEMPLATES)) {
        const store = db.createObjectStore(STORES.TEMPLATES, { keyPath: 'id' });
        store.createIndex('centerId', 'centerId', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.CENTERS)) {
        const store = db.createObjectStore(STORES.CENTERS, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.VERSIONS)) {
        const store = db.createObjectStore(STORES.VERSIONS, { keyPath: 'id' });
        store.createIndex('templateId', 'templateId', { unique: false });
        store.createIndex('centerId', 'centerId', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.AUDITS)) {
        const store = db.createObjectStore(STORES.AUDITS, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('target', 'target', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.OPERATION_LOG)) {
        const store = db.createObjectStore(STORES.OPERATION_LOG, { keyPath: 'opId', autoIncrement: false });
        store.createIndex('entityType', 'entityType', { unique: false });
        store.createIndex('entityId', 'entityId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('syncPriority', 'syncPriority', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.SYNC_STATE)) {
        db.createObjectStore(STORES.SYNC_STATE, { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains(STORES.CONFLICTS)) {
        const store = db.createObjectStore(STORES.CONFLICTS, { keyPath: 'conflictId' });
        store.createIndex('entityType', 'entityType', { unique: false });
        store.createIndex('entityId', 'entityId', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('detectedAt', 'detectedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.ENTITY_METADATA)) {
        const store = db.createObjectStore(STORES.ENTITY_METADATA, { keyPath: ['entityType', 'entityId'] });
        store.createIndex('entityType', 'entityType', { unique: false });
        store.createIndex('entityId', 'entityId', { unique: false });
        store.createIndex('lastSyncedAt', 'lastSyncedAt', { unique: false });
      }
    };
  });
}

function wrapRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function withDB(callback) {
  return openDB().then(db => callback(db));
}

export function runTransaction(db, storeNames, mode, worker) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));

    try {
      const stores = {};
      for (const name of storeNames) {
        stores[name] = tx.objectStore(name);
      }
      const result = worker(stores, tx);
      if (result && typeof result.then === 'function') {
        result.catch(reject);
      }
    } catch (e) {
      reject(e);
    }
  });
}

export function runTransactionWithResult(db, storeNames, mode, worker) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    let finalResult;
    tx.oncomplete = () => resolve(finalResult);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));

    try {
      const stores = {};
      for (const name of storeNames) {
        stores[name] = tx.objectStore(name);
      }
      const result = worker(stores, tx, (val) => { finalResult = val; });
      if (result && typeof result.then === 'function') {
        result.catch(reject);
      }
    } catch (e) {
      reject(e);
    }
  });
}

export function storeGet(store, key) { return wrapRequest(store.get(key)); }
export function storeGetAll(store) { return wrapRequest(store.getAll()); }
export function storePut(store, value) { return wrapRequest(store.put(value)); }
export function storeDelete(store, key) { return wrapRequest(store.delete(key)); }
export function storeClear(store) { return wrapRequest(store.clear()); }
export function storeCount(store) { return wrapRequest(store.count()); }
export function indexGetAll(store, indexName, query = undefined) { return wrapRequest(store.index(indexName).getAll(query)); }
export function indexGetAllKeys(store, indexName, query = undefined) { return wrapRequest(store.index(indexName).getAllKeys(query)); }
export function indexCount(store, indexName, query = undefined) { return wrapRequest(store.index(indexName).count(query)); }

export function openCursor(store, indexName, query, direction, onEach) {
  return new Promise((resolve, reject) => {
    const source = indexName ? store.index(indexName) : store;
    const req = source.openCursor(query, direction);
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        const result = onEach(cursor);
        if (result === false) {
          resolve();
          return;
        }
        cursor.continue();
      } else {
        resolve();
      }
    };
    req.onerror = () => reject(req.error);
  });
}
