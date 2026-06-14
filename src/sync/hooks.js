import { useState, useEffect, useCallback, useRef } from 'react';
import { syncManager, SYNC_STATUS, serverAPI } from './syncManager';
import {
  RecordRepo,
  DeviationRepo,
  TemplateRepo,
  CenterRepo,
  VersionRepo,
  AuditRepo,
} from './repositories';
import { OperationLog, ENTITY_TYPES, OPERATION_TYPES } from './operationLog';
import { ConflictRepo, ConflictDetector, CONFLICT_STATUS } from './conflictEngine';

export function useSyncStatus() {
  const [stats, setStats] = useState({
    status: SYNC_STATUS.IDLE,
    isOnline: true,
    lastSyncAt: null,
    pendingOperations: 0,
    failedOperations: 0,
    conflictOperations: 0,
    openConflicts: 0,
    totalOperations: 0,
  });

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      if (!mounted) return;
      const s = await syncManager.getSyncStats();
      setStats(s);
    };

    refresh();

    const unsub1 = syncManager.on('syncStart', refresh);
    const unsub2 = syncManager.on('syncComplete', refresh);
    const unsub3 = syncManager.on('syncError', refresh);
    const unsub4 = syncManager.on('online', refresh);
    const unsub5 = syncManager.on('offline', refresh);
    const unsub6 = syncManager.on('conflictDetected', refresh);
    const unsub7 = syncManager.on('operationSynced', refresh);

    const interval = setInterval(refresh, 5000);

    return () => {
      mounted = false;
      unsub1?.();
      unsub2?.();
      unsub3?.();
      unsub4?.();
      unsub5?.();
      unsub6?.();
      unsub7?.();
      clearInterval(interval);
    };
  }, []);

  const triggerSync = useCallback(() => {
    return syncManager.syncAll({ force: true });
  }, []);

  const retryFailed = useCallback(() => {
    return syncManager.retryFailedOps();
  }, []);

  return { ...stats, triggerSync, retryFailed };
}

export function useRecords() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await RecordRepo.getAll();
    setRecords(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const unsub = syncManager.on('entityPulled', ({ entityType }) => {
      if (entityType === ENTITY_TYPES.RECORD) refresh();
    });
    const unsub2 = syncManager.on('syncComplete', refresh);
    return () => { unsub?.(); unsub2?.(); };
  }, [refresh]);

  const createRecord = useCallback(async (data, operator = '操作员') => {
    const entity = await RecordRepo.create(data);
    await OperationLog.createEntity(ENTITY_TYPES.RECORD, entity, operator);
    syncManager.scheduleSync(300);
    await refresh();
    return entity;
  }, [refresh]);

  const updateRecord = useCallback(async (id, updates, operator = '操作员') => {
    const existing = await RecordRepo.getById(id);
    if (!existing) throw new Error('Record not found');
    const entity = await RecordRepo.update(id, updates);
    await OperationLog.updateEntity(ENTITY_TYPES.RECORD, id, updates, existing, operator);
    syncManager.scheduleSync(300);
    await refresh();
    return entity;
  }, [refresh]);

  const deleteRecord = useCallback(async (id, operator = '操作员') => {
    const existing = await RecordRepo.getById(id);
    await RecordRepo.remove(id);
    if (existing) {
      await OperationLog.deleteEntity(ENTITY_TYPES.RECORD, id, existing, operator);
    }
    syncManager.scheduleSync(300);
    await refresh();
  }, [refresh]);

  return { records, loading, refresh, createRecord, updateRecord, deleteRecord };
}

