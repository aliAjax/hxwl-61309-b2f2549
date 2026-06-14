import { useState, useMemo } from 'react';
import { AlertTriangle, CheckCircle, XCircle, ArrowLeftRight, User, Server, Merge, Trash2, Check, ChevronDown, ChevronUp, Clock, ShieldCheck } from 'lucide-react';
import { useConflicts } from './hooks';
import { CONFLICT_STATUS, getConflictTypeLabel, getConflictStatusLabel, getConflictStatusClass } from './conflictEngine';
import { OPERATION_TYPES } from './operationLog';

function formatValue(val) {
  if (val === null || val === undefined) return <em className="val-empty">（空）</em>;
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val, null, 0);
    } catch {
      return String(val);
    }
  }
  if (val === '') return <em className="val-empty">（空字符串）</em>;
  return String(val);
}

function ConflictDiffView({ conflict }) {
  const [expanded, setExpanded] = useState(true);

  if (!conflict.fieldDiffs || conflict.fieldDiffs.length === 0) {
    return (
      <div className="conflict-no-diff">
        <AlertTriangle size={16} />
        <span>{conflict.description || '发生冲突，需要人工确认'}</span>
      </div>
    );
  }

  return (
    <div className="conflict-diff-view">
      <button
        type="button"
        className="diff-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        <span>字段差异对比 ({conflict.fieldDiffs.length})</span>
      </button>

      {expanded && (
        <div className="diff-table">
          <div className="diff-row diff-header">
            <span className="diff-field">字段</span>
            {conflict.conflictingFields ? (
              <>
                <span className="diff-col diff-base"><ShieldCheck size={12} /> 基线</span>
                <span className="diff-col diff-local"><User size={12} /> 本地</span>
                <span className="diff-col diff-remote"><Server size={12} /> 服务端</span>
              </>
            ) : (
              <>
                <span className="diff-col diff-old">变更前</span>
                <span className="diff-col diff-new">变更后</span>
              </>
            )}
          </div>

          {conflict.fieldDiffs.map((diff, idx) => (
            <div key={idx} className="diff-row">
              <span className="diff-field"><strong>{diff.label}</strong><br /><em>{diff.field}</em></span>
              {conflict.conflictingFields ? (
                <>
                  <span className="diff-col diff-base">{formatValue(diff.base)}</span>
                  <span className="diff-col diff-local">{formatValue(diff.local)}</span>
                  <span className="diff-col diff-remote">{formatValue(diff.remote)}</span>
                </>
              ) : (
                <>
                  <span className="diff-col diff-old">{formatValue(diff.old)}</span>
                  <span className="diff-col diff-new">{formatValue(diff.new)}</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConflictCard({ conflict, onResolve, onAutoMerge }) {
  const [resolving, setResolving] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualChoice, setManualChoice] = useState({});

  const isOpen = conflict.status === CONFLICT_STATUS.OPEN;
  const op = conflict.localOperation;

  const handleResolve = async (choice, choiceLabel) => {
    if (!confirm(`确认${choiceLabel}？此操作将记录在审计日志中。`)) return;
    setResolving(true);
    try {
      let resolution;
      if (choice === 'local') {
        resolution = { status: CONFLICT_STATUS.RESOLVED_LOCAL, data: { choice: 'local' } };
      } else if (choice === 'remote') {
        resolution = { status: CONFLICT_STATUS.RESOLVED_REMOTE, data: { choice: 'remote' } };
      } else if (choice === 'discard') {
        resolution = { status: CONFLICT_STATUS.DISCARDED, data: { choice: 'discard' } };
      } else if (choice === 'manual') {
        const mergedEntity = conflict.conflictingFields
          ? { ...conflict.remoteEntity, ...Object.fromEntries(Object.entries(manualChoice).map(([k, v]) => [k, v === 'local' ? conflict.conflictingFields[k].local : conflict.conflictingFields[k].remote])) }
          : conflict.localEntity;
        resolution = { status: CONFLICT_STATUS.RESOLVED_MANUAL, mergedEntity, data: { fieldChoices: manualChoice } };
      }
      await onResolve(conflict.conflictId, resolution);
    } finally {
      setResolving(false);
      setShowManual(false);
    }
  };

  const handleAutoMerge = async () => {
    setResolving(true);
    try {
      const result = await onAutoMerge(conflict.conflictId);
      if (!result.success) {
        alert(`部分字段无法自动合并：${result.needsManual?.join(', ') || '未知原因'}，请手动选择`);
        setShowManual(true);
      }
    } finally {
      setResolving(false);
    }
  };

  const operationDesc = () => {
    if (!op) return '未知操作';
    const opMap = {
      [OPERATION_TYPES.CREATE]: '新增',
      [OPERATION_TYPES.UPDATE]: '编辑',
      [OPERATION_TYPES.DELETE]: '删除',
    };
    return opMap[op.operationType] || op.operationType;
  };

  return (
    <div className={`conflict-card ${isOpen ? 'is-open' : 'is-resolved'} ${getConflictStatusClass(conflict.status)}`}>
      <div className="conflict-card-head">
        <div className="conflict-card-title">
          <AlertTriangle size={18} className="conflict-icon" />
          <div>
            <h4>
              {getConflictTypeLabel(conflict.conflictType)}
              <span className={`conflict-status-badge ${getConflictStatusClass(conflict.status)}`}>
                {getConflictStatusLabel(conflict.status)}
              </span>
            </h4>
            <p>
              <span className="meta-tag">{conflict.entityType}</span>
              <span className="meta-tag">{operationDesc()}</span>
              <span className="meta-mono">{conflict.entityId}</span>
              {op?.operator && <span className="meta-tag">操作人: {op.operator}</span>}
            </p>
          </div>
        </div>
        <div className="conflict-card-time">
          <Clock size={12} />
          <span>{new Date(conflict.detectedAt).toLocaleString('zh-CN')}</span>
        </div>
      </div>

      <div className="conflict-desc">
        <strong>冲突说明：</strong>{conflict.description}
      </div>

      <ConflictDiffView conflict={conflict} />

      {isOpen && (
        <div className="conflict-actions">
          {conflict.conflictType !== 'edit_then_delete' && (
            <button
              type="button"
              className="resolve-btn resolve-local"
              onClick={() => handleResolve('local', '采用本地版本')}
              disabled={resolving}
            >
              <User size={14} /> 采用本地
            </button>
          )}
          {conflict.conflictType !== 'delete_then_edit' && (
            <button
              type="button"
              className="resolve-btn resolve-remote"
              onClick={() => handleResolve('remote', '采用服务端版本')}
              disabled={resolving}
            >
              <Server size={14} /> 采用服务端
            </button>
          )}
          {conflict.conflictingFields && (
            <button
              type="button"
              className="resolve-btn resolve-merge"
              onClick={handleAutoMerge}
              disabled={resolving}
            >
              <Merge size={14} /> 智能合并
            </button>
          )}
          {conflict.conflictingFields && (
            <button
              type="button"
              className="resolve-btn resolve-manual"
              onClick={() => setShowManual(!showManual)}
              disabled={resolving}
            >
              <ArrowLeftRight size={14} /> 逐字段选择
            </button>
          )}
          <button
            type="button"
            className="resolve-btn resolve-discard"
            onClick={() => handleResolve('discard', '丢弃本地操作')}
            disabled={resolving}
          >
            <Trash2 size={14} /> 丢弃本地
          </button>
        </div>
      )}

      {showManual && conflict.conflictingFields && (
        <div className="manual-resolve">
          <h5>逐字段选择保留版本</h5>
          <div className="manual-fields">
            {Object.entries(conflict.conflictingFields).map(([key, vals]) => (
              <div key={key} className="manual-field-row">
                <span className="mf-label">{vals.label || key}</span>
                <div className="mf-options">
                  <label>
                    <input
                      type="radio"
                      name={`mf_${conflict.conflictId}_${key}`}
                      checked={manualChoice[key] === 'local'}
                      onChange={() => setManualChoice({ ...manualChoice, [key]: 'local' })}
                    />
                    <span className="mf-opt mf-local">
                      <User size={12} /> 本地：{formatValue(vals.local)}
                    </span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name={`mf_${conflict.conflictId}_${key}`}
                      checked={manualChoice[key] === 'remote'}
                      onChange={() => setManualChoice({ ...manualChoice, [key]: 'remote' })}
                    />
                    <span className="mf-opt mf-remote">
                      <Server size={12} /> 服务端：{formatValue(vals.remote)}
                    </span>
                  </label>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="primary small"
            onClick={() => handleResolve('manual', '应用逐字段选择')}
            disabled={Object.keys(manualChoice).length < Object.keys(conflict.conflictingFields).length}
          >
            <Check size={14} /> 确认选择并解决
          </button>
        </div>
      )}

      {!isOpen && (
        <div className="conflict-resolved-info">
          <CheckCircle size={14} />
          <span>
            已解决：{getConflictStatusLabel(conflict.status)}
            {conflict.resolvedBy && ` · 处理人: ${conflict.resolvedBy}`}
            {conflict.resolvedAt && ` · ${new Date(conflict.resolvedAt).toLocaleString('zh-CN')}`}
          </span>
        </div>
      )}
    </div>
  );
}

export function ConflictPanel({ onClose }) {
  const { conflicts, loading, resolveConflict, autoMerge } = useConflicts();
  const [filter, setFilter] = useState('open');

  const filteredConflicts = useMemo(() => {
    if (filter === 'all') return conflicts;
    if (filter === 'open') return conflicts.filter(c => c.status === CONFLICT_STATUS.OPEN);
    return conflicts.filter(c => c.status !== CONFLICT_STATUS.OPEN);
  }, [conflicts, filter]);

  const openCount = conflicts.filter(c => c.status === CONFLICT_STATUS.OPEN).length;
  const resolvedCount = conflicts.length - openCount;

  return (
    <div className="sync-panel-overlay" onClick={onClose}>
      <div className="sync-panel conflict-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sync-panel-head">
          <h3><AlertTriangle size={20} /> 冲突管理</h3>
          <button type="button" className="panel-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="conflict-stats-row">
          <div className="conflict-stat">
            <strong>{openCount}</strong>
            <span>待处理</span>
          </div>
          <div className="conflict-stat resolved">
            <strong>{resolvedCount}</strong>
            <span>已处理</span>
          </div>
          <div className="conflict-stat total">
            <strong>{conflicts.length}</strong>
            <span>总计</span>
          </div>
        </div>

        <div className="conflict-filter-tabs">
          <button
            type="button"
            className={`cf-tab ${filter === 'open' ? 'active' : ''}`}
            onClick={() => setFilter('open')}
          >
            待处理 ({openCount})
          </button>
          <button
            type="button"
            className={`cf-tab ${filter === 'resolved' ? 'active' : ''}`}
            onClick={() => setFilter('resolved')}
          >
            已解决 ({resolvedCount})
          </button>
          <button
            type="button"
            className={`cf-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            全部 ({conflicts.length})
          </button>
        </div>

        <div className="conflict-list">
          {loading && <div className="sync-loading">加载中...</div>}
          {!loading && filteredConflicts.length === 0 && (
            <div className="conflict-empty">
              <CheckCircle size={32} />
              <p>
                {filter === 'open' ? '暂无待处理冲突' : filter === 'resolved' ? '暂无已解决冲突' : '暂无冲突记录'}
              </p>
            </div>
          )}
          {!loading && filteredConflicts.map(c => (
            <ConflictCard
              key={c.conflictId}
              conflict={c}
              onResolve={resolveConflict}
              onAutoMerge={autoMerge}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
