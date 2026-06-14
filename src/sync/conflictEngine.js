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
import { generateId } from './repositories';
import { OPERATION_TYPES, ENTITY_TYPES, diffEntities } from './operationLog';

export const CONFLICT_STATUS = {
  OPEN: 'open',
  RESOLVED_LOCAL: 'resolved_local',
  RESOLVED_REMOTE: 'resolved_remote',
  RESOLVED_MANUAL: 'resolved_manual',
  RESOLVED_MERGED: 'resolved_merged',
  DISCARDED: 'discarded',
};

export const CONFLICT_TYPES = {
  SIMULTANEOUS_EDIT: 'simultaneous_edit',
  DELETE_THEN_EDIT: 'delete_then_edit',
  EDIT_THEN_DELETE: 'edit_then_delete',
  VERSION_MISMATCH: 'version_mismatch',
  CREATE_DUPLICATE: 'create_duplicate',
  SCHEMA_CHANGED: 'schema_changed',
};

export const FIELD_LABELS = {
  subjectNo: '受试者编号',
  group: '试验分组',
  enrollDate: '入组日期',
  visitName: '访视名称',
  windowDays: '访视窗口天数',
  items: '检查项目',
  deviation: '偏差记录',
  status: '访视状态',
  plannedDate: '计划访视日期',
  plannedDays: '计划天数',
  actualDate: '实际完成日期',
  centerId: '研究中心',
  timeline: '状态时间线',
  title: '标题',
  description: '详细描述',
  severity: '严重程度',
  type: '偏差类型',
  resolution: '处理措施',
  reportedBy: '报告人',
  reportedAt: '报告日期',
  name: '名称',
  code: '编码',
  pi: 'PI姓名',
  location: '位置',
  visits: '访视配置',
  version: '版本号',
  isCurrent: '是否当前版本',
};

function getFieldLabel(key) {
  return FIELD_LABELS[key] || key;
}

