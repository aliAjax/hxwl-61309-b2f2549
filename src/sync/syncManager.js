import { OperationLog, OPERATION_STATUS, OPERATION_TYPES, ENTITY_TYPES } from './operationLog';
import { ConflictDetector, ConflictRepo, CONFLICT_STATUS } from './conflictEngine';
import { SyncStateRepo, RecordRepo, DeviationRepo, TemplateRepo, CenterRepo, VersionRepo, AuditRepo, EntityMetadataRepo } from './repositories';
import { generateId } from './repositories';

const SERVER_STORAGE_PREFIX = 'hxwl_server_mock_';

export const SYNC_STATUS = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  CONFLICT: 'conflict',
  ERROR: 'error',
  OFFLINE: 'offline',
};

export class MockServerAPI {
  constructor() {
    this.entities = {
      [ENTITY_TYPES.RECORD]: this.loadFromStorage(ENTITY_TYPES.RECORD),
      [ENTITY_TYPES.DEVIATION]: this.loadFromStorage(ENTITY_TYPES.DEVIATION),
      [ENTITY_TYPES.TEMPLATE]: this.loadFromStorage(ENTITY_TYPES.TEMPLATE),
      [ENTITY_TYPES.CENTER]: this.loadFromStorage(ENTITY_TYPES.CENTER),
      [ENTITY_TYPES.VERSION]: this.loadFromStorage(ENTITY_TYPES.VERSION),
      [ENTITY_TYPES.AUDIT]: this.loadFromStorage(ENTITY_TYPES.AUDIT),
    };
    this.versions = this.loadFromStorage('versions_meta') || {};
  }

