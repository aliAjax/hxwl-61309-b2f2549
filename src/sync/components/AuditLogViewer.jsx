import React, { useState, useMemo } from 'react';
import {
  History, Database, User, Clock, AlertTriangle, CheckCircle, XCircle,
  RefreshCw, Server, Monitor, Filter, ChevronDown, ChevronRight,
  FileText, Download, AlertCircle, Shield
} from 'lucide-react';
import { OPERATION_TYPES, CONFLICT_TYPES } from '../types';

export function AuditLogViewer({
  serverAuditLog,
  clientAuditLog,
  syncStatistics,
  getFullAuditTrail,
  simulateServerConflict,
  simulateServerDelete,
  clearAllSyncData,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [filterEntityType, setFilterEntityType] = useState('all');
  const [filterOperationType, setFilterOperationType] = useState('all');
  const [filterSuccess, setFilterSuccess] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [expandedEntries, setExpandedEntries] = useState(new Set());
  const [showSimulate, setShowSimulate] = useState(false);
  const [simulateEntityType, setSimulateEntityType] = useState('record');
  const [simulateEntityId, setSimulateEntityId] = useState('');
  const [simulateModifierName, setSimulateModifierName] = useState('测试用户B');

  const formatValue = (val) => {
    if (val === null || val === undefined) return '-';
    if (typeof val === 'object') return JSON.stringify(val, null, 2);
    return String(val);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '-';
    try {
      return new Date(timestamp).toLocaleString('zh-CN');
    } catch (e) {
      return timestamp;
    }
  };

  const getOperationLabel = (opType) => {
    const labels = {
      [OPERATION_TYPES.ADD_RECORD]: '新增访视',
      [OPERATION_TYPES.UPDATE_RECORD]: '更新访视',
      [OPERATION_TYPES.DELETE_RECORD]: '删除访视',
      [OPERATION_TYPES.UPDATE_RECORD_STATUS]: '更新状态',
      [OPERATION_TYPES.ADD_DEVIATION]: '新增偏差',
      [OPERATION_TYPES.UPDATE_DEVIATION]: '更新偏差',
      [OPERATION_TYPES.DELETE_DEVIATION]: '删除偏差',
      [OPERATION_TYPES.UPDATE_DEVIATION_STATUS]: '偏差状态',
      [OPERATION_TYPES.ADD_TEMPLATE]: '新增模板',
      [OPERATION_TYPES.UPDATE_TEMPLATE]: '更新模板',
      [OPERATION_TYPES.DELETE_TEMPLATE]: '删除模板',
      [OPERATION_TYPES.ADD_CENTER]: '新增中心',
      [OPERATION_TYPES.UPDATE_CENTER]: '更新中心',
      [OPERATION_TYPES.DELETE_CENTER]: '删除中心',
      [OPERATION_TYPES.PUBLISH_VERSION]: '发布版本',
      [OPERATION_TYPES.EXECUTE_MIGRATION]: '执行迁移',
      [OPERATION_TYPES.ROLLBACK_MIGRATION]: '回滚迁移',
    };
    return labels[opType] || opType;
  };

  const getConflictTypeLabel = (type) => {
    const labels = {
      [CONFLICT_TYPES.CONCURRENT_MODIFY]: '并发修改',
      [CONFLICT_TYPES.DELETE_THEN_EDIT]: '删除后编辑',
      [CONFLICT_TYPES.VERSION_CHANGED]: '版本变更',
      [CONFLICT_TYPES.RECORD_NOT_FOUND]: '记录不存在',
      [CONFLICT_TYPES.PERMISSION_DENIED]: '权限不足',
    };
    return labels[type] || type;
  };

  const filteredServerLog = useMemo(() => {
    let log = [...serverAuditLog];
    if (filterEntityType !== 'all') {
      log = log.filter(e => e.entityType === filterEntityType);
    }
    if (filterOperationType !== 'all') {
      log = log.filter(e => e.operationType === filterOperationType);
    }
    if (filterSuccess === 'success') {
      log = log.filter(e => e.success);
    } else if (filterSuccess === 'failed') {
      log = log.filter(e => !e.success && !e.conflict);
    } else if (filterSuccess === 'conflict') {
      log = log.filter(e => e.conflict);
    }
    return log;
  }, [serverAuditLog, filterEntityType, filterOperationType, filterSuccess]);

  const filteredClientLog = useMemo(() => {
    let log = [...clientAuditLog];
    if (filterEntityType !== 'all') {
      log = log.filter(e => e.entityType === filterEntityType);
    }
    return log;
  }, [clientAuditLog, filterEntityType]);

  const toggleExpand = (id) => {
    const next = new Set(expandedEntries);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedEntries(next);
  };

  const handleSimulateConflict = () => {
    if (!simulateEntityId.trim()) {
      alert('请输入实体ID');
      return;
    }
    const result = simulateServerConflict(simulateEntityType, simulateEntityId.trim(), simulateModifierName.trim());
    if (result) {
      alert('已模拟服务端并发修改！现在修改本地实体后同步会触发冲突检测');
    } else {
      alert('未找到该实体，请先确保该实体已同步到服务端');
    }
  };

  const handleSimulateDelete = () => {
    if (!simulateEntityId.trim()) {
      alert('请输入实体ID');
      return;
    }
    const result = simulateServerDelete(simulateEntityType, simulateEntityId.trim());
    if (result) {
      alert('已模拟服务端删除！现在同步本地更新会触发删除后编辑冲突');
    } else {
      alert('未找到该实体');
    }
  };

  const renderOverview = () => (
    <div className="audit-overview">
      <h3 className="audit-section-title"><Shield size={18} /> 数据同步与审计概览</h3>
      <div className="audit-stats-grid">
        <div className="audit-stat-card">
          <div className="audit-stat-icon audit-stat-db">
            <Database size={24} />
          </div>
          <div className="audit-stat-info">
            <div className="audit-stat-label">服务端数据库</div>
            <div className="audit-stat-value">
              {syncStatistics?.database?.records || 0} 条访视
              <span className="audit-stat-sub">
                {syncStatistics?.database?.deviations || 0} 偏差 ·
                {syncStatistics?.database?.templates || 0} 模板 ·
                {syncStatistics?.database?.centers || 0} 中心
              </span>
            </div>
          </div>
        </div>
        <div className="audit-stat-card">
          <div className="audit-stat-icon audit-stat-success">
            <CheckCircle size={24} />
          </div>
          <div className="audit-stat-info">
            <div className="audit-stat-label">同步成功率</div>
            <div className="audit-stat-value">
              {syncStatistics?.audit?.successRate || 'N/A'}
              <span className="audit-stat-sub">
                成功 {syncStatistics?.audit?.successOperations || 0} /
                总计 {syncStatistics?.audit?.totalOperations || 0}
              </span>
            </div>
          </div>
        </div>
        <div className="audit-stat-card">
          <div className="audit-stat-icon audit-stat-conflict">
            <AlertTriangle size={24} />
          </div>
          <div className="audit-stat-info">
            <div className="audit-stat-label">冲突检测</div>
            <div className="audit-stat-value">
              {syncStatistics?.audit?.conflictOperations || 0} 次
              <span className="audit-stat-sub">基于实体版本号确定性检测</span>
            </div>
          </div>
        </div>
        <div className="audit-stat-card">
          <div className="audit-stat-icon audit-stat-failed">
            <XCircle size={24} />
          </div>
          <div className="audit-stat-info">
            <div className="audit-stat-label">失败操作</div>
            <div className="audit-stat-value">
              {syncStatistics?.audit?.failedOperations || 0} 次
              <span className="audit-stat-sub">已自动指数退避重试</span>
            </div>
          </div>
        </div>
        <div className="audit-stat-card">
          <div className="audit-stat-icon audit-stat-server">
            <Server size={24} />
          </div>
          <div className="audit-stat-info">
            <div className="audit-stat-label">服务端审计记录</div>
            <div className="audit-stat-value">
              {serverAuditLog.length} 条
              <span className="audit-stat-sub">
                服务端实际落库操作记录
              </span>
            </div>
          </div>
        </div>
        <div className="audit-stat-card">
          <div className="audit-stat-icon audit-stat-client">
            <Monitor size={24} />
          </div>
          <div className="audit-stat-info">
            <div className="audit-stat-label">客户端审计记录</div>
            <div className="audit-stat-value">
              {clientAuditLog.length} 条
              <span className="audit-stat-sub">
                本地操作与状态变更记录
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="audit-simulate-section">
        <div className="audit-simulate-header">
          <h3 className="audit-section-title"><AlertCircle size={18} /> 冲突模拟测试工具</h3>
          <button
            className="audit-toggle-btn"
            onClick={() => setShowSimulate(!showSimulate)}
          >
            {showSimulate ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            {showSimulate ? '收起' : '展开'}
          </button>
        </div>
        {showSimulate && (
          <div className="audit-simulate-form">
            <p className="audit-simulate-desc">
              以下工具用于模拟多终端并发场景，验证确定性冲突检测机制的正确性。
            </p>
            <div className="audit-simulate-row">
              <select
                value={simulateEntityType}
                onChange={(e) => setSimulateEntityType(e.target.value)}
                className="audit-input"
              >
                <option value="record">访视记录 (record)</option>
                <option value="deviation">偏差记录 (deviation)</option>
                <option value="template">访视模板 (template)</option>
                <option value="center">研究中心 (center)</option>
              </select>
              <input
                type="text"
                value={simulateEntityId}
                onChange={(e) => setSimulateEntityId(e.target.value)}
                placeholder="输入实体ID"
                className="audit-input"
              />
              <input
                type="text"
                value={simulateModifierName}
                onChange={(e) => setSimulateModifierName(e.target.value)}
                placeholder="模拟修改人名称"
                className="audit-input"
              />
              <button className="audit-btn audit-btn-warn" onClick={handleSimulateConflict}>
                <RefreshCw size={14} /> 模拟服务端并发修改
              </button>
              <button className="audit-btn audit-btn-danger" onClick={handleSimulateDelete}>
                <XCircle size={14} /> 模拟服务端删除
              </button>
            </div>
            <div className="audit-simulate-tips">
              <p><strong>并发修改冲突测试步骤：</strong></p>
              <ol>
                <li>新增或修改一条访视记录，等待同步成功</li>
                <li>断开网络（或在此工具中执行「模拟服务端并发修改」）</li>
                <li>本地修改同一条记录的状态或其他字段</li>
                <li>恢复网络执行同步，将触发基于版本号的确定性冲突检测</li>
                <li>在冲突解决界面查看字段级对比，选择保留本地/服务端或手动合并</li>
              </ol>
            </div>
          </div>
        )}
      </div>

      <div className="audit-danger-section">
        <h3 className="audit-section-title"><XCircle size={18} style={{ color: '#dc2626' }} /> 危险操作</h3>
        <button
          className="audit-btn audit-btn-danger"
          onClick={() => {
            if (confirm('确定要清除所有同步数据吗？这将清空操作队列、冲突记录、客户端和服务端所有审计日志！')) {
              if (confirm('此操作不可恢复，确认继续？')) {
                clearAllSyncData();
                alert('所有同步数据已清除');
              }
            }
          }}
        >
          <XCircle size={14} /> 清除所有同步数据
        </button>
      </div>
    </div>
  );

  const renderServerLog = () => (
    <div className="audit-log-container">
      <div className="audit-filters">
        <div className="audit-filter-item">
          <Filter size={14} />
          <span>实体类型:</span>
          <select value={filterEntityType} onChange={(e) => setFilterEntityType(e.target.value)}>
            <option value="all">全部</option>
            <option value="record">访视记录</option>
            <option value="deviation">偏差记录</option>
            <option value="template">访视模板</option>
            <option value="center">研究中心</option>
          </select>
        </div>
        <div className="audit-filter-item">
          <span>操作类型:</span>
          <select value={filterOperationType} onChange={(e) => setFilterOperationType(e.target.value)}>
            <option value="all">全部</option>
            {Object.entries(OPERATION_TYPES).map(([key, val]) => (
              <option key={val} value={val}>{getOperationLabel(val)}</option>
            ))}
          </select>
        </div>
        <div className="audit-filter-item">
          <span>结果:</span>
          <select value={filterSuccess} onChange={(e) => setFilterSuccess(e.target.value)}>
            <option value="all">全部</option>
            <option value="success">成功</option>
            <option value="conflict">冲突</option>
            <option value="failed">失败</option>
          </select>
        </div>
        <div className="audit-filter-count">
          共 {filteredServerLog.length} 条记录
        </div>
      </div>

      <div className="audit-log-list">
        {filteredServerLog.length === 0 ? (
          <div className="audit-empty">暂无服务端审计记录</div>
        ) : (
          filteredServerLog.map((entry) => (
            <div key={entry.id} className="audit-log-entry">
              <div
                className="audit-log-entry-header"
                onClick={() => toggleExpand(entry.id)}
              >
                <div className="audit-log-expand-icon">
                  {expandedEntries.has(entry.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
                <div className={`audit-log-status ${entry.success ? 'success' : entry.conflict ? 'conflict' : 'failed'}`}>
                  {entry.success ? <CheckCircle size={14} /> : entry.conflict ? <AlertTriangle size={14} /> : <XCircle size={14} />}
                </div>
                <div className="audit-log-action">
                  <strong>{entry.action || getOperationLabel(entry.operationType)}</strong>
                  {entry.summary && <span className="audit-log-summary">{entry.summary}</span>}
                </div>
                <div className="audit-log-meta">
                  <span><Server size={12} /> 服务端操作 #{entry.serverOperationId}</span>
                  <span><User size={12} /> {entry.operator || entry.clientId}</span>
                  <span><Clock size={12} /> {formatTime(entry.timestamp)}</span>
                </div>
              </div>

              {expandedEntries.has(entry.id) && (
                <div className="audit-log-entry-detail">
                  <div className="audit-detail-grid">
                    <div className="audit-detail-item">
                      <label>实体类型</label>
                      <span>{entry.entityType}</span>
                    </div>
                    <div className="audit-detail-item">
                      <label>实体ID</label>
                      <span className="audit-mono">{entry.entityId}</span>
                    </div>
                    <div className="audit-detail-item">
                      <label>客户端ID</label>
                      <span className="audit-mono">{entry.clientId}</span>
                    </div>
                    <div className="audit-detail-item">
                      <label>客户端操作ID</label>
                      <span className="audit-mono">{entry.clientOperationId}</span>
                    </div>
                    {entry.baseVersion !== undefined && entry.baseVersion !== null && (
                      <div className="audit-detail-item">
                        <label>基础版本</label>
                        <span>v{entry.baseVersion}</span>
                      </div>
                    )}
                    {entry.resultVersion !== undefined && entry.resultVersion !== null && (
                      <div className="audit-detail-item">
                        <label>结果版本</label>
                        <span>v{entry.resultVersion}</span>
                      </div>
                    )}
                    {entry.oldVersion !== undefined && (
                      <div className="audit-detail-item">
                        <label>版本变更</label>
                        <span>v{entry.oldVersion} → v{entry.newVersion}</span>
                      </div>
                    )}
                    {entry.conflictType && (
                      <div className="audit-detail-item audit-detail-conflict">
                        <label>冲突类型</label>
                        <span className="audit-conflict-tag">{getConflictTypeLabel(entry.conflictType)}</span>
                      </div>
                    )}
                    {entry.conflictReason && (
                      <div className="audit-detail-item audit-detail-full">
                        <label>冲突原因</label>
                        <span className="audit-conflict-reason">{entry.conflictReason}</span>
                      </div>
                    )}
                    {entry.error && (
                      <div className="audit-detail-item audit-detail-full audit-detail-error">
                        <label>错误信息</label>
                        <span>{entry.error}</span>
                      </div>
                    )}
                    {entry.detail && (
                      <div className="audit-detail-item audit-detail-full">
                        <label>详情</label>
                        <span>{entry.detail}</span>
                      </div>
                    )}
                  </div>

                  {entry.fieldChanges && entry.fieldChanges.length > 0 && (
                    <div className="audit-field-changes">
                      <h4><FileText size={14} /> 字段变更详情 ({entry.fieldChanges.length} 项)</h4>
                      <table className="audit-field-table">
                        <thead>
                          <tr>
                            <th>字段名</th>
                            <th>变更前</th>
                            <th>变更后</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entry.fieldChanges.map((fc, idx) => (
                            <tr key={idx}>
                              <td className="audit-field-name">{fc.field}</td>
                              <td className="audit-field-old">{formatValue(fc.beforeValue)}</td>
                              <td className="audit-field-new">{formatValue(fc.afterValue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {entry.conflictFields && entry.conflictFields.length > 0 && (
                    <div className="audit-field-changes audit-conflict-fields">
                      <h4><AlertTriangle size={14} /> 冲突字段 ({entry.conflictFields.length} 项)</h4>
                      <table className="audit-field-table">
                        <thead>
                          <tr>
                            <th>字段名</th>
                            <th>本地值</th>
                            <th>服务端值</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entry.conflictFields.map((cf, idx) => (
                            <tr key={idx}>
                              <td className="audit-field-name">{cf.field}</td>
                              <td className="audit-field-local">{formatValue(cf.localValue)}</td>
                              <td className="audit-field-server">{formatValue(cf.serverValue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {entry.timelineEntry && (
                    <div className="audit-timeline-entry">
                      <h4><History size={14} /> 关联时间线条目</h4>
                      <div className="audit-timeline-content">
                        <p><strong>状态:</strong> {entry.timelineEntry.status}</p>
                        <p><strong>操作人:</strong> {entry.timelineEntry.by}</p>
                        <p><strong>时间:</strong> {formatTime(entry.timelineEntry.at)}</p>
                        {entry.timelineEntry.note && <p><strong>备注:</strong> {entry.timelineEntry.note}</p>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderClientLog = () => (
    <div className="audit-log-container">
      <div className="audit-filters">
        <div className="audit-filter-item">
          <Filter size={14} />
          <span>实体类型:</span>
          <select value={filterEntityType} onChange={(e) => setFilterEntityType(e.target.value)}>
            <option value="all">全部</option>
            <option value="record">访视记录</option>
            <option value="deviation">偏差记录</option>
            <option value="template">访视模板</option>
            <option value="center">研究中心</option>
          </select>
        </div>
        <div className="audit-filter-count">
          共 {filteredClientLog.length} 条记录
        </div>
      </div>

      <div className="audit-log-list">
        {filteredClientLog.length === 0 ? (
          <div className="audit-empty">暂无客户端审计记录</div>
        ) : (
          filteredClientLog.map((entry) => (
            <div key={entry.id} className="audit-log-entry">
              <div
                className="audit-log-entry-header"
                onClick={() => toggleExpand(entry.id)}
              >
                <div className="audit-log-expand-icon">
                  {expandedEntries.has(entry.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
                <div className="audit-log-status info">
                  <Monitor size={14} />
                </div>
                <div className="audit-log-action">
                  <strong>{entry.action}</strong>
                  {entry.detail && <span className="audit-log-summary">{entry.detail}</span>}
                </div>
                <div className="audit-log-meta">
                  <span><Monitor size={12} /> 客户端</span>
                  <span><Clock size={12} /> {formatTime(entry.timestamp)}</span>
                </div>
              </div>

              {expandedEntries.has(entry.id) && (
                <div className="audit-log-entry-detail">
                  <div className="audit-detail-grid">
                    {entry.operationId && (
                      <div className="audit-detail-item">
                        <label>操作ID</label>
                        <span className="audit-mono">{entry.operationId}</span>
                      </div>
                    )}
                    {entry.operationType && (
                      <div className="audit-detail-item">
                        <label>操作类型</label>
                        <span>{getOperationLabel(entry.operationType)}</span>
                      </div>
                    )}
                    {entry.entityType && (
                      <div className="audit-detail-item">
                        <label>实体类型</label>
                        <span>{entry.entityType}</span>
                      </div>
                    )}
                    {entry.entityId && (
                      <div className="audit-detail-item">
                        <label>实体ID</label>
                        <span className="audit-mono">{entry.entityId}</span>
                      </div>
                    )}
                    {entry.baseVersion !== undefined && entry.baseVersion !== null && (
                      <div className="audit-detail-item">
                        <label>基础版本</label>
                        <span>v{entry.baseVersion}</span>
                      </div>
                    )}
                    {entry.conflictId && (
                      <div className="audit-detail-item">
                        <label>冲突ID</label>
                        <span className="audit-mono">{entry.conflictId}</span>
                      </div>
                    )}
                    {entry.conflictType && (
                      <div className="audit-detail-item audit-detail-conflict">
                        <label>冲突类型</label>
                        <span className="audit-conflict-tag">{getConflictTypeLabel(entry.conflictType)}</span>
                      </div>
                    )}
                    {entry.resolution && (
                      <div className="audit-detail-item">
                        <label>解决方式</label>
                        <span>{entry.resolution}</span>
                      </div>
                    )}
                    {entry.errorMessage && (
                      <div className="audit-detail-item audit-detail-full audit-detail-error">
                        <label>错误信息</label>
                        <span>{entry.errorMessage}</span>
                      </div>
                    )}
                    {entry.retryCount !== undefined && (
                      <div className="audit-detail-item">
                        <label>重试次数</label>
                        <span>{entry.retryCount}</span>
                      </div>
                    )}
                    {entry.fieldChangeCount !== undefined && (
                      <div className="audit-detail-item">
                        <label>字段变更数</label>
                        <span>{entry.fieldChangeCount}</span>
                      </div>
                    )}
                    {entry.clearedCount !== undefined && (
                      <div className="audit-detail-item">
                        <label>清除记录数</label>
                        <span>{entry.clearedCount}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderAuditTrail = () => (
    <div className="audit-log-container">
      <p className="audit-empty">
        请在具体记录卡片上点击「查看审计追溯」查看该实体的完整操作历史，
        包含服务端落库记录和客户端操作记录的双向追溯时间线。
      </p>
      <div className="audit-trail-demo">
        <h4>审计追溯链路说明</h4>
        <ul>
          <li><strong>客户端层</strong>：记录所有本地操作入队、同步状态变更、冲突检测与解决、网络状态切换</li>
          <li><strong>服务端层</strong>：记录每次实际落库操作，包含版本号变化、字段级变更明细、操作人、时间戳</li>
          <li><strong>双向关联</strong>：每条服务端记录包含 <code>clientOperationId</code> 关联客户端操作ID</li>
          <li><strong>版本追踪</strong>：每个实体维护递增版本号 <code>_version</code>，每次修改版本号+1</li>
          <li><strong>快照机制</strong>：每次修改前保存 <code>beforeSnapshot</code>，支持完整数据回滚</li>
          <li><strong>时间线同步</strong>：状态流转的 timeline 条目同步到服务端时标记 <code>synced: true</code></li>
        </ul>
      </div>
    </div>
  );

  return (
    <div className="sync-modal-overlay" onClick={onClose}>
      <div className="sync-modal audit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sync-modal-header">
          <div className="sync-modal-title">
            <History size={20} />
            <h2>同步审计日志与追溯</h2>
          </div>
          <button className="sync-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="audit-tabs">
          <button
            className={`audit-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Shield size={16} /> 概览
          </button>
          <button
            className={`audit-tab ${activeTab === 'server' ? 'active' : ''}`}
            onClick={() => setActiveTab('server')}
          >
            <Server size={16} /> 服务端落库日志 ({serverAuditLog.length})
          </button>
          <button
            className={`audit-tab ${activeTab === 'client' ? 'active' : ''}`}
            onClick={() => setActiveTab('client')}
          >
            <Monitor size={16} /> 客户端操作日志 ({clientAuditLog.length})
          </button>
          <button
            className={`audit-tab ${activeTab === 'trail' ? 'active' : ''}`}
            onClick={() => setActiveTab('trail')}
          >
            <History size={16} /> 追溯链路说明
          </button>
        </div>

        <div className="sync-modal-body audit-modal-body">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'server' && renderServerLog()}
          {activeTab === 'client' && renderClientLog()}
          {activeTab === 'trail' && renderAuditTrail()}
        </div>
      </div>
    </div>
  );
}
