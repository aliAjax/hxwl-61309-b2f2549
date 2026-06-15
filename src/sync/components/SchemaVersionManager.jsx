import { useState, useMemo } from 'react';
import {
  X, Tags, Upload, ArrowRight, Clock, User, CheckCircle, AlertTriangle,
  Database, History, RotateCcw, FileText, ChevronDown, ChevronRight,
  Play, Zap
} from 'lucide-react';

export function SchemaVersionManager({
  currentVersion,
  versionHistory,
  syncStatistics,
  serverAuditLog,
  enqueuePublishVersion,
  startSync,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState('publish');
  const [versionName, setVersionName] = useState('');
  const [versionDesc, setVersionDesc] = useState('');
  const [syncToRecords, setSyncToRecords] = useState(true);
  const [migrationId, setMigrationId] = useState('');
  const [migrationDesc, setMigrationDesc] = useState('');
  const [targetVersion, setTargetVersion] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [expandedVersion, setExpandedVersion] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const migrations = useMemo(() => {
    const migOps = serverAuditLog?.filter(
      e => e.operationType === 'execute_migration' || e.operationType === 'rollback_migration'
    ) || [];
    return migOps;
  }, [serverAuditLog]);

  const formatDateTime = (ts) => {
    if (!ts) return '-';
    try {
      return new Date(ts).toLocaleString('zh-CN');
    } catch {
      return ts;
    }
  };

  const handlePublish = () => {
    if (!versionName.trim() && !versionDesc.trim()) {
      if (!confirm('未填写版本名称和说明，确定继续发布吗？')) return;
    }
    enqueuePublishVersion({
      name: versionName.trim(),
      description: versionDesc.trim(),
      operator: operatorName.trim() || undefined,
      syncToRecords,
    });
    setVersionName('');
    setVersionDesc('');
    if (navigator.onLine) {
      startSync();
    }
  };

  const handleExecuteMigration = () => {
    alert('请在主界面的“版本管理与迁移”页预览影响后执行迁移，以便同步真实访视变更和迁移快照。');
  };

  const handleRollbackMigration = () => {
    alert('请在主界面的“版本管理与迁移”页从具体迁移记录发起回滚，以便同步真实回滚明细和审计链路。');
  };

  const toggleVersionExpand = (v) => {
    setExpandedVersion(expandedVersion === v ? null : v);
  };

  return (
    <div className="sync-modal-overlay" onClick={onClose}>
      <div className="sync-modal version-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sync-modal-header">
          <div className="sync-modal-title">
            <Tags size={20} />
            <h2>方案版本管理</h2>
          </div>
          <button className="sync-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="version-current-bar">
          <div className="version-current-info">
            <Tags size={24} className="version-current-icon" />
            <div>
              <div className="version-current-label">当前方案版本</div>
              <div className="version-current-value">v{currentVersion || 0}</div>
            </div>
          </div>
          <div className="version-stats">
            <div className="version-stat">
              <Database size={14} />
              <span>{syncStatistics?.database?.records || 0} 条访视记录</span>
            </div>
            <div className="version-stat">
              <History size={14} />
              <span>{versionHistory?.length || 0} 次发布</span>
            </div>
          </div>
        </div>

        <div className="version-tabs">
          <button
            className={`version-tab ${activeTab === 'publish' ? 'active' : ''}`}
            onClick={() => setActiveTab('publish')}
          >
            <Upload size={16} /> 发布新版本
          </button>
          <button
            className={`version-tab ${activeTab === 'migrate' ? 'active' : ''}`}
            onClick={() => setActiveTab('migrate')}
          >
            <Zap size={16} /> 迁移与回滚
          </button>
          <button
            className={`version-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={16} /> 发布历史
          </button>
        </div>

        <div className="sync-modal-body version-modal-body">
          {activeTab === 'publish' && (
            <div className="version-form">
              <div className="version-form-row">
                <label>
                  <span>版本名称</span>
                  <input
                    type="text"
                    value={versionName}
                    onChange={(e) => setVersionName(e.target.value)}
                    placeholder="如：V2.0 方案修订版"
                    className="version-input"
                  />
                </label>
              </div>

              <div className="version-form-row">
                <label>
                  <span>版本说明</span>
                  <textarea
                    value={versionDesc}
                    onChange={(e) => setVersionDesc(e.target.value)}
                    placeholder="描述本次方案变更的主要内容..."
                    className="version-input version-textarea"
                    rows={3}
                  />
                </label>
              </div>

              <div className="version-form-row">
                <label>
                  <span>操作人</span>
                  <input
                    type="text"
                    value={operatorName}
                    onChange={(e) => setOperatorName(e.target.value)}
                    placeholder="如：张三（可留空使用默认）"
                    className="version-input"
                  />
                </label>
              </div>

              <div className="version-form-row version-checkbox-row">
                <label className="version-checkbox">
                  <input
                    type="checkbox"
                    checked={syncToRecords}
                    onChange={(e) => setSyncToRecords(e.target.checked)}
                  />
                  <span>发布后将所有记录标记为新版本（_schemaVersion）</span>
                </label>
              </div>

              <div className="version-form-actions">
                <button className="version-btn version-btn-secondary" onClick={onClose}>
                  取消
                </button>
                <button className="version-btn version-btn-primary" onClick={handlePublish}>
                  <Upload size={16} />
                  发布新版本 v{(currentVersion || 0) + 1}
                </button>
              </div>

              <div className="version-hint">
                <AlertTriangle size={14} />
                <p>发布新版本将：</p>
                <ul>
                  <li>方案版本号 +1（v{currentVersion || 0} → v{(currentVersion || 0) + 1}）</li>
                  <li>{syncToRecords ? '所有访视/偏差/模板/中心记录的 _schemaVersion 更新为新版本' : '不更新现有记录的 schemaVersion 标记'}</li>
                  <li>完整记录发布人、发布时间、发布说明到服务端审计日志</li>
                  <li>操作加入同步队列，离线时本地生效，恢复网络后自动同步</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'migrate' && (
            <div className="version-form">
              <div className="version-form-row">
                <label>
                  <span>迁移ID</span>
                  <input
                    type="text"
                    value={migrationId}
                    onChange={(e) => setMigrationId(e.target.value)}
                    placeholder="如：migration_add_new_fields_202606"
                    className="version-input"
                  />
                </label>
              </div>

              <div className="version-form-row">
                <label>
                  <span>迁移说明</span>
                  <textarea
                    value={migrationDesc}
                    onChange={(e) => setMigrationDesc(e.target.value)}
                    placeholder="描述本次迁移的目的和内容..."
                    className="version-input version-textarea"
                    rows={2}
                  />
                </label>
              </div>

              <div className="version-form-row">
                <label>
                  <span>目标版本号（可选）</span>
                  <input
                    type="number"
                    value={targetVersion}
                    onChange={(e) => setTargetVersion(e.target.value)}
                    placeholder="执行/回滚后的方案版本号"
                    className="version-input"
                  />
                </label>
              </div>

              <div className="version-form-row">
                <label>
                  <span>操作人</span>
                  <input
                    type="text"
                    value={operatorName}
                    onChange={(e) => setOperatorName(e.target.value)}
                    placeholder="如：李四"
                    className="version-input"
                  />
                </label>
              </div>

              <div className="version-form-actions">
                <button className="version-btn version-btn-warn" onClick={handleRollbackMigration}>
                  <RotateCcw size={16} />
                  回滚迁移
                </button>
                <button className="version-btn version-btn-primary" onClick={handleExecuteMigration}>
                  <Play size={16} />
                  执行迁移
                </button>
              </div>

              <div className="version-hint version-hint-info">
                <FileText size={14} />
                <p>迁移操作说明：</p>
                <ul>
                  <li><strong>执行迁移</strong>：请在主版本页完成影响预览和策略选择后发起</li>
                  <li><strong>回滚迁移</strong>：请从主版本页的具体迁移记录发起</li>
                  <li>主版本页会把真实访视变更、迁移快照和回滚明细加入同步队列</li>
                  <li>同步成功后会完整记录到服务端审计日志</li>
                </ul>
              </div>

              {migrations.length > 0 && (
                <div className="version-migration-history">
                  <h4><History size={14} /> 最近迁移记录</h4>
                  <div className="version-migration-list">
                    {migrations.slice(0, 5).map((m, idx) => (
                      <div key={idx} className="version-migration-item">
                        <div className={`version-migration-type ${m.operationType === 'execute_migration' ? 'exec' : 'rollback'}`}>
                          {m.operationType === 'execute_migration' ? <Play size={12} /> : <RotateCcw size={12} />}
                          {m.operationType === 'execute_migration' ? '执行' : '回滚'}
                        </div>
                        <div className="version-migration-info">
                          <div className="version-migration-id">{m.summary || m.migrationDetails?.migrationId}</div>
                          <div className="version-migration-meta">
                            <User size={10} /> {m.operator || m.clientId}
                            <Clock size={10} /> {formatDateTime(m.timestamp)}
                          </div>
                        </div>
                        {m.afterSchemaVersion !== undefined && (
                          <div className="version-migration-version">
                            v{m.beforeSchemaVersion} <ArrowRight size={12} /> v{m.afterSchemaVersion}
                          </div>
                        )}
                        <div className={`version-migration-status ${m.success ? 'success' : 'failed'}`}>
                          {m.success ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                          {m.success ? '成功' : '失败'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="version-history">
              {versionHistory?.length === 0 ? (
                <div className="version-empty">
                  <Tags size={32} />
                  <p>暂无发布历史</p>
                </div>
              ) : (
                <div className="version-history-list">
                  {versionHistory.map((v, idx) => (
                    <div key={idx} className="version-history-item">
                      <div
                        className="version-history-header"
                        onClick={() => toggleVersionExpand(idx)}
                      >
                        <div className="version-history-expand">
                          {expandedVersion === idx ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>
                        <div className="version-history-version">
                          <Tags size={16} />
                          <strong>v{v.version}</strong>
                          {v.details?.name && <span className="version-history-name">{v.details.name}</span>}
                        </div>
                        <div className="version-history-meta">
                          <User size={12} /> {v.publishedBy || '系统'}
                          <Clock size={12} /> {formatDateTime(v.publishedAt)}
                        </div>
                      </div>

                      {expandedVersion === idx && (
                        <div className="version-history-detail">
                          {v.details?.description && (
                            <div className="version-history-desc">
                              <strong>版本说明：</strong>
                              <p>{v.details.description}</p>
                            </div>
                          )}
                          {v.summary && (
                            <div className="version-history-summary">
                              <strong>版本变更：</strong>
                              <span>{v.summary}</span>
                            </div>
                          )}
                          {v.affectedCounts && (
                            <div className="version-history-affected">
                              <strong>受影响实体：</strong>
                              <div className="version-affected-grid">
                                <div className="version-affected-item">
                                  <span className="version-affected-count">{v.affectedCounts.records || 0}</span>
                                  <span className="version-affected-label">条访视记录</span>
                                </div>
                                <div className="version-affected-item">
                                  <span className="version-affected-count">{v.affectedCounts.deviations || 0}</span>
                                  <span className="version-affected-label">条偏差记录</span>
                                </div>
                                <div className="version-affected-item">
                                  <span className="version-affected-count">{v.affectedCounts.templates || 0}</span>
                                  <span className="version-affected-label">个访视模板</span>
                                </div>
                                <div className="version-affected-item">
                                  <span className="version-affected-count">{v.affectedCounts.centers || 0}</span>
                                  <span className="version-affected-label">个研究中心</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
