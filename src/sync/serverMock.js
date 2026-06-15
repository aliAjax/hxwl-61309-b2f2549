import { OPERATION_TYPES, CONFLICT_TYPES } from './types';

const SERVER_STORAGE_KEY = 'hxwl-61309-server-db';
const SERVER_AUDIT_KEY = 'hxwl-61309-server-audit';

function uid() {
  return 'svr-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function loadServerDB() {
  try {
    const raw = localStorage.getItem(SERVER_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load server DB:', e);
  }
  return {
    records: {},
    deviations: {},
    templates: {},
    centers: {},
    meta: {
      currentSchemaVersion: 1,
      lastUpdated: null,
    },
  };
}

function saveServerDB(db) {
  try {
    db.meta.lastUpdated = new Date().toISOString();
    localStorage.setItem(SERVER_STORAGE_KEY, JSON.stringify(db));
    return true;
  } catch (e) {
    console.error('Failed to save server DB:', e);
    return false;
  }
}

function loadAuditLog() {
  try {
    const raw = localStorage.getItem(SERVER_AUDIT_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load audit log:', e);
  }
  return [];
}

function saveAuditLog(log) {
  try {
    if (log.length > 10000) {
      log = log.slice(-5000);
    }
    localStorage.setItem(SERVER_AUDIT_KEY, JSON.stringify(log));
    return true;
  } catch (e) {
    console.error('Failed to save audit log:', e);
    return false;
  }
}

export class ServerMock {
  constructor() {
    this.db = loadServerDB();
    this.auditLog = loadAuditLog();
    this.networkLatencyMin = 100;
    this.networkLatencyMax = 300;
    this.operationIdCounter = 0;
  }

  _simulateLatency() {
    const delay = this.networkLatencyMin +
      Math.random() * (this.networkLatencyMax - this.networkLatencyMin);
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  _getEntityStore(entityType) {
    switch (entityType) {
      case 'record': return this.db.records;
      case 'deviation': return this.db.deviations;
      case 'template': return this.db.templates;
      case 'center': return this.db.centers;
      default: throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  _getEntityTypeName(entityType) {
    switch (entityType) {
      case 'record': return '访视记录';
      case 'deviation': return '偏差记录';
      case 'template': return '访视模板';
      case 'center': return '研究中心';
      default: return entityType;
    }
  }

  _addAuditEntry(entry) {
    const fullEntry = {
      id: uid(),
      serverOperationId: ++this.operationIdCounter,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.auditLog.push(fullEntry);
    saveAuditLog(this.auditLog);
    return fullEntry;
  }

  _clone(data) {
    return JSON.parse(JSON.stringify(data));
  }

  _compareVersions(v1, v2) {
    return JSON.stringify(v1 || {}) === JSON.stringify(v2 || {});
  }

  _detectFieldChanges(beforeData, afterData) {
    const changes = [];
    const allKeys = new Set([
      ...Object.keys(beforeData || {}),
      ...Object.keys(afterData || {}),
    ]);
    for (const key of allKeys) {
      if (key === '_version' || key === '_updatedAt' || key === '_updatedBy' ||
          key === '_clientId' || key === 'id' || key === 'timeline') continue;
      const beforeVal = beforeData?.[key];
      const afterVal = afterData?.[key];
      if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
        changes.push({
          field: key,
          beforeValue: beforeVal,
          afterValue: afterVal,
        });
      }
    }
    return changes;
  }

  async executeOperation(operation) {
    await this._simulateLatency();

    this.db = loadServerDB();

    const auditEntry = {
      operationType: operation.type,
      entityType: operation.entityType,
      entityId: operation.entityId,
      clientId: operation.clientId,
      clientOperationId: operation.id,
      baseVersion: operation.data?._version ?? operation.beforeSnapshot?._version ?? null,
      operator: operation.auditEntry?.operator || operation.clientId,
      timelineEntry: operation.timelineEntry || null,
    };

    try {
      let result;

      switch (operation.type) {
        case OPERATION_TYPES.ADD_RECORD:
        case OPERATION_TYPES.ADD_DEVIATION:
        case OPERATION_TYPES.ADD_TEMPLATE:
        case OPERATION_TYPES.ADD_CENTER:
          result = await this._handleAdd(operation, auditEntry);
          break;

        case OPERATION_TYPES.UPDATE_RECORD:
        case OPERATION_TYPES.UPDATE_DEVIATION:
        case OPERATION_TYPES.UPDATE_TEMPLATE:
        case OPERATION_TYPES.UPDATE_CENTER:
        case OPERATION_TYPES.UPDATE_RECORD_STATUS:
        case OPERATION_TYPES.UPDATE_DEVIATION_STATUS:
          result = await this._handleUpdate(operation, auditEntry);
          break;

        case OPERATION_TYPES.DELETE_RECORD:
        case OPERATION_TYPES.DELETE_DEVIATION:
        case OPERATION_TYPES.DELETE_TEMPLATE:
        case OPERATION_TYPES.DELETE_CENTER:
          result = await this._handleDelete(operation, auditEntry);
          break;

        case OPERATION_TYPES.PUBLISH_VERSION:
          result = await this._handlePublishVersion(operation, auditEntry);
          break;

        case OPERATION_TYPES.EXECUTE_MIGRATION:
          result = await this._handleExecuteMigration(operation, auditEntry);
          break;

        case OPERATION_TYPES.ROLLBACK_MIGRATION:
          result = await this._handleRollbackMigration(operation, auditEntry);
          break;

        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }

      if (result.success) {
        auditEntry.success = true;
        auditEntry.resultVersion = result.entityData?._version;
        auditEntry.fieldChanges = result.fieldChanges || null;
        this._addAuditEntry(auditEntry);
        saveServerDB(this.db);
      } else if (result.conflict) {
        auditEntry.success = false;
        auditEntry.conflict = true;
        auditEntry.conflictType = result.conflictType;
        this._addAuditEntry(auditEntry);
      }

      return result;

    } catch (error) {
      auditEntry.success = false;
      auditEntry.error = error.message;
      this._addAuditEntry(auditEntry);
      throw error;
    }
  }

  async _handleAdd(operation, auditEntry) {
    const store = this._getEntityStore(operation.entityType);
    const entityId = operation.entityId;

    if (store[entityId]) {
      return {
        success: false,
        conflict: true,
        conflictType: CONFLICT_TYPES.CONCURRENT_MODIFY,
        conflictReason: '该实体已在服务端存在',
        serverVersion: this._clone(store[entityId]),
      };
    }

    const now = new Date().toISOString();
    const entityData = this._clone(operation.data);
    entityData._version = 1;
    entityData._createdAt = now;
    entityData._updatedAt = now;
    entityData._updatedBy = auditEntry.operator;
    entityData._clientId = operation.clientId;

    store[entityId] = entityData;

    auditEntry.action = `新增${this._getEntityTypeName(operation.entityType)}`;
    auditEntry.summary = `编号: ${entityData.subjectNo || entityData.name || entityId}`;

    return {
      success: true,
      entityVersion: entityData._version,
      entityData: this._clone(entityData),
      syncedAt: now,
      fieldChanges: this._detectFieldChanges(null, operation.data),
    };
  }

  async _handleUpdate(operation, auditEntry) {
    const store = this._getEntityStore(operation.entityType);
    const entityId = operation.entityId;
    const serverEntity = store[entityId];

    if (!serverEntity) {
      if (operation.forceRestore === true) {
        const now = new Date().toISOString();
        const entityData = this._clone(operation.data);
        entityData._version = 1;
        entityData._createdAt = now;
        entityData._updatedAt = now;
        entityData._updatedBy = auditEntry.operator;
        entityData._clientId = operation.clientId;
        store[entityId] = entityData;
        auditEntry.action = `强制恢复${this._getEntityTypeName(operation.entityType)}`;
        this._addAuditEntry({
          ...auditEntry,
          action: '强制恢复已删除实体',
          detail: `通过 forceRestore 显式恢复已删除的 ${this._getEntityTypeName(operation.entityType)}`,
          success: true,
        });
        return {
          success: true,
          entityVersion: entityData._version,
          entityData: this._clone(entityData),
          syncedAt: now,
          fieldChanges: this._detectFieldChanges(null, operation.data),
          forceRestored: true,
        };
      }

      if (operation.beforeSnapshot && operation.beforeSnapshot._version) {
        auditEntry.action = `冲突:删除后编辑`;
        return {
          success: false,
          conflict: true,
          conflictType: CONFLICT_TYPES.DELETE_THEN_EDIT,
          conflictReason: '该记录已被其他终端在服务端删除。本地基于快照版本进行了编辑，需要确认是否恢复。',
          baseVersion: operation.beforeSnapshot._version,
          deletedSnapshot: this._clone(operation.beforeSnapshot),
          localEdit: this._clone(operation.data),
        };
      }

      return {
        success: false,
        conflict: true,
        conflictType: CONFLICT_TYPES.RECORD_NOT_FOUND,
        conflictReason: '服务端未找到该记录，可能已被其他终端删除，且缺少原始快照无法追踪。',
        serverVersion: null,
      };
    }

    const baseVersion = operation.data?._version ?? operation.beforeSnapshot?._version;
    const serverVersion = serverEntity._version;

    if (baseVersion !== undefined && baseVersion !== null && baseVersion !== serverVersion) {
      auditEntry.action = `冲突:版本不匹配`;
      return {
        success: false,
        conflict: true,
        conflictType: CONFLICT_TYPES.CONCURRENT_MODIFY,
        conflictReason: `版本不匹配：客户端基于版本 ${baseVersion} 修改，服务端当前版本为 ${serverVersion}`,
        baseVersion,
        serverVersion,
        serverVersionData: this._clone(serverEntity),
      };
    }

    if (operation.forced !== true) {
      const fieldChanges = this._detectFieldChanges(operation.beforeSnapshot, operation.data);
      const serverChanges = this._detectFieldChanges(operation.beforeSnapshot, serverEntity);
      const conflictFields = [];

      for (const localChange of fieldChanges) {
        const serverChange = serverChanges.find(sc => sc.field === localChange.field);
        if (serverChange) {
          const localChanged = JSON.stringify(localChange.beforeValue) !== JSON.stringify(localChange.afterValue);
          const serverChanged = JSON.stringify(serverChange.beforeValue) !== JSON.stringify(serverChange.afterValue);
          if (localChanged && serverChanged &&
              JSON.stringify(localChange.afterValue) !== JSON.stringify(serverChange.afterValue)) {
            conflictFields.push({
              field: localChange.field,
              localValue: localChange.afterValue,
              serverValue: serverChange.afterValue,
            });
          }
        }
      }

      if (conflictFields.length > 0) {
        auditEntry.action = `冲突:字段级冲突`;
        auditEntry.conflictFields = conflictFields;
        return {
          success: false,
          conflict: true,
          conflictType: CONFLICT_TYPES.CONCURRENT_MODIFY,
          conflictReason: `检测到 ${conflictFields.length} 个字段同时被修改`,
          conflictFields,
          baseVersion,
          serverVersion,
          serverVersionData: this._clone(serverEntity),
        };
      }
    }

    const now = new Date().toISOString();
    const newVersion = serverVersion + 1;
    const mergedData = this._clone(operation.data);
    const beforeServer = this._clone(serverEntity);

    for (const key of Object.keys(mergedData)) {
      if (key.startsWith('_') && key !== '_clientId') continue;
      serverEntity[key] = mergedData[key];
    }

    serverEntity._version = newVersion;
    serverEntity._updatedAt = now;
    serverEntity._updatedBy = auditEntry.operator;

    if (operation.timelineEntry && Array.isArray(serverEntity.timeline)) {
      serverEntity.timeline.push({
        ...operation.timelineEntry,
        synced: true,
        syncedAt: now,
      });
    }

    const actualChanges = this._detectFieldChanges(beforeServer, serverEntity);

    auditEntry.action = `更新${this._getEntityTypeName(operation.entityType)}`;
    auditEntry.summary = `版本 ${serverVersion} → ${newVersion}`;
    auditEntry.fieldChanges = actualChanges;
    auditEntry.oldVersion = serverVersion;
    auditEntry.newVersion = newVersion;

    return {
      success: true,
      entityVersion: newVersion,
      entityData: this._clone(serverEntity),
      syncedAt: now,
      fieldChanges: actualChanges,
      oldVersion: serverVersion,
      newVersion,
    };
  }

  async _handleDelete(operation, auditEntry) {
    const store = this._getEntityStore(operation.entityType);
    const entityId = operation.entityId;
    const serverEntity = store[entityId];

    if (!serverEntity) {
      return {
        success: true,
        entityVersion: null,
        entityData: null,
        syncedAt: new Date().toISOString(),
        note: '实体已不存在',
      };
    }

    const baseVersion = operation.data?._version ?? operation.beforeSnapshot?._version;
    const serverVersion = serverEntity._version;

    if (operation.forced !== true && baseVersion !== undefined && baseVersion !== null) {
      if (baseVersion !== serverVersion) {
        const currentChanges = this._detectFieldChanges(operation.beforeSnapshot, serverEntity);
        if (currentChanges.length > 0) {
          return {
            success: false,
            conflict: true,
            conflictType: CONFLICT_TYPES.DELETE_THEN_EDIT,
            conflictReason: `删除失败：该记录在服务端已被修改（版本 ${baseVersion} → ${serverVersion}）`,
            baseVersion,
            serverVersion,
            serverVersionData: this._clone(serverEntity),
            modifiedFields: currentChanges,
          };
        }
      }
    }

    auditEntry.action = `删除${this._getEntityTypeName(operation.entityType)}`;
    auditEntry.summary = `编号: ${serverEntity.subjectNo || serverEntity.name || entityId}, 版本: ${serverVersion}`;
    auditEntry.deletedData = this._clone(serverEntity);

    delete store[entityId];

    return {
      success: true,
      entityVersion: null,
      entityData: null,
      syncedAt: new Date().toISOString(),
      deletedVersion: serverVersion,
    };
  }

  async _handlePublishVersion(operation, auditEntry) {
    const oldVersion = this.db.meta.currentSchemaVersion || 0;
    const newVersion = oldVersion + 1;
    this.db.meta.currentSchemaVersion = newVersion;
    this.db.meta.lastSchemaUpdateAt = new Date().toISOString();
    this.db.meta.publishedBy = auditEntry.operator;
    this.db.meta.schemaVersionDetails = operation.data || null;

    const now = new Date().toISOString();
    const affectedRecords = [];
    const recordsWithVersion = newVersion;

    const affectedCounts = { records: 0, deviations: 0, templates: 0, centers: 0 };

    if (operation.data?.syncToRecords !== false) {
      Object.values(this.db.records).forEach(r => {
        r._schemaVersion = newVersion;
        r._schemaUpdatedAt = now;
        affectedCounts.records++;
        affectedRecords.push({ id: r.id, subjectNo: r.subjectNo, visitName: r.visitName });
      });
      Object.values(this.db.deviations).forEach(d => {
        d._schemaVersion = newVersion;
        d._schemaUpdatedAt = now;
        affectedCounts.deviations++;
      });
      Object.values(this.db.templates).forEach(t => {
        t._schemaVersion = newVersion;
        t._schemaUpdatedAt = now;
        affectedCounts.templates++;
      });
      Object.values(this.db.centers).forEach(c => {
        c._schemaVersion = newVersion;
        c._schemaUpdatedAt = now;
        affectedCounts.centers++;
      });
    }

    auditEntry.action = '发布方案版本';
    auditEntry.summary = `版本 ${oldVersion} → ${newVersion}`;
    auditEntry.schemaVersion = newVersion;
    auditEntry.oldSchemaVersion = oldVersion;
    auditEntry.affectedCounts = affectedCounts;
    auditEntry.schemaDetails = operation.data || null;

    return {
      success: true,
      entityVersion: newVersion,
      entityData: {
        schemaVersion: newVersion,
        oldSchemaVersion: oldVersion,
        publishedAt: now,
        publishedBy: auditEntry.operator,
        affectedCounts,
        affectedRecords: affectedRecords.slice(0, 10),
        totalAffected: affectedCounts.records + affectedCounts.deviations + affectedCounts.templates + affectedCounts.centers,
      },
      syncedAt: now,
      syncToRecords: operation.data?.syncToRecords !== false,
    };
  }

  async _handleExecuteMigration(operation, auditEntry) {
    const beforeSchemaVersion = this.db.meta.currentSchemaVersion;
    const migrationId = operation.data?.migrationId || `mig-${Date.now()}`;
    const now = new Date().toISOString();

    if (operation.data?.targetSchemaVersion) {
      this.db.meta.currentSchemaVersion = operation.data.targetSchemaVersion;
    }

    this.db.meta.lastMigrationAt = now;
    this.db.meta.lastMigrationId = migrationId;
    if (!this.db.meta.migrationHistory) {
      this.db.meta.migrationHistory = [];
    }
    this.db.meta.migrationHistory.push({
      id: migrationId,
      executedAt: now,
      executedBy: auditEntry.operator,
      beforeSchemaVersion,
      afterSchemaVersion: this.db.meta.currentSchemaVersion,
      details: operation.data || null,
    });

    if (operation.data?.recordMigrations && Array.isArray(operation.data.recordMigrations)) {
      operation.data.recordMigrations.forEach(mig => {
        const rec = this.db.records[mig.recordId];
        if (mig.action === 'add' && mig.after) {
          const entityData = this._clone(mig.after);
          entityData._version = 1;
          entityData._schemaVersion = this.db.meta.currentSchemaVersion;
          entityData._schemaUpdatedAt = now;
          entityData._migratedAt = now;
          entityData._migrationId = migrationId;
          entityData._updatedAt = now;
          entityData._updatedBy = auditEntry.operator;
          entityData._clientId = operation.clientId;
          this.db.records[mig.recordId] = entityData;
        } else if (rec) {
          Object.assign(rec, mig.changes || {});
          rec._schemaVersion = this.db.meta.currentSchemaVersion;
          rec._schemaUpdatedAt = now;
          rec._migratedAt = now;
          rec._migrationId = migrationId;
          rec._updatedAt = now;
          rec._updatedBy = auditEntry.operator;
        }
      });
    }

    auditEntry.action = '执行版本迁移';
    auditEntry.summary = migrationId;
    auditEntry.migrationDetails = operation.data || null;
    auditEntry.beforeSchemaVersion = beforeSchemaVersion;
    auditEntry.afterSchemaVersion = this.db.meta.currentSchemaVersion;

    return {
      success: true,
      entityVersion: this.db.meta.currentSchemaVersion,
      entityData: {
        migrationId,
        beforeSchemaVersion,
        afterSchemaVersion: this.db.meta.currentSchemaVersion,
        executedAt: now,
        recordMigrationCount: operation.data?.recordMigrations?.length || 0,
      },
      syncedAt: now,
    };
  }

  async _handleRollbackMigration(operation, auditEntry) {
    const beforeSchemaVersion = this.db.meta.currentSchemaVersion;
    const migrationId = operation.data?.migrationId || 'unknown';
    const now = new Date().toISOString();

    if (operation.data?.targetSchemaVersion) {
      this.db.meta.currentSchemaVersion = operation.data.targetSchemaVersion;
    }

    this.db.meta.lastRollbackAt = now;
    this.db.meta.lastRollbackMigrationId = migrationId;
    if (!this.db.meta.rollbackHistory) {
      this.db.meta.rollbackHistory = [];
    }
    this.db.meta.rollbackHistory.push({
      id: migrationId,
      rolledBackAt: now,
      rolledBackBy: auditEntry.operator,
      beforeSchemaVersion,
      afterSchemaVersion: this.db.meta.currentSchemaVersion,
      details: operation.data || null,
    });

    if (operation.data?.recordRollbacks && Array.isArray(operation.data.recordRollbacks)) {
      operation.data.recordRollbacks.forEach(rb => {
        const rec = this.db.records[rb.recordId];
        if (rb.action === 'remove_added') {
          delete this.db.records[rb.recordId];
        } else if (rec) {
          Object.assign(rec, rb.changes || {});
          rec._schemaVersion = this.db.meta.currentSchemaVersion;
          rec._schemaUpdatedAt = now;
          rec._rolledBackAt = now;
          rec._rollbackMigrationId = migrationId;
          rec._updatedAt = now;
          rec._updatedBy = auditEntry.operator;
        }
      });
    }

    auditEntry.action = '回滚版本迁移';
    auditEntry.summary = migrationId;
    auditEntry.migrationDetails = operation.data || null;
    auditEntry.beforeSchemaVersion = beforeSchemaVersion;
    auditEntry.afterSchemaVersion = this.db.meta.currentSchemaVersion;

    return {
      success: true,
      entityVersion: this.db.meta.currentSchemaVersion,
      entityData: {
        migrationId,
        beforeSchemaVersion,
        afterSchemaVersion: this.db.meta.currentSchemaVersion,
        rolledBackAt: now,
        recordRollbackCount: operation.data?.recordRollbacks?.length || 0,
      },
      syncedAt: now,
    };
  }

  async getEntity(entityType, entityId) {
    await this._simulateLatency();
    this.db = loadServerDB();
    const store = this._getEntityStore(entityType);
    const entity = store[entityId];
    return entity ? this._clone(entity) : null;
  }

  async getAllEntities(entityType) {
    await this._simulateLatency();
    this.db = loadServerDB();
    const store = this._getEntityStore(entityType);
    return Object.values(store).map(e => this._clone(e));
  }

  async getEntityVersion(entityType, entityId) {
    await this._simulateLatency();
    this.db = loadServerDB();
    const store = this._getEntityStore(entityType);
    const entity = store[entityId];
    return entity ? entity._version : null;
  }

  getAuditLog(filters = {}) {
    let log = [...this.auditLog];

    if (filters.entityType) {
      log = log.filter(e => e.entityType === filters.entityType);
    }
    if (filters.entityId) {
      log = log.filter(e => e.entityId === filters.entityId);
    }
    if (filters.clientId) {
      log = log.filter(e => e.clientId === filters.clientId);
    }
    if (filters.operationType) {
      log = log.filter(e => e.operationType === filters.operationType);
    }
    if (filters.success !== undefined) {
      log = log.filter(e => e.success === filters.success);
    }
    if (filters.conflict === true) {
      log = log.filter(e => e.conflict === true);
    }
    if (filters.startTime) {
      log = log.filter(e => e.timestamp >= filters.startTime);
    }
    if (filters.endTime) {
      log = log.filter(e => e.timestamp <= filters.endTime);
    }

    log.sort((a, b) => b.serverOperationId - a.serverOperationId);

    return log;
  }

  getAuditTrailForEntity(entityType, entityId) {
    return this.getAuditLog({ entityType, entityId });
  }

  getStatistics() {
    this.db = loadServerDB();
    const totalOps = this.auditLog.length;
    const successOps = this.auditLog.filter(e => e.success).length;
    const conflictOps = this.auditLog.filter(e => e.conflict).length;
    const failedOps = this.auditLog.filter(e => !e.success && !e.conflict).length;

    return {
      database: {
        records: Object.keys(this.db.records).length,
        deviations: Object.keys(this.db.deviations).length,
        templates: Object.keys(this.db.templates).length,
        centers: Object.keys(this.db.centers).length,
        schemaVersion: this.db.meta.currentSchemaVersion,
        lastUpdated: this.db.meta.lastUpdated,
      },
      audit: {
        totalOperations: totalOps,
        successOperations: successOps,
        conflictOperations: conflictOps,
        failedOperations: failedOps,
        successRate: totalOps > 0 ? ((successOps / totalOps) * 100).toFixed(2) + '%' : 'N/A',
      },
    };
  }

  clearAll() {
    this.db = {
      records: {},
      deviations: {},
      templates: {},
      centers: {},
      meta: {
        currentSchemaVersion: 1,
        lastUpdated: null,
      },
    };
    this.auditLog = [];
    saveServerDB(this.db);
    saveAuditLog(this.auditLog);
  }

  simulateConcurrentModify(entityType, entityId, modifierName) {
    const store = this._getEntityStore(entityType);
    const entity = store[entityId];
    if (!entity) return false;

    const now = new Date().toISOString();
    entity._version = (entity._version || 1) + 1;
    entity._updatedAt = now;
    entity._updatedBy = modifierName || '模拟并发修改用户';
    entity.status = entity.status === '已完成' ? '窗口内' : '已完成';

    saveServerDB(this.db);
    return true;
  }

  simulateEntityDeleted(entityType, entityId) {
    const store = this._getEntityStore(entityType);
    if (store[entityId]) {
      delete store[entityId];
      saveServerDB(this.db);
      return true;
    }
    return false;
  }
}

export const serverMock = new ServerMock();
