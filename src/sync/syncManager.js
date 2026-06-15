import { OPERATION_TYPES, OPERATION_STATUSES, CONFLICT_TYPES, SYNC_STATUSES, STORAGE_KEYS } from './types';

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function getClientId() {
  let clientId = localStorage.getItem(STORAGE_KEYS.CLIENT_ID);
  if (!clientId) {
    clientId = 'client-' + uid();
    localStorage.setItem(STORAGE_KEYS.CLIENT_ID, clientId);
  }
  return clientId;
}

function loadFromStorage(key, defaultValue) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load from storage:', key, e);
  }
  return defaultValue;
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('Failed to save to storage:', key, e);
    return false;
  }
}

export class SyncManager {
  constructor() {
    this.listeners = new Set();
    this.operationQueue = loadFromStorage(STORAGE_KEYS.OPERATION_QUEUE, []);
    this.conflicts = loadFromStorage(STORAGE_KEYS.CONFLICTS, []);
    this.entitySnapshots = loadFromStorage(STORAGE_KEYS.ENTITY_SNAPSHOTS, {});
    this.syncStatus = typeof navigator !== 'undefined' && navigator.onLine ? SYNC_STATUSES.ONLINE : SYNC_STATUSES.OFFLINE;
    this.lastSyncTime = loadFromStorage(STORAGE_KEYS.LAST_SYNC_TIME, null);
    this.clientId = getClientId();
    this.syncing = false;
    this.retryTimer = null;
    this._setupNetworkListeners();
  }

