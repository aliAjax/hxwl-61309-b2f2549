import { useState } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertTriangle, CheckCircle, Loader2, Clock, XCircle, ChevronDown, ChevronUp, History } from 'lucide-react';
import { SYNC_STATUSES, OPERATION_STATUSES } from '../types';

export function SyncStatusBar({ syncState, startSync, retryAllFailed, clearSynced, getOpDescription, onOpenConflicts, onOpenOperations, onOpenAuditLog }) {
  const [expanded, setExpanded] = useState(false);

  const statusConfig = {
    [SYNC_STATUSES.ONLINE]: {
      icon: Wifi,
      label: '在线',
      className: 'sync-online',
    },
    [SYNC_STATUSES.OFFLINE]: {
      icon: WifiOff,
      label: '离线模式',
      className: 'sync-offline',
    },
    [SYNC_STATUSES.SYNCING]: {
      icon: Loader2,
      label: '同步中',
      className: 'sync-syncing',
    },
    [SYNC_STATUSES.ERROR]: {
      icon: AlertTriangle,
      label: '同步异常',
      className: 'sync-error',
    },
  };

  const config = statusConfig[syncState.syncStatus] || statusConfig[SYNC_STATUSES.OFFLINE];
  const StatusIcon = config.icon;

  const pendingOps = syncState.operationQueue.filter(op => op.status === OPERATION_STATUSES.PENDING);
  const failedOps = syncState.operationQueue.filter(op => op.status === OPERATION_STATUSES.FAILED);
  const syncingOps = syncState.operationQueue.filter(op => op.status === OPERATION_STATUSES.SYNCING);
  const conflictedOps = syncState.operationQueue.filter(op => op.status === OPERATION_STATUSES.CONFLICT);

  const formatTime = (ts) => {
    if (!ts) return '从未';
    try {
      return new Date(ts).toLocaleString('zh-CN', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return '从未';
    }
  };

  return (
    <div className={`sync-status-bar ${config.className}`}>
      <div className="sync-status-main" onClick={() => setExpanded(!expanded)}>
        <div className="sync-status-indicator">
          <StatusIcon size={16} className={syncState.syncStatus === SYNC_STATUSES.SYNCING ? 'spin' : ''} />
          <span className="sync-status-label">{config.label}</span>
        </div>

        <div className="sync-status-badges">
          {pendingOps.length > 0 && (
            <span className="sync-badge pending" title={`${pendingOps.length} 项待同步`}>
              <Clock size={12} />
              {pendingOps.length} 待同步
            </span>
          )}
          {syncingOps.length > 0 && (
            <span className="sync-badge syncing" title={`${syncingOps.length} 项同步中`}>
              <Loader2 size={12} className="spin" />
              {syncingOps.length} 同步中
            </span>
          )}
          {failedOps.length > 0 && (
            <span className="sync-badge failed" title={`${failedOps.length} 项同步失败`}>
              <XCircle size={12} />
              {failedOps.length} 失败
            </span>
          )}
          {syncState.conflictCount > 0 && (
            <span className="sync-badge conflict" title={`${syncState.conflictCount} 项冲突待处理`} onClick={(e) => { e.stopPropagation(); onOpenConflicts?.(); }}>
              <AlertTriangle size={12} />
              {syncState.conflictCount} 冲突
            </span>
          )}
        </div>

        <div className="sync-status-time">
          上次同步: {formatTime(syncState.lastSyncTime)}
        </div>

        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </div>

      {expanded && (
        <div className="sync-status-expanded">
          <div className="sync-status-actions">
            {syncState.syncStatus !== SYNC_STATUSES.OFFLINE && (
              <button type="button" className="sync-action-btn primary" onClick={(e) => { e.stopPropagation(); startSync(); }} disabled={syncState.syncStatus === SYNC_STATUSES.SYNCING}>
                <RefreshCw size={14} className={syncState.syncStatus === SYNC_STATUSES.SYNCING ? 'spin' : ''} />
                立即同步
              </button>
            )}
            {failedOps.length > 0 && (
              <button type="button" className="sync-action-btn" onClick={(e) => { e.stopPropagation(); retryAllFailed(); }}>
                <RefreshCw size={14} />
                重试全部失败 ({failedOps.length})
              </button>
            )}
            <button type="button" className="sync-action-btn" onClick={(e) => { e.stopPropagation(); onOpenOperations?.(); }}>
              <CheckCircle size={14} />
              查看操作队列 ({syncState.operationQueue.length})
            </button>
            <button type="button" className="sync-action-btn" onClick={(e) => { e.stopPropagation(); onOpenAuditLog?.(); }}>
              <History size={14} />
              审计日志与追溯
            </button>
            {syncState.conflictCount > 0 && (
              <button type="button" className="sync-action-btn danger" onClick={(e) => { e.stopPropagation(); onOpenConflicts?.(); }}>
                <AlertTriangle size={14} />
                处理冲突 ({syncState.conflictCount})
              </button>
            )}
            <button type="button" className="sync-action-btn ghost" onClick={(e) => { e.stopPropagation(); clearSynced(); }}>
              清除已同步记录
            </button>
          </div>

          {pendingOps.length > 0 && (
            <div className="sync-preview-list">
              <div className="sync-preview-title">待同步操作（最近5条）</div>
              {pendingOps.slice(0, 5).map(op => (
                <div key={op.id} className="sync-preview-item">
                  <span className="sync-preview-desc">{getOpDescription(op)}</span>
                  <span className="sync-preview-time">{formatTime(op.createdAt)}</span>
                </div>
              ))}
              {pendingOps.length > 5 && (
                <div className="sync-preview-more">...还有 {pendingOps.length - 5} 项</div>
              )}
            </div>
          )}

          {syncState.syncStatus === SYNC_STATUSES.OFFLINE && (
            <div className="sync-offline-hint">
              <WifiOff size={14} />
              当前处于离线状态，所有操作将在本地保存，恢复网络后自动同步。
              您可以正常使用所有功能，数据不会丢失。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