  loadFromStorage(key) {
    try {
      const raw = localStorage.getItem(SERVER_STORAGE_PREFIX + key);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  saveToStorage(key, data) {
    try {
      localStorage.setItem(SERVER_STORAGE_PREFIX + key, JSON.stringify(data));
    } catch (e) {
      console.warn('Mock server storage full', e);
    }
  }

  persist() {
    for (const [type, data] of Object.entries(this.entities)) {
      this.saveToStorage(type, data);
    }
    this.saveToStorage('versions_meta', this.versions);
  }

  getEntityVersion(entityType, entityId) {
    return this.versions[`${entityType}:${entityId}`] || 0;
  }

  setEntityVersion(entityType, entityId, version) {
    this.versions[`${entityType}:${entityId}`] = version;
  }

  async fetchEntity(entityType, entityId) {
    await this.simulateNetworkDelay();
    const entity = this.entities[entityType]?.[entityId];
    if (!entity) return { success: true, data: null, version: 0 };
    return {
      success: true,
      data: { ...entity },
      version: this.getEntityVersion(entityType, entityId),
    };
  }

  async fetchAll(entityType, sinceTimestamp = null) {
    await this.simulateNetworkDelay();
    const all = Object.values(this.entities[entityType] || {});
    if (sinceTimestamp) {
      const filtered = all.filter(e => new Date(e.updatedAt || e.createdAt) > new Date(sinceTimestamp));
      return { success: true, data: filtered, total: filtered.length };
    }
    return { success: true, data: all, total: all.length };
  }

  async applyOperation(operation) {
    await this.simulateNetworkDelay();

    const { entityType, entityId, operationType, data, baseVersion } = operation;
    const currentVersion = this.getEntityVersion(entityType, entityId);
    const existing = this.entities[entityType]?.[entityId];

    if (operationType === OPERATION_TYPES.CREATE) {
      if (existing) {
        return {
          success: false,
          error: 'ENTITY_EXISTS',
          conflict: true,
          existingEntity: { ...existing },
          existingVersion: currentVersion,
        };
      }
      const newEntity = {
        ...data,
        id: entityId,
        updatedAt: new Date().toISOString(),
        createdAt: data.createdAt || new Date().toISOString(),
        version: 1,
      };
      if (!this.entities[entityType]) this.entities[entityType] = {};
      this.entities[entityType][entityId] = newEntity;
      this.setEntityVersion(entityType, entityId, 1);
      this.persist();
      return { success: true, data: newEntity, version: 1 };
    }

    if (operationType === OPERATION_TYPES.UPDATE) {
      if (!existing) {
        return {
          success: false,
          error: 'ENTITY_NOT_FOUND',
          conflict: true,
        };
      }
      if (baseVersion && baseVersion < currentVersion) {
        return {
          success: false,
          error: 'VERSION_MISMATCH',
          conflict: true,
          existingEntity: { ...existing },
          existingVersion: currentVersion,
          baseVersion,
        };
      }
      const nextVersion = currentVersion + 1;
      const updated = {
        ...existing,
        ...data,
        id: entityId,
        updatedAt: new Date().toISOString(),
        version: nextVersion,
      };
      this.entities[entityType][entityId] = updated;
      this.setEntityVersion(entityType, entityId, nextVersion);
      this.persist();
      return { success: true, data: updated, version: nextVersion };
    }

    if (operationType === OPERATION_TYPES.DELETE) {
      if (!existing) {
        return { success: true, data: null, version: 0 };
      }
      if (baseVersion && baseVersion < currentVersion) {
        return {
          success: false,
          error: 'VERSION_MISMATCH_DELETE',
          conflict: true,
          existingEntity: { ...existing },
          existingVersion: currentVersion,
        };
      }
      delete this.entities[entityType][entityId];
      delete this.versions[`${entityType}:${entityId}`];
      this.persist();
      return { success: true, data: null, version: 0 };
    }

    return { success: false, error: 'UNKNOWN_OPERATION' };
  }

  async bulkFetchUpdates(entityTypes, sinceTimestamp) {
    await this.simulateNetworkDelay(200);
    const result = {};
    for (const type of entityTypes) {
      const res = await this.fetchAll(type, sinceTimestamp);
      result[type] = res.data || [];
    }
    return { success: true, data: result, timestamp: new Date().toISOString() };
  }

  simulateNetworkDelay(baseDelay = 80) {
    const jitter = Math.random() * 100;
    const shouldFail = Math.random() < 0.02;
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (shouldFail && !window.__SYNC_ALWAYS_SUCCEED__) {
          reject(new Error('Network error (simulated)'));
        } else {
          resolve();
        }
      }, baseDelay + jitter);
    });
  }

  reset() {
    for (const key of Object.keys(this.entities)) {
      this.entities[key] = {};
    }
    this.versions = {};
    this.persist();
  }

  seedFromLocal(records, deviations, templates, centers, versions) {
    if (records) {
      for (const r of records) {
        if (!this.entities[ENTITY_TYPES.RECORD][r.id]) {
          this.entities[ENTITY_TYPES.RECORD][r.id] = { ...r, version: 1 };
          this.setEntityVersion(ENTITY_TYPES.RECORD, r.id, 1);
        }
      }
    }
    if (deviations) {
      for (const d of deviations) {
        if (!this.entities[ENTITY_TYPES.DEVIATION][d.id]) {
          this.entities[ENTITY_TYPES.DEVIATION][d.id] = { ...d, version: 1 };
          this.setEntityVersion(ENTITY_TYPES.DEVIATION, d.id, 1);
        }
      }
    }
    if (templates) {
      for (const t of templates) {
        if (!this.entities[ENTITY_TYPES.TEMPLATE][t.id]) {
          this.entities[ENTITY_TYPES.TEMPLATE][t.id] = { ...t, version: 1 };
          this.setEntityVersion(ENTITY_TYPES.TEMPLATE, t.id, 1);
        }
      }
    }
    if (centers) {
      for (const c of centers) {
        if (!this.entities[ENTITY_TYPES.CENTER][c.id]) {
          this.entities[ENTITY_TYPES.CENTER][c.id] = { ...c, version: 1 };
          this.setEntityVersion(ENTITY_TYPES.CENTER, c.id, 1);
        }
      }
    }
    if (versions) {
      for (const v of versions) {
        if (!this.entities[ENTITY_TYPES.VERSION][v.id]) {
          this.entities[ENTITY_TYPES.VERSION][v.id] = { ...v, version: 1 };
          this.setEntityVersion(ENTITY_TYPES.VERSION, v.id, 1);
        }
      }
    }
    this.persist();
  }
}

export const serverAPI = new MockServerAPI();

export class SyncManager {
  constructor() {
    this.status = SYNC_STATUS.IDLE;
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this.lastSyncAt = null;
    this.listeners = new Map();
    this.retryTimer = null;
    this.syncing = false;
    this.setupNetworkListeners();
  }

