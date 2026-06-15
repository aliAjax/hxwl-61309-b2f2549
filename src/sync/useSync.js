import { useState, useEffect, useCallback, useRef } from 'react';
import { syncManager } from './syncManager';
import { OPERATION_TYPES, OPERATION_STATUSES } from './types';

export function useSync() {
  const [syncState, setSyncState] = useState(() => syncManager.getState());

  useEffect(() => {
    return syncManager.subscribe(setSyncState);
  }, []);

  const enqueueRecordAdd = useCallback((recordData, options = {}) => {
    const timelineEntry = options.timelineEntry || null;
    return syncManager.enqueueOperation(
      OPERATION_TYPES.ADD_RECORD,
      'record',
      recordData.id,
      recordData,
      { timelineEntry, ...options }
    );
  }, []);

  const enqueueRecordUpdate = useCallback((recordId, recordData, options = {}) => {
    return syncManager.enqueueOperation(
      OPERATION_TYPES.UPDATE_RECORD,
      'record',
      recordId,
      recordData,
      options
    );
  }, []);

  const enqueueRecordDelete = useCallback((recordId, options = {}) => {
    return syncManager.enqueueOperation(
      OPERATION_TYPES.DELETE_RECORD,
      'record',
      recordId,
      { id: recordId },
      options
    );
  }, []);

  const enqueueRecordStatusUpdate = useCallback((recordId, newStatus, recordData, options = {}) => {
    return syncManager.enqueueOperation(
      OPERATION_TYPES.UPDATE_RECORD_STATUS,
      'record',
      recordId,
      { id: recordId, status: newStatus, ...recordData },
      options
    );
  }, []);

  const enqueueDeviationAdd = useCallback((deviationData, options = {}) => {
    return syncManager.enqueueOperation(
      OPERATION_TYPES.ADD_DEVIATION,
      'deviation',
      deviationData.id,
      deviationData,
      options
    );
  }, []);

  const enqueueDeviationUpdate = useCallback((deviationId, deviationData, options = {}) => {
    return syncManager.enqueueOperation(
      OPERATION_TYPES.UPDATE_DEVIATION,
      'deviation',
      deviationId,
      deviationData,
      options
    );
  }, []);

  const enqueueDeviationDelete = useCallback((deviationId, options = {}) => {
    return syncManager.enqueueOperation(
      OPERATION_TYPES.DELETE_DEVIATION,
      'deviation',
      deviationId,
      { id: deviationId },
      options
    );
  }, []);

  const enqueueDeviationStatusUpdate = useCallback((deviationId, newStatus, deviationData, options = {}) => {
    return syncManager.enqueueOperation(
      OPERATION_TYPES.UPDATE_DEVIATION_STATUS,
      'deviation',
      deviationId,
      { id: deviationId, status: newStatus, ...deviationData },
      options
    );
  }, []);

  const enqueuePublishVersion = useCallback((versionData, options = {}) => {
    const versionId = `v-${Date.now()}`;
    return syncManager.enqueueOperation(
      OPERATION_TYPES.PUBLISH_VERSION,
      'schema',
      versionId,
      { id: versionId, ...versionData },
      {
        auditEntry: {
          operator: versionData?.operator || '当前用户',
          action: '发布方案版本',
        },
        ...options,
      }
    );
  }, []);

  const enqueueExecuteMigration = useCallback((migrationData, options = {}) => {
    const migrationId = migrationData?.migrationId || `mig-${Date.now()}`;
    return syncManager.enqueueOperation(
      OPERATION_TYPES.EXECUTE_MIGRATION,
      'schema',
      migrationId,
      { id: migrationId, ...migrationData },
      {
        auditEntry: {
          operator: migrationData?.operator || '当前用户',
          action: '执行版本迁移',
        },
        ...options,
      }
    );
  }, []);

  const enqueueRollbackMigration = useCallback((migrationData, options = {}) => {
    const migrationId = migrationData?.migrationId || `rollback-${Date.now()}`;
    return syncManager.enqueueOperation(
      OPERATION_TYPES.ROLLBACK_MIGRATION,
      'schema',
      migrationId,
      { id: migrationId, ...migrationData },
      {
        auditEntry: {
          operator: migrationData?.operator || '当前用户',
          action: '回滚版本迁移',
        },
        ...options,
      }
    );
  }, []);

  const getCurrentSchemaVersion = useCallback(() => syncManager.getCurrentSchemaVersion(), []);
  const getSchemaVersionHistory = useCallback(() => syncManager.getSchemaVersionHistory(), []);
  const getServerStats = useCallback(() => syncManager.getServerStats(), []);

  const startSync = useCallback(() => syncManager.startSync(), []);
  const resolveConflict = useCallback((conflictId, resolution, customMergeData) =>
    syncManager.resolveConflict(conflictId, resolution, customMergeData), []);
  const retryOperation = useCallback((opId) => syncManager.retryOperation(opId), []);
  const retryAllFailed = useCallback(() => syncManager.retryAllFailed(), []);
  const clearSynced = useCallback(() => syncManager.clearSyncedOperations(), []);
  const takeSnapshot = useCallback((entityType, entityId, data) =>
    syncManager.takeSnapshot(entityType, entityId, data), []);
  const getSnapshot = useCallback((entityType, entityId) =>
    syncManager.getSnapshot(entityType, entityId), []);
  const getEntityVersion = useCallback((entityType, entityId) =>
    syncManager.getEntityVersion(entityType, entityId), []);
  const isEntityDirty = useCallback((entityType, entityId) =>
    syncManager.isEntityDirty(entityType, entityId), []);
  const hasConflict = useCallback((entityType, entityId) =>
    syncManager.hasConflict(entityType, entityId), []);
  const getOpDescription = useCallback((op) => syncManager.getOperationDescription(op), []);
  const getConflictTypeLabel = useCallback((type) => syncManager.getConflictTypeLabel(type), []);
  const computeFieldDiffs = useCallback((local, server) => syncManager.computeFieldDiffs(local, server), []);

  const getServerAuditLog = useCallback((filters) => syncManager.getServerAuditLog(filters), []);
  const getFullAuditTrail = useCallback((entityType, entityId) =>
    syncManager.getFullAuditTrail(entityType, entityId), []);
  const getClientAuditLog = useCallback(() => syncManager.getClientAuditLog(), []);
  const getSyncStatistics = useCallback(() => syncManager.getSyncStatistics(), []);
  const simulateServerConflict = useCallback((entityType, entityId, modifierName) =>
    syncManager.simulateServerConflict(entityType, entityId, modifierName), []);
  const simulateServerDelete = useCallback((entityType, entityId) =>
    syncManager.simulateServerDelete(entityType, entityId), []);
  const clearAllSyncData = useCallback(() => syncManager.clearAllSyncData(), []);

  return {
    syncState,
    enqueueRecordAdd,
    enqueueRecordUpdate,
    enqueueRecordDelete,
    enqueueRecordStatusUpdate,
    enqueueDeviationAdd,
    enqueueDeviationUpdate,
    enqueueDeviationDelete,
    enqueueDeviationStatusUpdate,
    enqueuePublishVersion,
    enqueueExecuteMigration,
    enqueueRollbackMigration,
    getCurrentSchemaVersion,
    getSchemaVersionHistory,
    getServerStats,
    startSync,
    resolveConflict,
    retryOperation,
    retryAllFailed,
    clearSynced,
    takeSnapshot,
    getSnapshot,
    getEntityVersion,
    isEntityDirty,
    hasConflict,
    getOpDescription,
    getConflictTypeLabel,
    computeFieldDiffs,
    getServerAuditLog,
    getFullAuditTrail,
    getClientAuditLog,
    getSyncStatistics,
    simulateServerConflict,
    simulateServerDelete,
    clearAllSyncData,
  };
}
