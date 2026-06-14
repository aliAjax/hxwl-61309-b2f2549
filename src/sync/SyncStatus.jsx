import { useState } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertTriangle, CheckCircle, XCircle, Loader2, Clock, Database, Cloud, CloudOff } from 'lucide-react';
import { useSyncStatus, useConflicts } from './hooks';
import { SYNC_STATUS } from './syncManager';

export function SyncStatusBar({ onOpenSyncPanel, onOpenConflictPanel }) {
  const sync = useSyncStatus();
  const [syncingAnim, setSyncingAnim] = useState(false);

  const handleSync = async (e) => {
    e.stopPropagation();
    if (syncingAnim) return;
    setSyncingAnim(true);
    try {
      await sync.triggerSync();
    } finally {
      setTimeout(() => setSyncingAnim(false), 500);
    }
  };

  const statusIcon = () => {
    if (!sync.isOnline) return <WifiOff size={16} />;
    if (sync.status === SYNC_STATUS.SYNCING || syncingAnim) return <Loader2 size={16} className="spin" />;
    if (sync.status === SYNC_STATUS.CONFLICT) return <AlertTriangle size={16} />;
    if (sync.status === SYNC_STATUS.ERROR) return <XCircle size={16} />;
    return <Wifi size={16} />;
  };

  const statusLabel = () => {
    if (!sync.isOnline) return '离线模式';
    if (sync.status === SYNC_STATUS.SYNCING || syncingAnim) return '同步中...';
    if (sync.status === SYNC_STATUS.CONFLICT) return `${sync.openConflicts} 个冲突待处理`;
    if (sync.status === SYNC_STATUS.ERROR) return '同步失败';
    if (sync.pendingOperations > 0) return `${sync.pendingOperations} 项待同步`;
    return '已同步';
  };

  const statusClass = !sync.isOnline
    ? 'sync-offline'
    : sync.status === SYNC_STATUS.CONFLICT
      ? 'sync-conflict'
      : sync.status === SYNC_STATUS.ERROR
        ? 'sync-error'
        : sync.pendingOperations > 0 || sync.status === SYNC_STATUS.SYNCING
          ? 'sync-pending'
          : 'sync-online';

  return (
    <div className={`sync-status-bar ${statusClass}`} onClick={onOpenSyncPanel}>
      <div className="sync-status-main">
        <span className="sync-status-icon">{statusIcon()}</span>
        <span className="sync-status-label">{statusLabel()}</span>
      </div>
      <div className="sync-status-actions" onClick={(e) => e.stopPropagation()}>
        {sync.openConflicts > 0 && (
          <button
            type="button"
            className="sync-mini-btn conflict"
            onClick={onOpenConflictPanel}
            title="查看冲突"
          >
            <AlertTriangle size={14} />
            <span>{sync.openConflicts}</span>
          </button>
        )}
        {sync.failedOperations > 0 && (
          <button
            type="button"
            className="sync-mini-btn error"
            onClick={sync.retryFailed}
            title={`重试 ${sync.failedOperations} 个失败操作`}
          >
            <RefreshCw size={14} />
            <span>{sync.failedOperations}</span>
          </button>
        )}
        <button
          type="button"
          className="sync-mini-btn sync"
          onClick={handleSync}
          disabled={!sync.isOnline || syncingAnim}
          title="立即同步"
        >
          <RefreshCw size={14} className={syncingAnim ? 'spin' : ''} />
        </button>
      </div>
    </div>
  );
}

export function SyncPanel({ onClose }) {
  const sync = useSyncStatus();
  const conflicts = useConflicts();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await sync.triggerSync();
    } finally {
      setTimeout(() => setSyncing(false), 500);
    }
  };

  const formatTime = (t) => {
    if (!t) return '从未';
    try {
      return new Date(t).toLocaleString('zh-CN');
    } catch {
      return t;
    }
  };

  return (
    <div className="sync-panel-overlay" onClick={onClose}>
      <div className="sync-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sync-panel-head">
          <h3><Database size={20} /> 同步状态</h3>
          <button type="button" className="panel-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="sync-status-grid">
          <div className="sync-status-item">
            <div className={`ssi-icon ${sync.isOnline ? 'online' : 'offline'}`}>
              {sync.isOnline ? <Cloud size={20} /> : <CloudOff size={20} />}
            </div>
            <div>
              <span className="ssi-label">网络状态</span>
              <strong className="ssi-value">{sync.isOnline ? '在线' : '离线'}</strong>
            </div>
          </div>

          <div className="sync-status-item">
            <div className="ssi-icon pending">
              <Clock size={20} />
            </div>
            <div>
              <span className="ssi-label">待同步操作</span>
              <strong className="ssi-value">{sync.pendingOperations}</strong>
            </div>
          </div>

          <div className="sync-status-item">
            <div className="ssi-icon conflict">
              <AlertTriangle size={20} />
            </div>
            <div>
              <span className="ssi-label">未解决冲突</span>
              <strong className="ssi-value">{sync.openConflicts}</strong>
            </div>
          </div>

          <div className="sync-status-item">
            <div className="ssi-icon error">
              <XCircle size={20} />
            </div>
            <div>
              <span className="ssi-label">同步失败</span>
              <strong className="ssi-value">{sync.failedOperations}</strong>
            </div>
          </div>
        </div>

        <div className="sync-info-row">
          <span>上次同步时间：</span>
          <strong>{formatTime(sync.lastSyncAt)}</strong>
        </div>

        <div className="sync-info-row">
          <span>操作日志总数：</span>
          <strong>{sync.totalOperations}</strong>
        </div>

        <div className="sync-actions-row">
          <button
            type="button"
            className="primary"
            onClick={handleSync}
            disabled={!sync.isOnline || syncing}
          >
            <RefreshCw size={16} className={syncing ? 'spin' : ''} />
            {syncing ? '同步中...' : '立即同步'}
          </button>
          {sync.failedOperations > 0 && (
            <button
              type="button"
              className="secondary-btn"
              onClick={sync.retryFailed}
            >
              重试失败 ({sync.failedOperations})
            </button>
          )}
        </div>

        {conflicts.conflicts.length > 0 && (
          <div className="sync-conflict-preview">
            <h4>最近冲突</h4>
            <div className="conflict-preview-list">
              {conflicts.conflicts.slice(0, 3).map(c => (
                <div key={c.conflictId} className="conflict-preview-item">
                  <AlertTriangle size={14} />
                  <div>
                    <span className="cpi-type">{c.conflictType}</span>
                    <span className="cpi-entity">{c.entityType} · {c.entityId.slice(0, 12)}...</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="sync-footer-hint">
          <CheckCircle size={14} />
          <span>断网时所有操作保存在本地，恢复网络后自动按顺序同步</span>
        </div>
      </div>
    </div>
  );
}
