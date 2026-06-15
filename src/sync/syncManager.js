import { OPERATION_TYPES, OPERATION_STATUSES, CONFLICT_TYPES, SYNC_STATUSES, STORAGE_KEYS } from './types';
import { serverMock } from './serverMock';

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

const CLIENT_AUDIT_KEY = 'hxwl-61309-client-audit';

function loadClientAuditLog() {
  return loadFromStorage(CLIENT_AUDIT_KEY, []);
}

function saveClientAuditLog(log) {
  if (log.length > 10000) {
    log = log.slice(-5000);
  }
  saveToStorage(CLIENT_AUDIT_KEY, log);
}

export class SyncManager {
  constructor() {
    this.listeners = new Set();
    this.operationQueue = loadFromStorage(STORAGE_KEYS.OPERATION_QUEUE, []);
    this.conflicts = loadFromStorage(STORAGE_KEYS.CONFLICTS, []);
    this.entitySnapshots = loadFromStorage(STORAGE_KEYS.ENTITY_SNAPSHOTS, {});
    this.clientAuditLog = loadClientAuditLog();
    this.syncStatus = typeof navigator !== 'undefined' && navigator.onLine ? SYNC_STATUSES.ONLINE : SYNC_STATUSES.OFFLINE;
    this.lastSyncTime = loadFromStorage(STORAGE_KEYS.LAST_SYNC_TIME, null);
    this.lastPullTime = loadFromStorage('hxwl-61309-last-pull', null);
    this.clientId = getClientId();
    this.syncing = false;
    this.retryTimer = null;
    this._setupNetworkListeners();
  }