export function useDeviations() {
  const [deviations, setDeviations] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await DeviationRepo.getAll();
    setDeviations(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const unsub = syncManager.on('entityPulled', ({ entityType }) => {
      if (entityType === ENTITY_TYPES.DEVIATION) refresh();
    });
    const unsub2 = syncManager.on('syncComplete', refresh);
    return () => { unsub?.(); unsub2?.(); };
  }, [refresh]);

  const createDeviation = useCallback(async (data, operator = '操作员') => {
    const entity = await DeviationRepo.create(data);
    await OperationLog.createEntity(ENTITY_TYPES.DEVIATION, entity, operator);
    syncManager.scheduleSync(300);
    await refresh();
    return entity;
  }, [refresh]);

  const updateDeviation = useCallback(async (id, updates, operator = '操作员') => {
    const existing = await DeviationRepo.getById(id);
    if (!existing) throw new Error('Deviation not found');
    const entity = await DeviationRepo.update(id, updates);
    await OperationLog.updateEntity(ENTITY_TYPES.DEVIATION, id, updates, existing, operator);
    syncManager.scheduleSync(300);
    await refresh();
    return entity;
  }, [refresh]);

  const deleteDeviation = useCallback(async (id, operator = '操作员') => {
    const existing = await DeviationRepo.getById(id);
    await DeviationRepo.remove(id);
    if (existing) {
      await OperationLog.deleteEntity(ENTITY_TYPES.DEVIATION, id, existing, operator);
    }
    syncManager.scheduleSync(300);
    await refresh();
  }, [refresh]);

  return { deviations, loading, refresh, createDeviation, updateDeviation, deleteDeviation };
}

export function useTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await TemplateRepo.getAll();
    setTemplates(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createTemplate = useCallback(async (data, operator = '操作员') => {
    const entity = await TemplateRepo.create(data);
    await OperationLog.createEntity(ENTITY_TYPES.TEMPLATE, entity, operator);
    syncManager.scheduleSync(300);
    await refresh();
    return entity;
  }, [refresh]);

  const updateTemplate = useCallback(async (id, updates, operator = '操作员') => {
    const existing = await TemplateRepo.getById(id);
    if (!existing) throw new Error('Template not found');
    const entity = await TemplateRepo.update(id, updates);
    await OperationLog.updateEntity(ENTITY_TYPES.TEMPLATE, id, updates, existing, operator);
    syncManager.scheduleSync(300);
    await refresh();
    return entity;
  }, [refresh]);

  const deleteTemplate = useCallback(async (id, operator = '操作员') => {
    const existing = await TemplateRepo.getById(id);
    await TemplateRepo.remove(id);
    if (existing) {
      await OperationLog.deleteEntity(ENTITY_TYPES.TEMPLATE, id, existing, operator);
    }
    syncManager.scheduleSync(300);
    await refresh();
  }, [refresh]);

  return { templates, loading, refresh, createTemplate, updateTemplate, deleteTemplate };
}