  setupNetworkListeners() {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.emit('online', { timestamp: new Date().toISOString() });
      this.scheduleSync(1000);
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.status = SYNC_STATUS.OFFLINE;
      this.emit('offline', { timestamp: new Date().toISOString() });
    });
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event, data) {
    this.listeners.get(event)?.forEach(cb => {
      try { cb(data); } catch (e) { console.error('Sync listener error', e); }
    });
  }

  scheduleSync(delay = 2000) {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
    this.retryTimer = setTimeout(() => {
      this.syncAll().catch(e => console.error('Scheduled sync failed', e));
    }, delay);
  }

  async syncAll(options = {}) {
    if (!this.isOnline) {
      this.status = SYNC_STATUS.OFFLINE;
      return { success: false, error: 'offline' };
    }
    if (this.syncing && !options.force) {
      return { success: false, error: 'already_syncing' };
    }

    this.syncing = true;
    this.status = SYNC_STATUS.SYNCING;
    this.emit('syncStart', {});

    let syncedCount = 0;
    let conflictCount = 0;
    let failedCount = 0;
    const errors = [];

    try {
      const pushResult = await this.pushOperations();
      syncedCount += pushResult.synced;
      conflictCount += pushResult.conflicts;
      failedCount += pushResult.failed;
      errors.push(...pushResult.errors);

      const pullResult = await this.pullUpdates();
      syncedCount += pullResult.updated;

      this.lastSyncAt = new Date().toISOString();
      await SyncStateRepo.set('lastSyncAt', this.lastSyncAt);

      if (conflictCount > 0) {
        this.status = SYNC_STATUS.CONFLICT;
      } else if (failedCount > 0) {
        this.status = SYNC_STATUS.ERROR;
      } else {
        this.status = SYNC_STATUS.IDLE;
      }

      this.emit('syncComplete', {
        success: true,
        syncedCount,
        conflictCount,
        failedCount,
        errors,
        lastSyncAt: this.lastSyncAt,
      });

      return { success: true, syncedCount, conflictCount, failedCount, errors };

    } catch (err) {
      this.status = SYNC_STATUS.ERROR;
      this.emit('syncError', { error: err, timestamp: new Date().toISOString() });
      if (!options.noRetry) {
        this.scheduleSync(5000);
      }
      return { success: false, error: err.message, syncedCount, conflictCount, failedCount };
    } finally {
      this.syncing = false;
    }
  }

  async pushOperations() {
    const ops = await OperationLog.getPendingOperations(200);
    let synced = 0;
    let conflicts = 0;
    let failed = 0;
    const errors = [];

    for (const op of ops) {
      try {
        await OperationLog.updateStatus(op.opId, OPERATION_STATUS.IN_PROGRESS);
        const result = await serverAPI.applyOperation(op);

        if (result.success) {
          await OperationLog.markSynced(op.opId);
          await this.updateEntityMetadata(op.entityType, op.entityId, result.version, result.data);
          synced++;
          this.emit('operationSynced', { op, result });
        } else if (result.conflict) {
          const localEntity = op.operationType === OPERATION_TYPES.UPDATE
            ? { ...op.previousData, ...op.data }
            : op.data;

          const conflict = ConflictDetector.detectConflict({
            localOperation: op,
            remoteEntity: result.existingEntity,
            localEntity,
            serverVersion: result.existingVersion,
            entityType: op.entityType,
          });

          if (conflict) {
            await ConflictRepo.create(conflict);
            await OperationLog.markConflict(op.opId);
            conflicts++;
            this.emit('conflictDetected', { conflict, op });
          } else {
            await OperationLog.markFailed(op.opId, result.error || 'Unknown conflict');
            failed++;
            errors.push({ opId: op.opId, error: result.error });
          }
        } else {
          await OperationLog.markFailed(op.opId, result.error || 'Unknown error');
          failed++;
          errors.push({ opId: op.opId, error: result.error });
        }
      } catch (err) {
        await OperationLog.markFailed(op.opId, err.message);
        failed++;
        errors.push({ opId: op.opId, error: err.message });
      }
    }

    return { synced, conflicts, failed, errors };
  }

  async pullUpdates() {
    const lastSync = (await SyncStateRepo.get('lastSyncAt'))?.value || null;
    const entityTypes = [
      ENTITY_TYPES.RECORD,
      ENTITY_TYPES.DEVIATION,
      ENTITY_TYPES.TEMPLATE,
      ENTITY_TYPES.CENTER,
      ENTITY_TYPES.VERSION,
    ];

    const result = await serverAPI.bulkFetchUpdates(entityTypes, lastSync);
    let updated = 0;

    const repoMap = {
      [ENTITY_TYPES.RECORD]: RecordRepo,
      [ENTITY_TYPES.DEVIATION]: DeviationRepo,
      [ENTITY_TYPES.TEMPLATE]: TemplateRepo,
      [ENTITY_TYPES.CENTER]: CenterRepo,
      [ENTITY_TYPES.VERSION]: VersionRepo,
    };

    for (const [entityType, entities] of Object.entries(result.data || {})) {
      const repo = repoMap[entityType];
      if (!repo || !Array.isArray(entities)) continue;

      for (const remoteEntity of entities) {
        try {
          const metadata = await EntityMetadataRepo.get(entityType, remoteEntity.id);
          const localVersion = metadata?.serverVersion || 0;
          const remoteVersion = remoteEntity.version || 0;

          if (remoteVersion > localVersion) {
            const pendingOps = await OperationLog.getOperationsByEntity(entityType, remoteEntity.id);
            const hasPending = pendingOps.some(o =>
              o.status === OPERATION_STATUS.PENDING ||
              o.status === OPERATION_STATUS.IN_PROGRESS ||
              o.status === OPERATION_STATUS.FAILED ||
              o.status === OPERATION_STATUS.CONFLICT
            );

            if (hasPending) {
              const lastOp = pendingOps.find(o =>
                o.status === OPERATION_STATUS.PENDING ||
                o.status === OPERATION_STATUS.CONFLICT
              );
              if (lastOp) {
                const existing = await repo.getById(remoteEntity.id);
                const localEntity = existing || (lastOp.data ? { ...lastOp.data, id: remoteEntity.id } : null);
                const conflict = ConflictDetector.detectConflict({
                  localOperation: lastOp,
                  remoteEntity,
                  localEntity,
                  serverVersion: remoteVersion,
                  entityType,
                });
                if (conflict) {
                  await ConflictRepo.create(conflict);
                  await OperationLog.markConflict(lastOp.opId);
                  continue;
                }
              }
            }

            await repo.upsert(remoteEntity);
            await EntityMetadataRepo.set(entityType, remoteEntity.id, {
              serverVersion: remoteVersion,
              lastSyncedAt: new Date().toISOString(),
              lastSyncSource: 'pull',
            });
            updated++;
            this.emit('entityPulled', { entityType, entity: remoteEntity });
          }
        } catch (err) {
          console.error(`Failed to pull ${entityType} ${remoteEntity.id}`, err);
        }
      }
    }

    return { updated };
  }

  async updateEntityMetadata(entityType, entityId, serverVersion, entity) {
    await EntityMetadataRepo.set(entityType, entityId, {
      serverVersion: serverVersion || 1,
      lastSyncedAt: new Date().toISOString(),
      lastSyncSource: 'push',
    });
  }

  async retryFailedOps() {
    const failed = await OperationLog.getFailedOperations();
    for (const op of failed) {
      if ((op.retryCount || 0) < 5) {
        await OperationLog.updateStatus(op.opId, OPERATION_STATUS.PENDING);
      }
    }
    return this.syncAll({ force: true });
  }

  async getSyncStats() {
    const opStats = await OperationLog.getStats();
    const openConflicts = await ConflictRepo.getOpenCount();
    const lastSync = (await SyncStateRepo.get('lastSyncAt'))?.value;
    return {
      status: this.status,
      isOnline: this.isOnline,
      lastSyncAt: lastSync,
      pendingOperations: opStats.pending,
      failedOperations: opStats.failed,
      conflictOperations: opStats.conflict,
      openConflicts,
      totalOperations: opStats.total,
    };
  }

  goOffline() {
    this.isOnline = false;
    this.status = SYNC_STATUS.OFFLINE;
    this.emit('offline', { timestamp: new Date().toISOString() });
  }

  goOnline() {
    this.isOnline = true;
    this.emit('online', { timestamp: new Date().toISOString() });
    this.scheduleSync(500);
  }
}

export const syncManager = new SyncManager();

export function useSyncManager() {
  return syncManager;
}