export const ConflictRepo = {
  async create(conflict) {
    return withDB(async (db) => {
      const entity = {
        conflictId: conflict.conflictId || ('conflict_' + generateId()),
        status: CONFLICT_STATUS.OPEN,
        detectedAt: new Date().toISOString(),
        resolvedAt: null,
        resolvedBy: null,
        resolution: null,
        ...conflict,
      };

      const auditEntry = {
        id: generateId(),
        timestamp: entity.detectedAt,
        action: 'conflict_detected',
        target: conflict.entityId,
        conflictId: entity.conflictId,
        entityType: conflict.entityType,
        detail: `[冲突检测] ${conflict.conflictType} on ${conflict.entityType} id=${conflict.entityId}`,
        operator: '系统',
      };

      await runTransaction(db, [STORES.CONFLICTS, STORES.AUDITS], 'readwrite', (stores) => {
        storePut(stores[STORES.CONFLICTS], entity);
        storePut(stores[STORES.AUDITS], auditEntry);
      });

      return entity;
    });
  },

  async get(conflictId) {
    return withDB(async (db) => {
      return runTransactionWithResult(db, [STORES.CONFLICTS], 'readonly', (stores, tx, setResult) => {
        storeGet(stores[STORES.CONFLICTS], conflictId).then(setResult);
      });
    });
  },

  async getAll(status = null) {
    return withDB(async (db) => {
      return runTransactionWithResult(db, [STORES.CONFLICTS], 'readonly', (stores, tx, setResult) => {
        const store = stores[STORES.CONFLICTS];
        if (status) {
          indexGetAll(store, 'status', status).then(setResult);
          return;
        }
        const results = [];
        openCursor(store, 'detectedAt', null, 'prev', (cursor) => {
          results.push(cursor.value);
          return true;
        }).then(() => setResult(results));
      });
    });
  },

  async getByEntity(entityType, entityId) {
    return withDB(async (db) => {
      return runTransactionWithResult(db, [STORES.CONFLICTS], 'readonly', (stores, tx, setResult) => {
        const store = stores[STORES.CONFLICTS];
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

  async resolve(conflictId, resolution, resolvedBy = '操作员') {
    return withDB(async (db) => {
      return runTransactionWithResult(db, [STORES.CONFLICTS, STORES.AUDITS], 'readwrite', (stores, tx, setResult) => {
        const store = stores[STORES.CONFLICTS];
        storeGet(store, conflictId).then((existing) => {
          if (!existing) throw new Error(`Conflict ${conflictId} not found`);

          const updated = {
            ...existing,
            status: resolution.status,
            resolvedAt: new Date().toISOString(),
            resolvedBy,
            resolution: resolution.data || null,
            mergedEntity: resolution.mergedEntity || null,
          };

          const auditEntry = {
            id: generateId(),
            timestamp: updated.resolvedAt,
            action: 'conflict_resolved',
            target: existing.entityId,
            conflictId,
            entityType: existing.entityType,
            detail: `[冲突解决] ${resolution.status} by ${resolvedBy}`,
            operator: resolvedBy,
          };

          storePut(store, updated).then(() => {
            storePut(stores[STORES.AUDITS], auditEntry).then(() => setResult(updated));
          });
        });
      });
    });
  },

  async remove(conflictId) {
    return withDB(async (db) => {
      await runTransaction(db, [STORES.CONFLICTS], 'readwrite', (stores) => {
        storeDelete(stores[STORES.CONFLICTS], conflictId);
      });
    });
  },

  async getOpenCount() {
    const all = await this.getAll(CONFLICT_STATUS.OPEN);
    return all.length;
  },
};

export const ConflictDetector = {
  detectConflict({ localOperation, remoteEntity, localEntity, serverVersion, entityType }) {
    if (localOperation.operationType === OPERATION_TYPES.DELETE && remoteEntity) {
      const remoteChanges = diffEntities(localOperation.previousData, remoteEntity);
      if (Object.keys(remoteChanges).length > 0) {
        return {
          conflictType: CONFLICT_TYPES.DELETE_THEN_EDIT,
          entityType,
          entityId: localOperation.entityId,
          localOperation,
          remoteEntity,
          localEntity: localOperation.previousData,
          description: '本地删除后，服务端该记录有新的修改',
          fieldDiffs: this.formatFieldDiffs(remoteChanges),
        };
      }
    }

    if (localOperation.operationType === OPERATION_TYPES.UPDATE && !remoteEntity) {
      return {
        conflictType: CONFLICT_TYPES.EDIT_THEN_DELETE,
        entityType,
        entityId: localOperation.entityId,
        localOperation,
        remoteEntity: null,
        localEntity,
        description: '本地修改时，服务端该记录已被删除',
        fieldDiffs: [],
      };
    }

    if (localOperation.operationType === OPERATION_TYPES.CREATE && remoteEntity) {
      return {
        conflictType: CONFLICT_TYPES.CREATE_DUPLICATE,
        entityType,
        entityId: localOperation.entityId,
        localOperation,
        remoteEntity,
        localEntity: localOperation.data,
        description: '本地新增记录与服务端已有记录ID冲突',
        fieldDiffs: this.formatFieldDiffs(diffEntities(localOperation.data, remoteEntity)),
      };
    }

    if (localOperation.operationType === OPERATION_TYPES.UPDATE && remoteEntity) {
      const baseData = localOperation.previousData;
      const localChanges = diffEntities(baseData, localEntity);
      const remoteChanges = diffEntities(baseData, remoteEntity);
      const conflictingFields = {};

      for (const key of Object.keys(localChanges)) {
        if (remoteChanges[key]) {
          const localJson = JSON.stringify(localChanges[key].new);
          const remoteJson = JSON.stringify(remoteChanges[key].new);
          if (localJson !== remoteJson) {
            conflictingFields[key] = {
              local: localChanges[key].new,
              remote: remoteChanges[key].new,
              base: localChanges[key].old,
            };
          }
        }
      }

      if (Object.keys(conflictingFields).length > 0) {
        return {
          conflictType: CONFLICT_TYPES.SIMULTANEOUS_EDIT,
          entityType,
          entityId: localOperation.entityId,
          localOperation,
          remoteEntity,
          localEntity,
          baseData,
          description: '本地和服务端同时修改了相同字段',
          fieldDiffs: this.formatConflictFields(conflictingFields),
          conflictingFields,
        };
      }

      if (serverVersion && localOperation.baseVersion && serverVersion > localOperation.baseVersion) {
        return {
          conflictType: CONFLICT_TYPES.VERSION_MISMATCH,
          entityType,
          entityId: localOperation.entityId,
          localOperation,
          remoteEntity,
          localEntity,
          baseData,
          serverVersion,
          description: `本地基于旧版本(v${localOperation.baseVersion})修改，服务端已更新到v${serverVersion}`,
          fieldDiffs: this.formatFieldDiffs(diffEntities(localEntity, remoteEntity)),
        };
      }
    }

    return null;
  },

  formatFieldDiffs(changes) {
    return Object.entries(changes).map(([key, diff]) => ({
      field: key,
      label: getFieldLabel(key),
      old: diff.old,
      new: diff.new,
    }));
  },

  formatConflictFields(conflictingFields) {
    return Object.entries(conflictingFields).map(([key, values]) => ({
      field: key,
      label: getFieldLabel(key),
      base: values.base,
      local: values.local,
      remote: values.remote,
    }));
  },

  async autoMerge(conflict, mergeStrategy = 'prefer_non_empty') {
    if (!conflict.conflictingFields) return null;

    const merged = { ...conflict.remoteEntity };
    const mergedFields = [];
    const needsManual = [];

    for (const [key, values] of Object.entries(conflict.conflictingFields)) {
      const result = this.resolveField(key, values, mergeStrategy);
      if (result.manual) {
        needsManual.push(key);
      } else {
        merged[key] = result.value;
        mergedFields.push({ field: key, strategy: result.strategy, value: result.value });
      }
    }

    if (needsManual.length > 0) {
      return { success: false, needsManual, partiallyMerged: merged, mergedFields };
    }

    return { success: true, mergedEntity: merged, mergedFields };
  },

  resolveField(key, values, strategy) {
    const { local, remote, base } = values;

    if (JSON.stringify(local) === JSON.stringify(remote)) {
      return { value: local, strategy: 'identical' };
    }

    switch (strategy) {
      case 'prefer_local':
        return { value: local, strategy: 'prefer_local' };
      case 'prefer_remote':
        return { value: remote, strategy: 'prefer_remote' };
      case 'prefer_non_empty':
        if (local !== null && local !== undefined && local !== '' && JSON.stringify(local) !== '{}') {
          return { value: local, strategy: 'prefer_non_empty_local' };
        }
        if (remote !== null && remote !== undefined && remote !== '' && JSON.stringify(remote) !== '{}') {
          return { value: remote, strategy: 'prefer_non_empty_remote' };
        }
        return { value: base, strategy: 'fallback_base' };
      case 'prefer_newer':
        return { manual: true, reason: 'timestamp_unavailable' };
      case 'merge_arrays':
        if (Array.isArray(local) && Array.isArray(remote)) {
          const combined = [...new Set([...local, ...remote])];
          return { value: combined, strategy: 'merge_arrays' };
        }
        return { manual: true, reason: 'not_arrays' };
      default:
        return { manual: true, reason: 'no_strategy' };
    }
  },

  hasConflicts(localOps, remoteEntities) {
    const conflicts = [];
    const remoteMap = new Map(remoteEntities.map(e => [e.id, e]));

    for (const op of localOps) {
      const remoteEntity = remoteMap.get(op.entityId);
      const localEntity = op.operationType === OPERATION_TYPES.UPDATE ? { ...op.previousData, ...op.data } : op.data;
      const conflict = this.detectConflict({
        localOperation: op,
        remoteEntity,
        localEntity,
        entityType: op.entityType,
      });
      if (conflict) conflicts.push(conflict);
    }

    return conflicts;
  },
};

export function getConflictTypeLabel(type) {
  const labels = {
    [CONFLICT_TYPES.SIMULTANEOUS_EDIT]: '同时修改',
    [CONFLICT_TYPES.DELETE_THEN_EDIT]: '删除后被修改',
    [CONFLICT_TYPES.EDIT_THEN_DELETE]: '修改后被删除',
    [CONFLICT_TYPES.VERSION_MISMATCH]: '版本不一致',
    [CONFLICT_TYPES.CREATE_DUPLICATE]: '重复创建',
    [CONFLICT_TYPES.SCHEMA_CHANGED]: '方案版本变更',
  };
  return labels[type] || type;
}

export function getConflictStatusLabel(status) {
  const labels = {
    [CONFLICT_STATUS.OPEN]: '待处理',
    [CONFLICT_STATUS.RESOLVED_LOCAL]: '采用本地',
    [CONFLICT_STATUS.RESOLVED_REMOTE]: '采用服务端',
    [CONFLICT_STATUS.RESOLVED_MANUAL]: '人工解决',
    [CONFLICT_STATUS.RESOLVED_MERGED]: '已合并',
    [CONFLICT_STATUS.DISCARDED]: '已丢弃',
  };
  return labels[status] || status;
}

export function getConflictStatusClass(status) {
  const classes = {
    [CONFLICT_STATUS.OPEN]: 'conflict-status-open',
    [CONFLICT_STATUS.RESOLVED_LOCAL]: 'conflict-status-local',
    [CONFLICT_STATUS.RESOLVED_REMOTE]: 'conflict-status-remote',
    [CONFLICT_STATUS.RESOLVED_MANUAL]: 'conflict-status-manual',
    [CONFLICT_STATUS.RESOLVED_MERGED]: 'conflict-status-merged',
    [CONFLICT_STATUS.DISCARDED]: 'conflict-status-discarded',
  };
  return classes[status] || '';
}
