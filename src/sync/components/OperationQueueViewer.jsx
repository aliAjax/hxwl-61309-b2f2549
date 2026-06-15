import { useState, useMemo } from 'react';
import { X, Clock, Loader2, CheckCircle, XCircle, AlertTriangle, RefreshCw, Trash2, History, User, FileText } from 'lucide-react';
import { OPERATION_STATUSES } from '../types';

const STATUS_CONFIG = {
  [OPERATION_STATUSES.PENDING]: {
    icon: Clock,
    label: '待同步',
    className: 'op-status-pending',
  },
  [OPERATION_STATUSES.SYNCING]: {
    icon: Loader2,
    label: '同步中',
    className: 'op-status-syncing',
  },
  [OPERATION_STATUSES.SYNCED]: {
    icon: CheckCircle,
    label: '已同步',
    className: 'op-status-synced',
  },
  [OPERATION_STATUSES.FAILED]: {
    icon: XCircle,
    label: '失败',
    className: 'op-status-failed',
  },
  [OPERATION_STATUSES.CONFLICT]: {
    icon: AlertTriangle,
    label: '冲突',
    className: 'op-status-conflict',
  },
};

const STATUS_FILTERS = [
  { key: 'all', label: '全部' },
  { key: OPERATION_STATUSES.PENDING, label: '待同步' },
  { key: OPERATION_STATUSES.SYNCING, label: '同步中' },
  { key: OPERATION_STATUSES.SYNCED, label: '已同步' },
  { key: OPERATION_STATUSES.FAILED, label: '失败' },
  { key: OPERATION_STATUSES.CONFLICT, label: '冲突' },
];