  _setupNetworkListeners() {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => {
      this._updateSyncStatus(SYNC_STATUSES.ONLINE);
      this._addClientAuditEntry({
        action: '网络恢复',
        detail: '检测到网络连接恢复，开始自动同步',
      });
      this.startSync();
    });
    window.addEventListener('offline', () => {
      this._updateSyncStatus(SYNC_STATUSES.OFFLINE);
      this._clearRetryTimer();
      this._addClientAuditEntry({
        action: '网络断开',
        detail: '检测到网络连接断开，切换到离线模式',
      });
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

  _persistClientAudit() {
    saveClientAuditLog(this.clientAuditLog);
  }

  _addClientAuditEntry(entry) {
    const fullEntry = {
      id: uid(),
      timestamp: new Date().toISOString(),
      clientId: this.clientId,
      ...entry,
    };
    this.clientAuditLog.push(fullEntry);
    this._persistClientAudit();
    return fullEntry;
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
      clientAuditLog: [...this.clientAuditLog],
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
      version: entityData?._version ?? null,
    };
    this._persistSnapshots();
  }

  getSnapshot(entityType, entityId) {
    const key = `${entityType}:${entityId}`;
    return this.entitySnapshots[key] || null;
  }

  getEntityVersion(entityType, entityId) {
    const snapshot = this.getSnapshot(entityType, entityId);
    return snapshot?.data?._version ?? snapshot?.version ?? null;
  }

  enqueueOperation(type, entityType, entityId, data, options = {}) {
    const beforeSnapshot = options.beforeSnapshot || this.getSnapshot(entityType, entityId)?.data || null;

    const operation = {
      id: uid(),
      type,
      entityType,
      entityId,
      data: JSON.parse(JSON.stringify(data)),
      beforeSnapshot: beforeSnapshot ? JSON.parse(JSON.stringify(beforeSnapshot)) : null,
      baseVersion: beforeSnapshot?._version ?? data?._version ?? null,
      status: OPERATION_STATUSES.PENDING,
      createdAt: new Date().toISOString(),
      clientId: this.clientId,
      retryCount: 0,
      lastError: null,
      conflictInfo: null,
      order: this.operationQueue.length,
      forced: options.forced || false,
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

    this._addClientAuditEntry({
      action: '操作入队',
      operationId: operation.id,
      operationType: type,
      entityType,
      entityId,
      baseVersion: operation.baseVersion,
      detail: `${this.getOperationDescription(operation)}`,
    });

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

    this._addClientAuditEntry({
      action: '开始同步',
      detail: `开始同步 ${pendingOps.length} 个待处理操作`,
    });

    for (const op of pendingOps) {
      await this._syncOneOperation(op);
    }

    this.syncing = false;
    const hasFailed = this.operationQueue.some(op => op.status === OPERATION_STATUSES.FAILED);
    const hasConflicts = this.conflicts.length > 0;

    if (hasConflicts) {
      this._updateSyncStatus(SYNC_STATUSES.ERROR);
      this._addClientAuditEntry({
        action: '同步完成（存在冲突',
        detail: `同步完成，但存在 ${this.conflicts.length} 个冲突需要人工处理`,
      });
    } else if (hasFailed) {
      this._updateSyncStatus(SYNC_STATUSES.ERROR);
      this._addClientAuditEntry({
        action: '同步完成（存在失败',
        detail: `同步完成，存在失败操作，已安排自动重试`,
      });
      this._scheduleRetry();
    } else {
      this._updateSyncStatus(SYNC_STATUSES.ONLINE);
      this.lastSyncTime = new Date().toISOString();
      this._persistLastSync();
      this._addClientAuditEntry({
        action: '同步完成（成功',
        detail: '所有操作同步成功',
      });
    }

    this._notifyListeners();
  }

  _scheduleRetry() {
    this._clearRetryTimer();
    const failedOps = this.operationQueue.filter(op => op.status === OPERATION_STATUSES.FAILED);
    if (failedOps.length === 0) return;

    const minRetry = Math.min(...failedOps.map(op => op.retryCount));
    const delay = Math.min(1000 * Math.pow(2, minRetry), 60000);

    this._addClientAuditEntry({
      action: '安排自动重试',
      detail: `${Math.round(delay / 1000)} 秒后重试 ${failedOps.length} 个失败操作`,
    });

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

    this._addClientAuditEntry({
      action: '开始同步单个操作',
      operationId: operation.id,
      operationType: operation.type,
      entityType: operation.entityType,
      entityId: operation.entityId,
      baseVersion: operation.baseVersion,
    });

    try {
      const serverResult = await serverMock.executeOperation(operation);

      if (serverResult && serverResult.conflict) {
        this._handleConflict(operation, serverResult);
        return;
      }

      operation.status = OPERATION_STATUSES.SYNCED;
      operation.syncedAt = new Date().toISOString();
      operation.serverResponse = serverResult || null;

      if (serverResult && serverResult.entityData) {
        this.takeSnapshot(operation.entityType, operation.entityId, serverResult.entityData);
      } else if (operation.type.includes('DELETE') || operation.type.includes('delete')) {
        this._removeSnapshot(operation.entityType, operation.entityId);
      }

      this._persistQueue();

      this._addClientAuditEntry({
        action: '操作同步成功',
        operationId: operation.id,
        entityVersion: serverResult?.entityVersion,
        fieldChangeCount: serverResult?.fieldChanges?.length || 0,
      });

    } catch (error) {
      operation.status = OPERATION_STATUSES.FAILED;
      operation.retryCount = (operation.retryCount || 0) + 1;
      operation.lastError = {
        message: error.message,
        timestamp: new Date().toISOString(),
      };
      this._persistQueue();

      this._addClientAuditEntry({
        action: '操作同步失败',
        operationId: operation.id,
        errorMessage: error.message,
        retryCount: operation.retryCount,
      });
    }
  }

  _removeSnapshot(entityType, entityId) {
    const key = `${entityType}:${entityId}`;
    delete this.entitySnapshots[key];
    this._persistSnapshots();
  }

  _handleConflict(operation, serverResult) {
    operation.status = OPERATION_STATUSES.CONFLICT;
    operation.conflictInfo = {
      conflictType: serverResult.conflictType,
      conflictReason: serverResult.conflictReason,
      serverVersionData: serverResult.serverVersionData || null,
      serverVersionNumber: serverResult.serverVersion || null,
      baseVersion: serverResult.baseVersion,
      conflictFields: serverResult.conflictFields || null,
      modifiedFields: serverResult.modifiedFields || null,
      deletedSnapshot: serverResult.deletedSnapshot || null,
      localEdit: serverResult.localEdit || null,
      detectedAt: new Date().toISOString(),
    };

    const existingConflict = this.conflicts.find(c => c.operationId === operation.id);
    if (!existingConflict) {
      const isDeleteThenEdit = serverResult.conflictType === CONFLICT_TYPES.DELETE_THEN_EDIT;
      const conflict = {
        id: uid(),
        operationId: operation.id,
        type: operation.type,
        entityType: operation.entityType,
        entityId: operation.entityId,
        conflictType: serverResult.conflictType,
        conflictReason: serverResult.conflictReason,
        localVersion: {
          data: isDeleteThenEdit ? (serverResult.localEdit || operation.data) : operation.data,
          snapshot: isDeleteThenEdit ? (serverResult.deletedSnapshot || operation.beforeSnapshot) : operation.beforeSnapshot,
          baseVersion: serverResult.baseVersion || operation.baseVersion,
          updatedAt: operation.createdAt,
          clientId: this.clientId,
          timelineEntry: operation.timelineEntry || null,
        },
        serverVersion: serverResult.serverVersionData || null,
        serverVersionNumber: serverResult.serverVersion || null,
        conflictFields: serverResult.conflictFields || [],
        modifiedFields: serverResult.modifiedFields || [],
        deletedSnapshot: serverResult.deletedSnapshot || null,
        localEdit: serverResult.localEdit || null,
        status: 'pending',
        detectedAt: new Date().toISOString(),
        resolvedAt: null,
        resolution: null,
      };
      this.conflicts.push(conflict);
      this._persistConflicts();

      this._addClientAuditEntry({
        action: '检测到数据冲突',
        operationId: operation.id,
        conflictId: conflict.id,
        conflictType: serverResult.conflictType,
        conflictReason: serverResult.conflictReason,
      });
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

    const isDeleteThenEdit = conflict.conflictType === CONFLICT_TYPES.DELETE_THEN_EDIT;
    const serverVersionData = conflict.serverVersion;
    const serverVersion = serverVersionData?._version ?? conflict.serverVersionNumber;

    if (resolution === 'keep_local') {
      operation.status = OPERATION_STATUSES.PENDING;
      operation.conflictInfo = null;
      operation.retryCount = 0;
      operation.forced = true;
      if (isDeleteThenEdit) {
        operation.forceRestore = true;
        delete operation.data._version;
        conflict.resolutionDetail = 'forceRestore';
      } else if (serverVersion) {
        operation.data._version = serverVersion;
      }
    } else if (resolution === 'keep_server') {
      operation.status = OPERATION_STATUSES.SYNCED;
      operation.syncedAt = new Date().toISOString();
      operation.serverResponse = { discarded: true, resolution: 'keep_server' };
      conflict.serverApplied = true;
      if (serverVersionData) {
        this.takeSnapshot(operation.entityType, operation.entityId, serverVersionData);
      }
      if (isDeleteThenEdit) {
        conflict.resolutionDetail = 'acceptDelete';
        operation.serverResponse.acceptedDelete = true;
        this._removeSnapshot(operation.entityType, operation.entityId);
      }
    } else if (resolution === 'merge' && customMergeData) {
      operation.data = JSON.parse(JSON.stringify(customMergeData));
      operation.status = OPERATION_STATUSES.PENDING;
      operation.conflictInfo = null;
      operation.retryCount = 0;
      operation.merged = true;
      operation.forced = true;
      conflict.mergeResult = customMergeData;
      if (isDeleteThenEdit) {
        operation.forceRestore = true;
        delete operation.data._version;
        conflict.resolutionDetail = 'mergeAndRestore';
      } else if (serverVersion) {
        operation.data._version = serverVersion;
      }
    }

    this._persistConflicts();
    this._persistQueue();
    this._notifyListeners();

    this._addClientAuditEntry({
      action: '冲突已解决',
      conflictId,
      operationId: operation.id,
      resolution,
      conflictType: conflict.conflictType,
      detail: `冲突解决方式: ${this._getResolutionLabel(resolution)}${isDeleteThenEdit ? ' (删除后编辑场景)' : ''}`,
    });

    if (resolution !== 'keep_server') {
      this.startSync();
    }

    return true;
  }

  _getResolutionLabel(resolution) {
    const labels = {
      'keep_local': '保留本地修改',
      'keep_server': '使用服务端版本',
      'merge': '手动合并数据',
    };
    return labels[resolution] || resolution;
  }

  retryOperation(operationId) {
    const operation = this.operationQueue.find(op => op.id === operationId);
    if (!operation) return false;

    operation.status = OPERATION_STATUSES.PENDING;
    operation.retryCount = 0;
    operation.lastError = null;
    this._persistQueue();
    this._notifyListeners();

    this._addClientAuditEntry({
      action: '手动重试操作',
      operationId,
    });

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
      this._addClientAuditEntry({
        action: '手动重试所有失败操作',
      });
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
      this._addClientAuditEntry({
        action: '清除已同步操作记录',
        clearedCount: beforeCount - this.operationQueue.length,
      });
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
      if (key.startsWith('_') || key === 'timeline' || key === 'id' || key === 'createdAt' || key === 'updatedAt') continue;

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

  getServerAuditLog(filters) {
    return serverMock.getAuditLog(filters);
  }

  getFullAuditTrail(entityType, entityId) {
    const serverLog = serverMock.getAuditTrailForEntity(entityType, entityId);
    const clientLog = this.clientAuditLog.filter(e =>
      e.entityType === entityType && e.entityId === entityId
    );

    const combined = [
      ...serverLog.map(e => ({ ...e, source: 'server' })),
      ...clientLog.map(e => ({ ...e, source: 'client', serverOperationId: null })),
    ];

    combined.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return combined;
  }

  getClientAuditLog() {
    return [...this.clientAuditLog].reverse();
  }

  getSyncStatistics() {
    return serverMock.getStatistics();
  }

  simulateServerConflict(entityType, entityId, modifierName) {
    const result = serverMock.simulateConcurrentModify(entityType, entityId, modifierName);
    if (result) {
      this._addClientAuditEntry({
        action: '模拟服务端并发修改',
        entityType,
        entityId,
        modifierName,
      });
    }
    return result;
  }

  simulateServerDelete(entityType, entityId) {
    const result = serverMock.simulateEntityDeleted(entityType, entityId);
    if (result) {
      this._addClientAuditEntry({
        action: '模拟服务端删除实体',
        entityType,
        entityId,
      });
    }
    return result;
  }

  clearAllSyncData() {
    this.operationQueue = [];
    this.conflicts = [];
    this.entitySnapshots = {};
    this.clientAuditLog = [];
    this._persistQueue();
    this._persistConflicts();
    this._persistSnapshots();
    this._persistClientAudit();
    this._notifyListeners();
    serverMock.clearAll();
  }
}

export const syncManager = new SyncManager();
