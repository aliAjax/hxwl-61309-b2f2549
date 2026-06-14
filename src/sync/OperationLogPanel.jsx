import { useState, useMemo } from 'react';
import { History, Clock, User, CheckCircle, XCircle, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Filter, Search } from 'lucide-react';
import { useOperationLog, useAuditLog } from './hooks';
import { OPERATION_TYPES, OPERATION_STATUS, ENTITY_TYPES } from './operationLog';

function getOpTypeLabel(type) {
  const m = {
    [OPERATION_TYPES.CREATE]: '新增',
    [OPERATION_TYPES.UPDATE]: '编辑',
    [OPERATION_TYPES.DELETE]: '删除',
  };
  return m[type] || type;
}

function getOpStatusLabel(status) {
  const m = {
    [OPERATION_STATUS.PENDING]: '待同步',
    [OPERATION_STATUS.IN_PROGRESS]: '同步中',
    [OPERATION_STATUS.SYNCED]: '已同步',
    [OPERATION_STATUS.FAILED]: '失败',
    [OPERATION_STATUS.CONFLICT]: '冲突',
    [OPERATION_STATUS.CANCELLED]: '已取消',
  };
  return m[status] || status;
}

function getOpStatusClass(status) {
  const m = {
    [OPERATION_STATUS.PENDING]: 'op-status-pending',
    [OPERATION_STATUS.IN_PROGRESS]: 'op-status-progress',
    [OPERATION_STATUS.SYNCED]: 'op-status-synced',
    [OPERATION_STATUS.FAILED]: 'op-status-failed',
    [OPERATION_STATUS.CONFLICT]: 'op-status-conflict',
    [OPERATION_STATUS.CANCELLED]: 'op-status-cancelled',
  };
  return m[status] || '';
}

function getOpTypeIcon(type) {
  if (type === OPERATION_TYPES.CREATE) return <CheckCircle size={12} />;
  if (type === OPERATION_TYPES.DELETE) return <XCircle size={12} />;
  return <RefreshCw size={12} />;
}