export function OperationQueueViewer({
  operationQueue,
  getOpDescription,
  retryOperation,
  retryAllFailed,
  clearSynced,
  onClose,
  onOpenConflicts,
}) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOp, setSelectedOp] = useState(null);

  const filteredOps = useMemo(() => {
    const sorted = [...operationQueue].sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) return b.order - a.order;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
    if (statusFilter === 'all') return sorted;
    return sorted.filter(op => op.status === statusFilter);
  }, [operationQueue, statusFilter]);

  const stats = useMemo(() => ({
    all: operationQueue.length,
    pending: operationQueue.filter(op => op.status === OPERATION_STATUSES.PENDING).length,
    syncing: operationQueue.filter(op => op.status === OPERATION_STATUSES.SYNCING).length,
    synced: operationQueue.filter(op => op.status === OPERATION_STATUSES.SYNCED).length,
    failed: operationQueue.filter(op => op.status === OPERATION_STATUSES.FAILED).length,
    conflict: operationQueue.filter(op => op.status === OPERATION_STATUSES.CONFLICT).length,
  }), [operationQueue]);

  const formatTime = (ts) => {
    if (!ts) return '-';
    try {
      return new Date(ts).toLocaleString('zh-CN');
    } catch {
      return ts;
    }
  };

  const formatData = (data) => {
    if (!data) return '-';
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  return (
    <div className="op-queue-modal">
      <div className="op-queue-header">
        <h2><History size={20} /> 同步操作队列 ({operationQueue.length})</h2>
        <button type="button" className="icon-btn" onClick={onClose}><X size={18} /></button>
      </div>

      <div className="op-queue-toolbar">
        <div className="op-queue-filters">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.key}
              type="button"
              className={`op-filter-btn ${statusFilter === f.key ? 'active' : ''}`}
              onClick={() => setStatusFilter(f.key)}
            >
              {f.label}
              <span className="op-filter-count">
                {f.key === 'all' ? stats.all : stats[f.key] || 0}
              </span>
            </button>
          ))}
        </div>
        <div className="op-queue-actions">
          {stats.failed > 0 && (
            <button type="button" className="op-toolbar-btn" onClick={retryAllFailed}>
              <RefreshCw size={14} /> 重试全部失败
            </button>
          )}
          {stats.conflict > 0 && (
            <button type="button" className="op-toolbar-btn danger" onClick={onOpenConflicts}>
              <AlertTriangle size={14} /> 处理冲突 ({stats.conflict})
            </button>
          )}
          {stats.synced > 0 && (
            <button type="button" className="op-toolbar-btn ghost" onClick={clearSynced}>
              <Trash2 size={14} /> 清除已同步
            </button>
          )}
        </div>
      </div>

      <div className="op-queue-body">
        <div className="op-queue-list">
          {filteredOps.length === 0 ? (
            <div className="op-queue-empty">
              <CheckCircle size={40} />
              <p>暂无{statusFilter !== 'all' ? `「${STATUS_CONFIG[statusFilter]?.label || ''}」` : ''}操作记录</p>
            </div>
          ) : (
            filteredOps.map(op => {
              const statusConf = STATUS_CONFIG[op.status] || STATUS_CONFIG[OPERATION_STATUSES.PENDING];
              const StatusIcon = statusConf.icon;
              return (
                <div
                  key={op.id}
                  className={`op-queue-item ${selectedOp?.id === op.id ? 'active' : ''} ${statusConf.className}`}
                  onClick={() => setSelectedOp(op)}
                >
                  <div className="op-item-status">
                    <StatusIcon size={16} className={op.status === OPERATION_STATUSES.SYNCING ? 'spin' : ''} />
                  </div>
                  <div className="op-item-main">
                    <div className="op-item-title">
                      <span className="op-item-desc">{getOpDescription(op)}</span>
                      <span className={`op-item-status-tag ${statusConf.className}`}>
                        {statusConf.label}
                      </span>
                    </div>
                    <div className="op-item-meta">
                      <span><FileText size={12} /> {op.entityType}</span>
                      <span><User size={12} /> {op.clientId?.slice(0, 12)}</span>
                      <span><Clock size={12} /> {formatTime(op.createdAt)}</span>
                    </div>
                    {op.lastError && (
                      <div className="op-item-error">
                        <XCircle size={12} />
                        {op.lastError.message} (重试 {op.retryCount} 次)
                      </div>
                    )}
                    {op.conflictInfo && (
                      <div className="op-item-conflict">
                        <AlertTriangle size={12} />
                        检测到冲突
                      </div>
                    )}
                  </div>
                  <div className="op-item-actions" onClick={(e) => e.stopPropagation()}>
                    {op.status === OPERATION_STATUSES.FAILED && (
                      <button type="button" className="op-item-btn" onClick={() => retryOperation(op.id)}>
                        <RefreshCw size={12} /> 重试
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {selectedOp && (
          <div className="op-queue-detail">
            <div className="op-detail-header">
              <h3>操作详情</h3>
              <span className={`op-detail-status ${STATUS_CONFIG[selectedOp.status]?.className}`}>
                {STATUS_CONFIG[selectedOp.status]?.label || selectedOp.status}
              </span>
            </div>

            <div className="op-detail-section">
              <div className="op-detail-row">
                <span className="op-detail-label">操作类型</span>
                <span className="op-detail-value">{getOpDescription(selectedOp)}</span>
              </div>
              <div className="op-detail-row">
                <span className="op-detail-label">实体类型</span>
                <span className="op-detail-value">{selectedOp.entityType}</span>
              </div>
              <div className="op-detail-row">
                <span className="op-detail-label">实体 ID</span>
                <span className="op-detail-value mono">{selectedOp.entityId}</span>
              </div>
              <div className="op-detail-row">
                <span className="op-detail-label">操作 ID</span>
                <span className="op-detail-value mono">{selectedOp.id}</span>
              </div>
              <div className="op-detail-row">
                <span className="op-detail-label">创建时间</span>
                <span className="op-detail-value">{formatTime(selectedOp.createdAt)}</span>
              </div>
              {selectedOp.syncedAt && (
                <div className="op-detail-row">
                  <span className="op-detail-label">同步时间</span>
                  <span className="op-detail-value">{formatTime(selectedOp.syncedAt)}</span>
                </div>
              )}
              {selectedOp.retryCount > 0 && (
                <div className="op-detail-row">
                  <span className="op-detail-label">重试次数</span>
                  <span className="op-detail-value">{selectedOp.retryCount}</span>
                </div>
              )}
            </div>

            <div className="op-detail-section">
              <h4>操作数据</h4>
              <pre className="op-detail-pre">{formatData(selectedOp.data)}</pre>
            </div>

            {selectedOp.beforeSnapshot && (
              <div className="op-detail-section">
                <h4>修改前快照</h4>
                <pre className="op-detail-pre">{formatData(selectedOp.beforeSnapshot)}</pre>
              </div>
            )}

            {selectedOp.lastError && (
              <div className="op-detail-section error">
                <h4><XCircle size={14} /> 错误信息</h4>
                <div className="op-detail-error">
                  <p><strong>消息：</strong>{selectedOp.lastError.message}</p>
                  <p><strong>时间：</strong>{formatTime(selectedOp.lastError.timestamp)}</p>
                </div>
              </div>
            )}

            {selectedOp.conflictInfo && (
              <div className="op-detail-section conflict">
                <h4><AlertTriangle size={14} /> 冲突信息</h4>
                <div className="op-detail-conflict">
                  <p><strong>冲突类型：</strong>{selectedOp.conflictInfo.conflictType}</p>
                  <p><strong>检测时间：</strong>{formatTime(selectedOp.conflictInfo.detectedAt)}</p>
                </div>
                {onOpenConflicts && (
                  <button type="button" className="primary" style={{ marginTop: 10 }} onClick={onOpenConflicts}>
                    <AlertTriangle size={14} /> 去处理冲突
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