  _setupNetworkListeners() {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => {
      this._updateSyncStatus(SYNC_STATUSES.ONLINE);
      this.startSync();
    });
    window.addEventListener('offline', () => {
      this._updateSyncStatus(SYNC_STATUSES.OFFLINE);
      this._clearRetryTimer();
    });
  }

  _clearRetryTimer() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  _updateSyncStatus(status) {
    this.syncStatus = status;
    this._notifyListeners();
  }

  _notifyListeners() {
    const state = this.getState();
    this.listeners.forEach(fn => {
      try { fn(state); } catch (e) { console.error(e); }
    });
  }

  _persistQueue() {
    saveToStorage(STORAGE_KEYS.OPERATION_QUEUE, this.operationQueue);
  }

  _persistConflicts() {
    saveToStorage(STORAGE_KEYS.CONFLICTS, this.conflicts);
  }

  _persistSnapshots() {
    saveToStorage(STORAGE_KEYS.ENTITY_SNAPSHOTS, this.entitySnapshots);
  }

  _persistLastSync() {
    saveToStorage(STORAGE_KEYS.LAST_SYNC_TIME, this.lastSyncTime);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  getState() {
    return {
      syncStatus: this.syncStatus,
      pendingCount: this.operationQueue.filter(op => op.status === OPERATION_STATUSES.PENDING).length,
      failedCount: this.operationQueue.filter(op => op.status === OPERATION_STATUSES.FAILED).length,
      conflictCount: this.conflicts.length,
      lastSyncTime: this.lastSyncTime,
      operationQueue: [...this.operationQueue],
      conflicts: [...this.conflicts],
      clientId: this.clientId,
    };
  }

  takeSnapshot(entityType, entityId, entityData) {
    const key = `${entityType}:${entityId}`;
    this.entitySnapshots[key] = {
      entityType,
      entityId,
      data: JSON.parse(JSON.stringify(entityData)),
      timestamp: new Date().toISOString(),
      clientId: this.clientId,
    };
    this._persistSnapshots();
  }

  getSnapshot(entityType, entityId) {
    const key = `${entityType}:${entityId}`;
    return this.entitySnapshots[key] || null;
  }

  enqueueOperation(type, entityType, entityId, data, options = {}) {
    const operation = {
      id: uid(),
      type,
      entityType,
      entityId,
      data: JSON.parse(JSON.stringify(data)),
      beforeSnapshot: options.beforeSnapshot || this.getSnapshot(entityType, entityId)?.data || null,
      status: OPERATION_STATUSES.PENDING,
      createdAt: new Date().toISOString(),
      clientId: this.clientId,
      retryCount: 0,
      lastError: null,
      conflictInfo: null,
      order: this.operationQueue.length,
    };

    if (options.timelineEntry) {
      operation.timelineEntry = options.timelineEntry;
    }
    if (options.auditEntry) {
      operation.auditEntry = options.auditEntry;
    }

    this.operationQueue.push(operation);
    this._persistQueue();
    this._notifyListeners();

    if (this.syncStatus === SYNC_STATUSES.ONLINE) {
      this.startSync();
    }

    return operation;
  }

  async startSync() {
    if (this.syncing) return;
    if (this.syncStatus === SYNC_STATUSES.OFFLINE) return;

    const pendingOps = this.operationQueue.filter(
      op => op.status === OPERATION_STATUSES.PENDING || op.status === OPERATION_STATUSES.FAILED
    );
    if (pendingOps.length === 0) {
      this.lastSyncTime = new Date().toISOString();
      this._persistLastSync();
      this._notifyListeners();
      return;
    }

    this.syncing = true;
    this._updateSyncStatus(SYNC_STATUSES.SYNCING);

    pendingOps.sort((a, b) => a.order - b.order);

    for (const op of pendingOps) {
      await this._syncOneOperation(op);
    }

    this.syncing = false;
    const hasFailed = this.operationQueue.some(op => op.status === OPERATION_STATUSES.FAILED);
    const hasConflicts = this.conflicts.length > 0;

    if (hasConflicts) {
      this._updateSyncStatus(SYNC_STATUSES.ERROR);
    } else if (hasFailed) {
      this._updateSyncStatus(SYNC_STATUSES.ERROR);
      this._scheduleRetry();
    } else {
      this._updateSyncStatus(SYNC_STATUSES.ONLINE);
      this.lastSyncTime = new Date().toISOString();
      this._persistLastSync();
    }

    this._notifyListeners();
  }

  _scheduleRetry() {
    this._clearRetryTimer();
    const failedOps = this.operationQueue.filter(op => op.status === OPERATION_STATUSES.FAILED);
    if (failedOps.length === 0) return;

    const minRetry = Math.min(...failedOps.map(op => op.retryCount));
    const delay = Math.min(1000 * Math.pow(2, minRetry), 60000);

    this.retryTimer = setTimeout(() => {
      if (this.syncStatus !== SYNC_STATUSES.OFFLINE) {
        this.startSync();
      }
    }, delay);
  }

  async _syncOneOperation(operation) {
    operation.status = OPERATION_STATUSES.SYNCING;
    this._persistQueue();
    this._notifyListeners();

    try {
      const serverResult = await this._callServerAPI(operation);

      if (serverResult && serverResult.conflict) {
        this._handleConflict(operation, serverResult);
        return;
      }

      operation.status = OPERATION_STATUSES.SYNCED;
      operation.syncedAt = new Date().toISOString();
      operation.serverResponse = serverResult || null;

      if (serverResult && serverResult.entityVersion) {
        this.takeSnapshot(operation.entityType, operation.entityId, serverResult.entityData);
      }

      this._persistQueue();
    } catch (error) {
      operation.status = OPERATION_STATUSES.FAILED;
      operation.retryCount = (operation.retryCount || 0) + 1;
      operation.lastError = {
        message: error.message,
        timestamp: new Date().toISOString(),
      };
      this._persistQueue();
    }
  }

  async _callServerAPI(operation) {
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    const shouldSimulateConflict = Math.random() < 0.05;
    if (shouldSimulateConflict && operation.type === OPERATION_TYPES.UPDATE_RECORD) {
      return {
        conflict: true,
        conflictType: CONFLICT_TYPES.CONCURRENT_MODIFY,
        serverVersion: {
          ...operation.data,
          status: Math.random() > 0.5 ? '已完成' : '窗口内',
          updatedAt: new Date(Date.now() - 3600000).toISOString(),
          updatedBy: '另一位操作员',
        },
      };
    }

    return {
      success: true,
      entityVersion: operation.id,
      entityData: operation.data,
      syncedAt: new Date().toISOString(),
    };
  }

  _handleConflict(operation, serverResult) {
    operation.status = OPERATION_STATUSES.CONFLICT;
    operation.conflictInfo = {
      conflictType: serverResult.conflictType,
      serverVersion: serverResult.serverVersion,
      detectedAt: new Date().toISOString(),
    };

    const existingConflict = this.conflicts.find(c => c.operationId === operation.id);
    if (!existingConflict) {
      const conflict = {
        id: uid(),
        operationId: operation.id,
        type: operation.type,
        entityType: operation.entityType,
        entityId: operation.entityId,
        conflictType: serverResult.conflictType,
        localVersion: {
          data: operation.data,
          snapshot: operation.beforeSnapshot,
          updatedAt: operation.createdAt,
          clientId: this.clientId,
          timelineEntry: operation.timelineEntry || null,
        },
        serverVersion: serverResult.serverVersion,
        status: 'pending',
        detectedAt: new Date().toISOString(),
        resolvedAt: null,
        resolution: null,
      };
      this.conflicts.push(conflict);
      this._persistConflicts();
    }

    this._persistQueue();
  }

  resolveConflict(conflictId, resolution, customMergeData) {
    const conflict = this.conflicts.find(c => c.id === conflictId);
    if (!conflict) return false;

    const operation = this.operationQueue.find(op => op.id === conflict.operationId);
    if (!operation) return false;

    conflict.status = 'resolved';
    conflict.resolvedAt = new Date().toISOString();
    conflict.resolution = resolution;

    if (resolution === 'keep_local') {
      operation.status = OPERATION_STATUSES.PENDING;
      operation.conflictInfo = null;
      operation.retryCount = 0;
      operation.forced = true;
    } else if (resolution === 'keep_server') {
      operation.status = OPERATION_STATUSES.SYNCED;
      operation.syncedAt = new Date().toISOString();
      operation.serverResponse = { discarded: true };
      conflict.serverApplied = true;
    } else if (resolution === 'merge' && customMergeData) {
      operation.data = JSON.parse(JSON.stringify(customMergeData));
      operation.status = OPERATION_STATUSES.PENDING;
      operation.conflictInfo = null;
      operation.retryCount = 0;
      operation.merged = true;
      conflict.mergeResult = customMergeData;
    }

    this._persistConflicts();
    this._persistQueue();
    this._notifyListeners();

    if (resolution !== 'keep_server') {
      this.startSync();
    }

    return true;
  }

  retryOperation(operationId) {
    const operation = this.operationQueue.find(op => op.id === operationId);
    if (!operation) return false;

    operation.status = OPERATION_STATUSES.PENDING;
    operation.retryCount = 0;
    operation.lastError = null;
    this._persistQueue();
    this._notifyListeners();

    if (this.syncStatus !== SYNC_STATUSES.OFFLINE) {
      this.startSync();
    }
    return true;
  }

  retryAllFailed() {
    let changed = false;
    this.operationQueue.forEach(op => {
      if (op.status === OPERATION_STATUSES.FAILED) {
        op.status = OPERATION_STATUSES.PENDING;
        op.retryCount = 0;
        op.lastError = null;
        changed = true;
      }
    });
    if (changed) {
      this._persistQueue();
      this._notifyListeners();
      if (this.syncStatus !== SYNC_STATUSES.OFFLINE) {
        this.startSync();
      }
    }
    return changed;
  }

  clearSyncedOperations() {
    const beforeCount = this.operationQueue.length;
    this.operationQueue = this.operationQueue.filter(op => op.status !== OPERATION_STATUSES.SYNCED);
    if (this.operationQueue.length !== beforeCount) {
      this._persistQueue();
      this._notifyListeners();
    }
  }

  getOperationById(id) {
    return this.operationQueue.find(op => op.id === id);
  }

  getConflictById(id) {
    return this.conflicts.find(c => c.id === id);
  }

  getPendingOperationsForEntity(entityType, entityId) {
    return this.operationQueue.filter(
      op => op.entityType === entityType &&
            op.entityId === entityId &&
            (op.status === OPERATION_STATUSES.PENDING || op.status === OPERATION_STATUSES.SYNCING)
    );
  }

  getConflictsForEntity(entityType, entityId) {
    return this.conflicts.filter(
      c => c.entityType === entityType && c.entityId === entityId && c.status === 'pending'
    );
  }

  isEntityDirty(entityType, entityId) {
    return this.getPendingOperationsForEntity(entityType, entityId).length > 0;
  }

  hasConflict(entityType, entityId) {
    return this.getConflictsForEntity(entityType, entityId).length > 0;
  }

  getOperationDescription(op) {
    const typeLabels = {
      [OPERATION_TYPES.ADD_RECORD]: '新增访视记录',
      [OPERATION_TYPES.UPDATE_RECORD]: '更新访视记录',
      [OPERATION_TYPES.DELETE_RECORD]: '删除访视记录',
      [OPERATION_TYPES.UPDATE_RECORD_STATUS]: '更新访视状态',
      [OPERATION_TYPES.ADD_DEVIATION]: '新增偏差记录',
      [OPERATION_TYPES.UPDATE_DEVIATION]: '更新偏差记录',
      [OPERATION_TYPES.DELETE_DEVIATION]: '删除偏差记录',
      [OPERATION_TYPES.UPDATE_DEVIATION_STATUS]: '更新偏差状态',
      [OPERATION_TYPES.ADD_TEMPLATE]: '新增访视模板',
      [OPERATION_TYPES.UPDATE_TEMPLATE]: '更新访视模板',
      [OPERATION_TYPES.DELETE_TEMPLATE]: '删除访视模板',
      [OPERATION_TYPES.ADD_CENTER]: '新增研究中心',
      [OPERATION_TYPES.UPDATE_CENTER]: '更新研究中心',
      [OPERATION_TYPES.DELETE_CENTER]: '删除研究中心',
      [OPERATION_TYPES.PUBLISH_VERSION]: '发布方案版本',
      [OPERATION_TYPES.EXECUTE_MIGRATION]: '执行版本迁移',
      [OPERATION_TYPES.ROLLBACK_MIGRATION]: '回滚版本迁移',
    };
    return typeLabels[op.type] || op.type;
  }

  getConflictTypeLabel(type) {
    const labels = {
      [CONFLICT_TYPES.CONCURRENT_MODIFY]: '并发修改冲突',
      [CONFLICT_TYPES.DELETE_THEN_EDIT]: '删除后编辑冲突',
      [CONFLICT_TYPES.VERSION_CHANGED]: '方案版本已变更',
      [CONFLICT_TYPES.RECORD_NOT_FOUND]: '记录不存在',
      [CONFLICT_TYPES.PERMISSION_DENIED]: '权限不足',
    };
    return labels[type] || type;
  }

  computeFieldDiffs(localData, serverData) {
    const diffs = [];
    const allKeys = new Set([
      ...Object.keys(localData || {}),
      ...Object.keys(serverData || {}),
    ]);

    for (const key of allKeys) {
      if (key === 'timeline' || key === 'id' || key === 'createdAt' || key === 'updatedAt') continue;

      const localVal = localData?.[key];
      const serverVal = serverData?.[key];
      const localStr = JSON.stringify(localVal);
      const serverStr = JSON.stringify(serverVal);

      if (localStr !== serverStr) {
        diffs.push({
          field: key,
          localValue: localVal,
          serverValue: serverVal,
        });
      }
    }
    return diffs;
  }
}

export const syncManager = new SyncManager();
