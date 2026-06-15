import { useState, useMemo } from 'react';
import {
  AlertTriangle, X, ArrowLeftRight, Check, ShieldCheck, User, Clock,
  FileText, RefreshCw, ChevronRight, Trash2, Tags, AlertCircle,
  Database, RotateCcw
} from 'lucide-react';
import { CONFLICT_TYPES } from '../types';

const FIELD_LABELS = {
  subjectNo: '受试者编号',
  group: '试验分组',
  enrollDate: '入组日期',
  visitName: '访视名称',
  windowDays: '窗口天数',
  items: '检查项目',
  deviation: '偏差记录',
  status: '访视状态',
  plannedDate: '计划访视日期',
  plannedDays: '计划天数',
  actualDate: '实际完成日期',
  title: '标题',
  description: '详细描述',
  severity: '严重程度',
  type: '偏差类型',
  reportedBy: '报告人',
  resolution: '处理措施',
  name: '名称',
  code: '编码',
  pi: 'PI姓名',
  location: '地点',
};

export function ConflictResolver({ conflicts, resolveConflict, getConflictTypeLabel, computeFieldDiffs, onClose }) {
  const [selectedConflictId, setSelectedConflictId] = useState(null);
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeData, setMergeData] = useState({});

  const pendingConflicts = useMemo(() =>
    conflicts.filter(c => c.status === 'pending'),
    [conflicts]
  );

  const selectedConflict = useMemo(() =>
    pendingConflicts.find(c => c.id === selectedConflictId) || pendingConflicts[0] || null,
    [pendingConflicts, selectedConflictId]
  );

  const conflictCategory = useMemo(() => {
    if (!selectedConflict) return 'normal';
    switch (selectedConflict.conflictType) {
      case CONFLICT_TYPES.DELETE_THEN_EDIT:
        return 'deleteThenEdit';
      case CONFLICT_TYPES.VERSION_CHANGED:
        return 'versionChanged';
      case CONFLICT_TYPES.RECORD_NOT_FOUND:
        return 'recordNotFound';
      default:
        return 'normal';
    }
  }, [selectedConflict]);

  const localData = selectedConflict?.localVersion?.data;
  const serverData = conflictCategory === 'deleteThenEdit' ? null : (selectedConflict?.serverVersion);
  const deletedSnapshot = selectedConflict?.deletedSnapshot || selectedConflict?.localVersion?.snapshot;

  const diffs = useMemo(() => {
    if (!selectedConflict) return [];
    if (conflictCategory === 'deleteThenEdit') {
      const fullLocal = { ...(deletedSnapshot || {}), ...(localData || {}) };
      const allKeys = new Set([
        ...Object.keys(fullLocal || {}),
        ...Object.keys(localData || {}),
      ]);
      const result = [];
      allKeys.forEach(key => {
        if (key.startsWith('_') || key === 'id' || key === 'timeline') return;
        const snapVal = deletedSnapshot?.[key];
        const localVal = localData?.[key];
        if (JSON.stringify(snapVal) !== JSON.stringify(localVal)) {
          result.push({
            field: key,
            localValue: localVal,
            serverValue: null,
            snapshotValue: snapVal,
          });
        }
      });
      return result;
    }
    return computeFieldDiffs(localData, serverData);
  }, [selectedConflict, computeFieldDiffs, conflictCategory, localData, serverData, deletedSnapshot]);

  const formatValue = (val) => {
    if (val === null || val === undefined) return '-';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  const getFieldLabel = (field) => FIELD_LABELS[field] || field;

  const handleChooseLocal = () => {
    if (!selectedConflict) return;
    resolveConflict(selectedConflict.id, 'keep_local');
    setSelectedConflictId(null);
    setMergeMode(false);
    setMergeData({});
  };

  const handleChooseServer = () => {
    if (!selectedConflict) return;
    resolveConflict(selectedConflict.id, 'keep_server');
    setSelectedConflictId(null);
    setMergeMode(false);
    setMergeData({});
  };

  const handleStartMerge = () => {
    if (!selectedConflict) return;
    const initialMerge = {};
    diffs.forEach(diff => {
      initialMerge[diff.field] = diff.localValue;
    });
    setMergeData(initialMerge);
    setMergeMode(true);
  };

  const handleMergeField = (field, source) => {
    if (!selectedConflict) return;
    let val;
    if (conflictCategory === 'deleteThenEdit') {
      val = source === 'local'
        ? localData?.[field]
        : deletedSnapshot?.[field];
    } else {
      val = source === 'local'
        ? localData?.[field]
        : serverData?.[field];
    }
    setMergeData(prev => ({ ...prev, [field]: val }));
  };

  const handleConfirmMerge = () => {
    if (!selectedConflict) return;
    const baseData = conflictCategory === 'deleteThenEdit'
      ? { ...(deletedSnapshot || {}), ...(localData || {}) }
      : { ...(localData || {}) };
    const finalData = {
      ...baseData,
      ...mergeData,
    };
    resolveConflict(selectedConflict.id, 'merge', finalData);
    setSelectedConflictId(null);
    setMergeMode(false);
    setMergeData({});
  };

  const formatDateTime = (ts) => {
    if (!ts) return '-';
    try {
      return new Date(ts).toLocaleString('zh-CN');
    } catch {
      return ts;
    }
  };

  const getConflictHint = (conflict) => {
    switch (conflict.conflictType) {
      case CONFLICT_TYPES.DELETE_THEN_EDIT:
        return {
          icon: <Trash2 size={16} />,
          title: '该记录已被其他终端删除',
          desc: '您在离线状态下编辑了该记录，但该记录已在服务端被删除。您需要决定是恢复您的修改还是接受删除。',
          level: 'danger',
        };
      case CONFLICT_TYPES.VERSION_CHANGED:
        return {
          icon: <Tags size={16} />,
          title: '方案版本已变更',
          desc: '您的修改基于旧版本方案，发布新版本方案后，该记录可能需要重新检查。',
          level: 'warning',
        };
      case CONFLICT_TYPES.RECORD_NOT_FOUND:
        return {
          icon: <Database size={16} />,
          title: '服务端未找到该记录',
          desc: '服务端没有该记录的信息，可能已被物理删除或未成功同步。',
          level: 'danger',
        };
      case CONFLICT_TYPES.CONCURRENT_MODIFY:
        return {
          icon: <ArrowLeftRight size={16} />,
          title: '多终端并发修改冲突',
          desc: '您离线编辑期间，其他终端修改了该记录的相同字段。请选择保留哪个版本或手动合并。',
          level: 'warning',
        };
      default:
        return {
          icon: <AlertCircle size={16} />,
          title: '数据冲突',
          desc: '检测到数据冲突，请选择解决方式。',
          level: 'warning',
        };
    }
  };

  const getLocalButtonLabel = () => {
    if (conflictCategory === 'deleteThenEdit') return '恢复并使用本地修改';
    if (conflictCategory === 'recordNotFound') return '重新创建（使用本地数据）';
    return '保留本地修改';
  };

  const getServerButtonLabel = () => {
    if (conflictCategory === 'deleteThenEdit') return '接受删除（不恢复）';
    if (conflictCategory === 'recordNotFound') return '放弃本地修改';
    if (conflictCategory === 'versionChanged') return '使用服务端新版本';
    return '使用服务端版本';
  };

  const getMergeButtonLabel = () => {
    if (conflictCategory === 'deleteThenEdit') return '合并后恢复';
    return '手动合并';
  };

  if (pendingConflicts.length === 0) {
    return (
      <div className="sync-modal-overlay" onClick={onClose}>
        <div className="sync-modal" onClick={(e) => e.stopPropagation()}>
          <div className="conflict-resolver-modal">
            <div className="conflict-resolver-header">
              <h2><AlertTriangle size={20} /> 数据冲突处理</h2>
              <button type="button" className="icon-btn" onClick={onClose}><X size={18} /></button>
            </div>
            <div className="conflict-empty">
              <Check size={48} className="text-success" />
              <p>暂无待处理的冲突</p>
              <button type="button" className="primary" onClick={onClose}>关闭</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sync-modal-overlay" onClick={onClose}>
      <div className="sync-modal conflict-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="conflict-resolver-modal">
          <div className="conflict-resolver-header">
            <h2><AlertTriangle size={20} /> 数据冲突处理 ({pendingConflicts.length} 项待处理)</h2>
            <button type="button" className="icon-btn" onClick={onClose}><X size={18} /></button>
          </div>

          <div className="conflict-resolver-body">
            <div className="conflict-list">
              <div className="conflict-list-title">冲突列表</div>
              {pendingConflicts.map(conflict => {
                const hint = getConflictHint(conflict);
                return (
                  <div
                    key={conflict.id}
                    className={`conflict-list-item ${selectedConflict?.id === conflict.id ? 'active' : ''} conflict-${hint.level}`}
                    onClick={() => { setSelectedConflictId(conflict.id); setMergeMode(false); }}
                  >
                    <div className={`conflict-item-icon conflict-icon-${hint.level}`}>
                      {hint.icon}
                    </div>
                    <div className="conflict-item-content">
                      <div className="conflict-item-type">{getConflictTypeLabel(conflict.conflictType)}</div>
                      <div className="conflict-item-meta">
                        {conflict.entityType === 'record' && (
                          <span>访视: {conflict.localVersion?.data?.subjectNo} {conflict.localVersion?.data?.visitName}</span>
                        )}
                        {conflict.entityType === 'deviation' && (
                          <span>偏差: {conflict.localVersion?.data?.title}</span>
                        )}
                      </div>
                      <div className="conflict-item-time">
                        <Clock size={12} />
                        {formatDateTime(conflict.detectedAt)}
                      </div>
                    </div>
                    <ChevronRight size={14} />
                  </div>
                );
              })}
            </div>

            {selectedConflict && (() => {
              const hint = getConflictHint(selectedConflict);
              return (
                <div className="conflict-detail">
                  <div className="conflict-detail-header">
                    <h3>{getConflictTypeLabel(selectedConflict.conflictType)}</h3>
                    <div className="conflict-detail-meta">
                      <span><FileText size={12} /> ID: {selectedConflict.entityId}</span>
                      <span><Clock size={12} /> 发现于: {formatDateTime(selectedConflict.detectedAt)}</span>
                    </div>
                  </div>

                  <div className={`conflict-warning conflict-warning-${hint.level}`}>
                    <div className="conflict-warning-icon">{hint.icon}</div>
                    <div className="conflict-warning-text">
                      <strong>{hint.title}</strong>
                      <p>{hint.desc}</p>
                      {selectedConflict.conflictReason && (
                        <p className="conflict-reason">{selectedConflict.conflictReason}</p>
                      )}
                    </div>
                  </div>

                  {conflictCategory === 'deleteThenEdit' ? (
                    !mergeMode ? (
                      <>
                        <div className="conflict-compare">
                          <div className="conflict-side local recover-side">
                            <div className="conflict-side-header">
                              <ShieldCheck size={16} />
                              <span>本地修改（恢复后的数据）</span>
                              <span className="conflict-side-tag recover-tag"><RotateCcw size={12} /> 编辑于离线期间</span>
                            </div>
                            <div className="conflict-side-info">
                              <User size={12} /> 本终端
                              <Clock size={12} /> {formatDateTime(selectedConflict.localVersion?.updatedAt)}
                              {selectedConflict.baseVersion !== undefined && (
                                <span>基于版本: v{selectedConflict.baseVersion}</span>
                              )}
                            </div>
                            <div className="conflict-fields">
                              <div className="conflict-field conflict-field-snapshot-title">
                                <em>以下为相对「被删除时的版本」的本地变更：</em>
                              </div>
                              {diffs.length === 0 ? (
                                <div className="conflict-field conflict-field-empty">
                                  <em>本地仅恢复了数据，没有额外的字段变更</em>
                                </div>
                              ) : (
                                diffs.map(diff => (
                                  <div key={diff.field} className="conflict-field">
                                    <div className="conflict-field-label">{getFieldLabel(diff.field)}</div>
                                    <div className="conflict-field-compare">
                                      <div className="conflict-field-old">
                                        <span className="conflict-field-sublabel">删除前:</span>
                                        <span className="conflict-field-deleted">{formatValue(diff.snapshotValue)}</span>
                                      </div>
                                      <div className="conflict-field-arrow">→</div>
                                      <div className="conflict-field-new">
                                        <span className="conflict-field-sublabel">本地修改为:</span>
                                        <span className="local-value">{formatValue(diff.localValue)}</span>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          <div className="conflict-vs">
                            <Trash2 size={24} />
                            <p>服务端已删除</p>
                          </div>

                          <div className="conflict-side server deleted-side">
                            <div className="conflict-side-header">
                              <Trash2 size={16} />
                              <span>服务端状态（已被删除）</span>
                              <span className="conflict-side-tag deleted-tag"><X size={12} /> 不存在</span>
                            </div>
                            <div className="conflict-side-info">
                              <User size={12} /> 其他终端
                              <Clock size={12} /> {formatDateTime(selectedConflict.localVersion?.updatedAt)}
                            </div>
                            <div className="conflict-deleted-block">
                              <Trash2 size={36} />
                              <p>该实体已从服务端数据库移除</p>
                              {deletedSnapshot && (
                                <div className="conflict-deleted-snapshot">
                                  <strong>被删除时快照（版本 {deletedSnapshot._version || '-'}）：</strong>
                                  <div className="conflict-deleted-snapshot-fields">
                                    {Object.entries(deletedSnapshot).slice(0, 15).map(([k, v]) => {
                                      if (k.startsWith('_') || k === 'id' || k === 'timeline') return null;
                                      return (
                                        <div key={k} className="conflict-deleted-field">
                                          <span className="conflict-deleted-field-label">{getFieldLabel(k)}</span>
                                          <span className="conflict-deleted-field-value">{formatValue(v)}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="conflict-actions">
                          <button type="button" className="conflict-action-btn local" onClick={handleChooseLocal}>
                            <RotateCcw size={16} />
                            {getLocalButtonLabel()}
                          </button>
                          <button type="button" className="conflict-action-btn merge" onClick={handleStartMerge}>
                            <ArrowLeftRight size={16} />
                            {getMergeButtonLabel()}
                          </button>
                          <button type="button" className="conflict-action-btn server" onClick={handleChooseServer}>
                            <Trash2 size={16} />
                            {getServerButtonLabel()}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="merge-instruction">
                          为每个字段选择「删除前值」或「本地修改值」，或直接输入自定义值：
                        </div>
                        <div className="merge-fields">
                          {diffs.map(diff => (
                            <div key={diff.field} className="merge-field-row">
                              <div className="merge-field-label">{getFieldLabel(diff.field)}</div>
                              <div className="merge-field-options">
                                <button
                                  type="button"
                                  className={`merge-option ${JSON.stringify(mergeData[diff.field]) === JSON.stringify(diff.snapshotValue) ? 'active-server' : ''}`}
                                  onClick={() => handleMergeField(diff.field, 'server')}
                                >
                                  <Trash2 size={12} /> 删除前: {formatValue(diff.snapshotValue)}
                                </button>
                                <button
                                  type="button"
                                  className={`merge-option ${JSON.stringify(mergeData[diff.field]) === JSON.stringify(diff.localValue) ? 'active-local' : ''}`}
                                  onClick={() => handleMergeField(diff.field, 'local')}
                                >
                                  <ShieldCheck size={12} /> 本地: {formatValue(diff.localValue)}
                                </button>
                              </div>
                              <input
                                type="text"
                                className="merge-custom-input"
                                value={formatValue(mergeData[diff.field])}
                                onChange={(e) => setMergeData(prev => ({ ...prev, [diff.field]: e.target.value }))}
                                placeholder="或输入自定义值"
                              />
                            </div>
                          ))}
                          {diffs.length === 0 && (
                            <div className="merge-field-row">
                              <em>没有检测到字段差异，确认合并将使用本地快照数据恢复记录。</em>
                            </div>
                          )}
                        </div>
                        <div className="conflict-actions">
                          <button type="button" className="conflict-action-btn" onClick={() => setMergeMode(false)}>
                            取消合并
                          </button>
                          <button type="button" className="conflict-action-btn merge primary" onClick={handleConfirmMerge}>
                            <Check size={16} />
                            确认合并并恢复
                          </button>
                        </div>
                      </>
                    )
                  ) : (
                    !mergeMode ? (
                      <>
                        <div className="conflict-compare">
                          <div className="conflict-side local">
                            <div className="conflict-side-header">
                              <ShieldCheck size={16} />
                              <span>本地版本（您的修改）</span>
                              <span className="conflict-side-tag"><User size={12} /> 本终端</span>
                            </div>
                            <div className="conflict-side-info">
                              <User size={12} /> 本终端
                              <Clock size={12} /> {formatDateTime(selectedConflict.localVersion?.updatedAt)}
                              {selectedConflict.baseVersion !== undefined && (
                                <span>基于版本: v{selectedConflict.baseVersion}</span>
                              )}
                            </div>
                            <div className="conflict-fields">
                              {diffs.map(diff => (
                                <div key={diff.field} className="conflict-field">
                                  <div className="conflict-field-label">{getFieldLabel(diff.field)}</div>
                                  <div className="conflict-field-value local-value">
                                    {formatValue(diff.localValue)}
                                  </div>
                                </div>
                              ))}
                              {diffs.length === 0 && (
                                <div className="conflict-field conflict-field-empty">
                                  <em>未检测到字段级差异（可能是版本号不同）</em>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="conflict-vs">
                            <ArrowLeftRight size={24} />
                            <p>{selectedConflict.conflictFields?.length || diffs.length} 个字段冲突</p>
                          </div>

                          <div className="conflict-side server">
                            <div className="conflict-side-header">
                              <RefreshCw size={16} />
                              <span>服务端版本（其他终端修改）</span>
                              <span className="conflict-side-tag"><Database size={12} /> 服务端 v{selectedConflict.serverVersionNumber || serverData?._version || '-'}</span>
                            </div>
                            <div className="conflict-side-info">
                              <User size={12} /> {serverData?._updatedBy || '服务端'}
                              <Clock size={12} /> {formatDateTime(serverData?._updatedAt)}
                              {serverData?._version !== undefined && (
                                <span>当前版本: v{serverData._version}</span>
                              )}
                            </div>
                            <div className="conflict-fields">
                              {diffs.map(diff => (
                                <div key={diff.field} className="conflict-field">
                                  <div className="conflict-field-label">{getFieldLabel(diff.field)}</div>
                                  <div className="conflict-field-value server-value">
                                    {formatValue(diff.serverValue)}
                                  </div>
                                </div>
                              ))}
                              {diffs.length === 0 && (
                                <div className="conflict-field conflict-field-empty">
                                  <em>建议使用服务端版本</em>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="conflict-actions">
                          <button type="button" className="conflict-action-btn local" onClick={handleChooseLocal}>
                            <ShieldCheck size={16} />
                            {getLocalButtonLabel()}
                          </button>
                          <button type="button" className="conflict-action-btn merge" onClick={handleStartMerge}>
                            <ArrowLeftRight size={16} />
                            {getMergeButtonLabel()}
                          </button>
                          <button type="button" className="conflict-action-btn server" onClick={handleChooseServer}>
                            <RefreshCw size={16} />
                            {getServerButtonLabel()}
                          </button>
                        </div>

                        <div className="conflict-timeline-section">
                          <h4>本地操作时间线</h4>
                          {selectedConflict.localVersion?.timelineEntry ? (
                            <div className="conflict-timeline-item">
                              <span className="timeline-status">{selectedConflict.localVersion.timelineEntry.status}</span>
                              <span className="timeline-at">{formatDateTime(selectedConflict.localVersion.timelineEntry.at)}</span>
                              <span className="timeline-by">{selectedConflict.localVersion.timelineEntry.by}</span>
                              {selectedConflict.localVersion.timelineEntry.note && (
                                <span className="timeline-note">{selectedConflict.localVersion.timelineEntry.note}</span>
                              )}
                            </div>
                          ) : (
                            <div className="conflict-timeline-empty">无时间线记录</div>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="merge-instruction">
                          为每个字段选择使用本地版本或服务端版本，或直接编辑：
                        </div>
                        <div className="merge-fields">
                          {diffs.map(diff => (
                            <div key={diff.field} className="merge-field-row">
                              <div className="merge-field-label">{getFieldLabel(diff.field)}</div>
                              <div className="merge-field-options">
                                <button
                                  type="button"
                                  className={`merge-option ${JSON.stringify(mergeData[diff.field]) === JSON.stringify(diff.localValue) ? 'active-local' : ''}`}
                                  onClick={() => handleMergeField(diff.field, 'local')}
                                >
                                  <ShieldCheck size={12} /> 本地: {formatValue(diff.localValue)}
                                </button>
                                <button
                                  type="button"
                                  className={`merge-option ${JSON.stringify(mergeData[diff.field]) === JSON.stringify(diff.serverValue) ? 'active-server' : ''}`}
                                  onClick={() => handleMergeField(diff.field, 'server')}
                                >
                                  <RefreshCw size={12} /> 服务端: {formatValue(diff.serverValue)}
                                </button>
                              </div>
                              <input
                                type="text"
                                className="merge-custom-input"
                                value={formatValue(mergeData[diff.field])}
                                onChange={(e) => setMergeData(prev => ({ ...prev, [diff.field]: e.target.value }))}
                                placeholder="或输入自定义值"
                              />
                            </div>
                          ))}
                        </div>
                        <div className="conflict-actions">
                          <button type="button" className="conflict-action-btn" onClick={() => setMergeMode(false)}>
                            取消合并
                          </button>
                          <button type="button" className="conflict-action-btn merge primary" onClick={handleConfirmMerge}>
                            <Check size={16} />
                            确认合并并同步
                          </button>
                        </div>
                      </>
                    )
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