export function useCenters() {
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await CenterRepo.getAll();
    setCenters(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { centers, loading, refresh };
}

export function useVersions() {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await VersionRepo.getAll();
    setVersions(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { versions, loading, refresh };
}

export function useConflicts() {
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await ConflictRepo.getAll();
    setConflicts(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const unsub = syncManager.on('conflictDetected', refresh);
    return () => unsub?.();
  }, [refresh]);

  const resolveConflict = useCallback(async (conflictId, resolution, resolvedBy = '操作员') => {
    const conflict = await ConflictRepo.get(conflictId);
    if (!conflict) throw new Error('Conflict not found');

    const resolved = await ConflictRepo.resolve(conflictId, resolution, resolvedBy);

    if (resolution.status === CONFLICT_STATUS.RESOLVED_LOCAL && conflict.localOperation) {
      const op = conflict.localOperation;
      await OperationLog.updateStatus(op.opId, OPERATION_TYPES.UPDATE ? 'pending' : op.status);
      syncManager.scheduleSync(500);
    } else if (resolution.status === CONFLICT_STATUS.RESOLVED_REMOTE) {
      if (conflict.localOperation) {
        await OperationLog.markCancelled(conflict.localOperation.opId);
      }
      if (conflict.remoteEntity) {
        const repoMap = {
          [ENTITY_TYPES.RECORD]: RecordRepo,
          [ENTITY_TYPES.DEVIATION]: DeviationRepo,
        };
        const repo = repoMap[conflict.entityType];
        if (repo) {
          await repo.upsert(conflict.remoteEntity);
        }
      }
    } else if (resolution.status === CONFLICT_STATUS.RESOLVED_MERGED && resolution.mergedEntity) {
      const repoMap = {
        [ENTITY_TYPES.RECORD]: RecordRepo,
        [ENTITY_TYPES.DEVIATION]: DeviationRepo,
      };
      const repo = repoMap[conflict.entityType];
      if (repo && conflict.localOperation) {
        const existing = await repo.getById(conflict.entityId);
        await repo.upsert(resolution.mergedEntity);
        await OperationLog.updateEntity(
          conflict.entityType,
          conflict.entityId,
          resolution.mergedEntity,
          existing,
          resolvedBy
        );
        syncManager.scheduleSync(500);
      }
    } else if (resolution.status === CONFLICT_STATUS.DISCARDED) {
      if (conflict.localOperation) {
        await OperationLog.markCancelled(conflict.localOperation.opId);
      }
    }

    await refresh();
    return resolved;
  }, [refresh]);

  const autoMerge = useCallback(async (conflictId, strategy = 'prefer_non_empty') => {
    const conflict = await ConflictRepo.get(conflictId);
    if (!conflict) throw new Error('Conflict not found');

    const mergeResult = await ConflictDetector.autoMerge(conflict, strategy);
    if (mergeResult.success) {
      return resolveConflict(conflictId, {
        status: CONFLICT_STATUS.RESOLVED_MERGED,
        mergedEntity: mergeResult.mergedEntity,
        data: { strategy, mergedFields: mergeResult.mergedFields },
      }, '系统-自动合并');
    }
    return mergeResult;
  }, [resolveConflict]);

  return { conflicts, loading, refresh, resolveConflict, autoMerge };
}

export function useAuditLog(targetId = null) {
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = targetId ? await AuditRepo.getByTarget(targetId) : await AuditRepo.getAll();
    setAudits(data);
    setLoading(false);
  }, [targetId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { audits, loading, refresh };
}

export function useOperationTimeline(entityType, entityId) {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!entityType || !entityId) return;
    setLoading(true);
    const data = await OperationLog.getOperationTimeline(entityType, entityId);
    setTimeline(data);
    setLoading(false);
  }, [entityType, entityId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { timeline, loading, refresh };
}

export function useOperationLog() {
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await OperationLog.getAll();
    setOperations(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { operations, loading, refresh };
}

export function useAutoMigrateFromLocalStorage() {
  const migratedRef = useRef(false);

  useEffect(() => {
    if (migratedRef.current) return;
    migratedRef.current = true;

    const doMigrate = async () => {
      try {
        const existingRecords = await RecordRepo.getAll();
        if (existingRecords.length > 0) return;

        const keys = [
          'hxwl-61309-clinical-visit',
          'hxwl-61309-visit-templates',
          'hxwl-61309-centers',
          'hxwl-61309-deviations',
          'hxwl-61309-versions',
          'hxwl-61309-audit',
        ];

        for (const key of keys) {
          try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const data = JSON.parse(raw);

            if (key === 'hxwl-61309-clinical-visit' && Array.isArray(data)) {
              await RecordRepo.bulkUpsert(data.map(d => ({
                ...d,
                createdAt: d.createdAt || d.timeline?.[0]?.at || new Date().toISOString(),
              })));
            } else if (key === 'hxwl-61309-visit-templates' && Array.isArray(data)) {
              for (const t of data) await TemplateRepo.create(t);
            } else if (key === 'hxwl-61309-centers' && Array.isArray(data)) {
              for (const c of data) await CenterRepo.create(c);
            } else if (key === 'hxwl-61309-deviations' && Array.isArray(data)) {
              for (const d of data) await DeviationRepo.create(d);
            } else if (key === 'hxwl-61309-versions' && Array.isArray(data)) {
              for (const v of data) await VersionRepo.create(v);
            } else if (key === 'hxwl-61309-audit' && Array.isArray(data)) {
              for (const a of data) await AuditRepo.create(a);
            }
          } catch (e) {
            console.warn(`Migration error for ${key}`, e);
          }
        }

        const records = await RecordRepo.getAll();
        const deviations = await DeviationRepo.getAll();
        const templates = await TemplateRepo.getAll();
        const centers = await CenterRepo.getAll();
        const versions = await VersionRepo.getAll();
        serverAPI.seedFromLocal(records, deviations, templates, centers, versions);

      } catch (e) {
        console.error('Migration failed', e);
      }
    };

    doMigrate();
  }, []);
}