function OpLogItem({ op }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`op-log-item ${getOpStatusClass(op.status)}`}>
      <div className="op-log-head" onClick={() => setExpanded(!expanded)}>
        <div className="op-log-title">
          <span className={`op-type-badge op-type-${op.operationType}`}>
            {getOpTypeIcon(op.operationType)}
            {getOpTypeLabel(op.operationType)}
          </span>
          <span className="op-entity">{op.entityType}</span>
          <span className="op-entity-id">{op.entityId.slice(0, 16)}...</span>
          <span className={`op-status-tag ${getOpStatusClass(op.status)}`}>
            {getOpStatusLabel(op.status)}
          </span>
        </div>
        <div className="op-log-meta">
          <Clock size={12} />
          <span>{new Date(op.timestamp).toLocaleString('zh-CN')}</span>
          {op.operator && <><User size={12} /><span>{op.operator}</span></>}
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {expanded && (
        <div className="op-log-detail">
          <div className="op-log-row">
            <span className="op-label">操作ID</span>
            <code className="op-mono">{op.opId}</code>
          </div>
          <div className="op-log-row">
            <span className="op-label">重试次数</span>
            <span>{op.retryCount || 0}</span>
          </div>
          {op.syncedAt && (
            <div className="op-log-row">
              <span className="op-label">同步时间</span>
              <span>{new Date(op.syncedAt).toLocaleString('zh-CN')}</span>
            </div>
          )}
          {op.lastError && (
            <div className="op-log-row op-error">
              <AlertTriangle size={14} />
              <span>{op.lastError}</span>
            </div>
          )}
          {op.data && Object.keys(op.data).length > 0 && (
            <div className="op-log-section">
              <span className="op-section-title">变更数据</span>
              <pre className="op-json">{JSON.stringify(op.data, null, 2)}</pre>
            </div>
          )}
          {op.previousData && (
            <div className="op-log-section">
              <span className="op-section-title">变更前快照</span>
              <pre className="op-json">{JSON.stringify(op.previousData, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function OperationLogPanel({ onClose }) {
  const { operations, loading } = useOperationLog();
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return operations.filter(op => {
      if (statusFilter !== 'all' && op.status !== statusFilter) return false;
      if (typeFilter !== 'all' && op.operationType !== typeFilter) return false;
      if (entityFilter !== 'all' && op.entityType !== entityFilter) return false;
      if (search && !(`${op.entityId} ${op.opId} ${JSON.stringify(op.data || {})}`.toLowerCase().includes(search.toLowerCase()))) return false;
      return true;
    });
  }, [operations, statusFilter, typeFilter, entityFilter, search]);

  return (
    <div className="sync-panel-overlay" onClick={onClose}>
      <div className="sync-panel oplog-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sync-panel-head">
          <h3><History size={20} /> 操作日志</h3>
          <button type="button" className="panel-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="oplog-filters">
          <div className="oplog-search">
            <Search size={14} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索实体ID或数据..."
            />
          </div>
          <div className="oplog-filter-row">
            <Filter size={14} />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">全部状态</option>
              <option value={OPERATION_STATUS.PENDING}>待同步</option>
              <option value={OPERATION_STATUS.SYNCED}>已同步</option>
              <option value={OPERATION_STATUS.FAILED}>失败</option>
              <option value={OPERATION_STATUS.CONFLICT}>冲突</option>
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">全部操作</option>
              <option value={OPERATION_TYPES.CREATE}>新增</option>
              <option value={OPERATION_TYPES.UPDATE}>编辑</option>
              <option value={OPERATION_TYPES.DELETE}>删除</option>
            </select>
            <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}>
              <option value="all">全部实体</option>
              <option value={ENTITY_TYPES.RECORD}>访视记录</option>
              <option value={ENTITY_TYPES.DEVIATION}>偏差</option>
              <option value={ENTITY_TYPES.TEMPLATE}>模板</option>
              <option value={ENTITY_TYPES.CENTER}>中心</option>
            </select>
          </div>
        </div>

        <div className="oplog-stats">
          显示 {filtered.length} / {operations.length} 条操作
        </div>

        <div className="oplog-list">
          {loading && <div className="sync-loading">加载中...</div>}
          {!loading && filtered.length === 0 && (
            <div className="conflict-empty">
              <History size={32} />
              <p>暂无操作记录</p>
            </div>
          )}
          {!loading && filtered.map(op => (
            <OpLogItem key={op.opId} op={op} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AuditItem({ audit }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="audit-item">
      <div className="audit-head" onClick={() => setExpanded(!expanded)}>
        <div className="audit-title">
          <strong>{audit.action}</strong>
          {audit.target && <span className="audit-target">→ {audit.target?.slice(0, 12)}...</span>}
        </div>
        <div className="audit-meta">
          <Clock size={12} />
          <span>{new Date(audit.timestamp).toLocaleString('zh-CN')}</span>
          {audit.operator && <><User size={12} /><span>{audit.operator}</span></>}
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>
      <div className="audit-detail-row">
        {audit.detail && <span className="audit-detail">{audit.detail}</span>}
      </div>
      {expanded && (
        <div className="audit-detail-full">
          {Object.entries(audit).filter(([k]) => !['id', 'timestamp', 'action', 'target', 'operator', 'detail'].includes(k)).map(([k, v]) => (
            <div key={k} className="op-log-row">
              <span className="op-label">{k}</span>
              <span>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AuditLogPanel({ onClose }) {
  const { audits, loading } = useAuditLog();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return audits;
    return audits.filter(a =>
      `${a.action} ${a.detail || ''} ${a.target || ''} ${a.operator || ''}`.toLowerCase().includes(search.toLowerCase())
    );
  }, [audits, search]);

  return (
    <div className="sync-panel-overlay" onClick={onClose}>
      <div className="sync-panel audit-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sync-panel-head">
          <h3><ShieldCheckIcon size={20} /> 审计日志</h3>
          <button type="button" className="panel-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="oplog-filters">
          <div className="oplog-search">
            <Search size={14} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索审计记录..."
            />
          </div>
        </div>

        <div className="oplog-stats">
          显示 {filtered.length} / {audits.length} 条记录
        </div>

        <div className="oplog-list">
          {loading && <div className="sync-loading">加载中...</div>}
          {!loading && filtered.length === 0 && (
            <div className="conflict-empty">
              <History size={32} />
              <p>暂无审计记录</p>
            </div>
          )}
          {!loading && filtered.map(a => (
            <AuditItem key={a.id} audit={a} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ShieldCheckIcon({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
