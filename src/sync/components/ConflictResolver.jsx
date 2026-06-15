import { useState, useMemo } from 'react';
import { AlertTriangle, X, ArrowLeftRight, Check, ShieldCheck, User, Clock, FileText, RefreshCw, ChevronRight } from 'lucide-react';
import { OPERATION_STATUSES } from '../types';

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

  const diffs = useMemo(() => {
    if (!selectedConflict) return [];
    return computeFieldDiffs(
      selectedConflict.localVersion?.data,
      selectedConflict.serverVersion
    );
  }, [selectedConflict, computeFieldDiffs]);

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
    const val = source === 'local'
      ? selectedConflict.localVersion?.data?.[field]
      : selectedConflict.serverVersion?.[field];
    setMergeData(prev => ({ ...prev, [field]: val }));
  };

  const handleConfirmMerge = () => {
    if (!selectedConflict) return;
    const finalData = {
      ...selectedConflict.localVersion?.data,
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

  if (pendingConflicts.length === 0) {
    return (
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
    );
  }

  return (
    <div className="conflict-resolver-modal">
      <div className="conflict-resolver-header">
        <h2><AlertTriangle size={20} /> 数据冲突处理 ({pendingConflicts.length} 项待处理)</h2>
        <button type="button" className="icon-btn" onClick={onClose}><X size={18} /></button>
      </div>

      <div className="conflict-resolver-body">
        <div className="conflict-list">
          <div className="conflict-list-title">冲突列表</div>
          {pendingConflicts.map(conflict => (
            <div
              key={conflict.id}
              className={`conflict-list-item ${selectedConflict?.id === conflict.id ? 'active' : ''}`}
              onClick={() => { setSelectedConflictId(conflict.id); setMergeMode(false); }}
            >
              <div className="conflict-item-icon">
                <AlertTriangle size={16} />
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
          ))}
        </div>

        {selectedConflict && (
          <div className="conflict-detail">
            <div className="conflict-detail-header">
              <h3>{getConflictTypeLabel(selectedConflict.conflictType)}</h3>
              <div className="conflict-detail-meta">
                <span><FileText size={12} /> ID: {selectedConflict.entityId}</span>
                <span><Clock size={12} /> 发现于: {formatDateTime(selectedConflict.detectedAt)}</span>
              </div>
            </div>

            {!mergeMode ? (
              <>
                <div className="conflict-compare">
                  <div className="conflict-side local">
                    <div className="conflict-side-header">
                      <ShieldCheck size={16} />
                      <span>本地版本（您的修改）</span>
                    </div>
                    <div className="conflict-side-info">
                      <User size={12} /> 本终端
                      <Clock size={12} /> {formatDateTime(selectedConflict.localVersion?.updatedAt)}
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
                    </div>
                  </div>

                  <div className="conflict-vs">
                    <ArrowLeftRight size={24} />
                  </div>

                  <div className="conflict-side server">
                    <div className="conflict-side-header">
                      <RefreshCw size={16} />
                      <span>服务端版本（其他终端修改）</span>
                    </div>
                    <div className="conflict-side-info">
                      <User size={12} /> {selectedConflict.serverVersion?.updatedBy || '服务端'}
                      <Clock size={12} /> {formatDateTime(selectedConflict.serverVersion?.updatedAt)}
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
                    </div>
                  </div>
                </div>

                <div className="conflict-actions">
                  <button type="button" className="conflict-action-btn local" onClick={handleChooseLocal}>
                    <ShieldCheck size={16} />
                    保留本地修改
                  </button>
                  <button type="button" className="conflict-action-btn merge" onClick={handleStartMerge}>
                    <ArrowLeftRight size={16} />
                    手动合并
                  </button>
                  <button type="button" className="conflict-action-btn server" onClick={handleChooseServer}>
                    <RefreshCw size={16} />
                    使用服务端版本
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
                          className={`merge-option ${mergeData[diff.field] === diff.localValue ? 'active-local' : ''}`}
                          onClick={() => handleMergeField(diff.field, 'local')}
                        >
                          <ShieldCheck size={12} /> 本地: {formatValue(diff.localValue)}
                        </button>
                        <button
                          type="button"
                          className={`merge-option ${mergeData[diff.field] === diff.serverValue ? 'active-server' : ''}`}
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
