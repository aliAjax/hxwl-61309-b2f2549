import { useMemo, useState, useRef, useCallback } from 'react';
import { ClipboardPlus, Plus, Search, Trash2, RotateCcw, CheckCircle2, AlertTriangle, ClipboardList, CalendarDays, FileText, Eye, Save, LayoutTemplate, X, List, Building2, BarChart3, Edit3, AlertCircle, SearchX, CheckSquare, UserCircle, Clock, Filter, ArrowRight, User, Download, FileArchive, XCircle, Loader2, Table, Archive, FileSpreadsheet, GitCompare, History, ArrowLeftRight, ShieldCheck, Undo2, RefreshCw, BadgeCheck, Ban, GitBranch, ChevronDown, ChevronUp, FileCheck2, ArrowRightLeft, ClipboardCheck } from 'lucide-react';
import './App.css';

const appConfig = {
  "id": "hxwl-61309",
  "port": 61309,
  "title": "临床试验受试者访视排程",
  "subtitle": "入组生成访视计划、窗口状态和偏差记录",
  "domain": "临床试验",
  "icon": "ClipboardPlus",
  "storage": "hxwl-61309-clinical-visit",
  "templateStorage": "hxwl-61309-visit-templates",
  "centerStorage": "hxwl-61309-centers",
  "deviationStorage": "hxwl-61309-deviations",
  "accent": "#4f46e5",
  "statuses": [
    "待访视",
    "窗口内",
    "已完成",
    "已超窗",
    "已取消"
  ],
  "primaryStatus": "待访视",
  "fields": [
    {
      "key": "subjectNo",
      "label": "受试者编号",
      "type": "input",
      "placeholder": "SUB-013",
      "options": []
    },
    {
      "key": "group",
      "label": "试验分组",
      "type": "select",
      "placeholder": "A组",
      "options": [
        "A组",
        "B组",
        "对照组"
      ]
    },
    {
      "key": "enrollDate",
      "label": "入组日期",
      "type": "date",
      "placeholder": "",
      "options": []
    },
    {
      "key": "visitName",
      "label": "访视名称",
      "type": "select",
      "placeholder": "V1",
      "options": [
        "V1",
        "V2",
        "V3",
        "V4"
      ]
    },
    {
      "key": "windowDays",
      "label": "访视窗口天数",
      "type": "number",
      "placeholder": "3",
      "options": []
    },
    {
      "key": "items",
      "label": "检查项目",
      "type": "textarea",
      "placeholder": "生命体征、血常规、AE询问",
      "options": []
    },
    {
      "key": "deviation",
      "label": "偏差记录",
      "type": "textarea",
      "placeholder": "",
      "options": []
    }
  ],
  "seed": [
    {
      "subjectNo": "SUB-013",
      "group": "A组",
      "enrollDate": "2026-06-01",
      "visitName": "V2",
      "windowDays": "3",
      "items": "生命体征、血常规、AE询问",
      "deviation": "",
      "status": "窗口内"
    },
    {
      "subjectNo": "SUB-008",
      "group": "B组",
      "enrollDate": "2026-05-20",
      "visitName": "V3",
      "windowDays": "2",
      "items": "心电图、用药回收",
      "deviation": "受试者迟到1天",
      "status": "已超窗"
    },
    {
      "subjectNo": "SUB-021",
      "group": "对照组",
      "enrollDate": "2026-06-10",
      "visitName": "V1",
      "windowDays": "3",
      "items": "签署知情、随机入组",
      "deviation": "",
      "status": "已完成"
    }
  ],
  "metrics": [
    [
      "受试者",
      "new Set(records.map((item) => item.subjectNo)).size"
    ],
    [
      "窗口内",
      "records.filter((item) => item.status === '窗口内').length"
    ],
    [
      "已超窗",
      "records.filter((item) => item.status === '已超窗').length"
    ]
  ],
  "filters": [
    {
      "key": "query",
      "label": "编号/分组",
      "type": "search",
      "match": "`${item.subjectNo}${item.group}${item.visitName}`.includes(filters.query)"
    },
    {
      "key": "status",
      "label": "访视状态",
      "type": "status"
    }
  ],
  "cardTitle": "`${item.subjectNo} ${item.visitName}`",
  "cardMeta": "`${item.group} · 入组${item.enrollDate} · ±${item.windowDays}天`",
  "cardDetail": "item.items",
  "schedule": true,
  "note": "流程要覆盖建档、生成计划、完成访视、记录偏差。",
  "defaultValues": {
    "subjectNo": "SUB-013",
    "group": "A组",
    "enrollDate": "",
    "visitName": "V1",
    "windowDays": "3",
    "items": "生命体征、血常规、AE询问",
    "deviation": "",
    "status": "待访视"
  }
};

const DEFAULT_VISITS = [
  { visitName: 'V1', plannedDays: 0, windowDays: 3, items: '签署知情、随机入组、生命体征' },
  { visitName: 'V2', plannedDays: 7, windowDays: 3, items: '生命体征、血常规、AE询问' },
  { visitName: 'V3', plannedDays: 14, windowDays: 2, items: '心电图、用药回收、血常规' },
  { visitName: 'V4', plannedDays: 28, windowDays: 3, items: '生命体征、血生化、结束访视' },
];

const today = new Date().toISOString().slice(0, 10);

const DEFAULT_CENTER = { id: 'default', name: '默认中心', code: 'DEFAULT', pi: '', location: '', createdAt: today };

const DEVIATION_STATUSES = [
  { key: 'pending', label: '待处理', className: 'dev-status-pending' },
  { key: 'investigating', label: '调查中', className: 'dev-status-investigating' },
  { key: 'closed', label: '已关闭', className: 'dev-status-closed' },
];

const DEVIATION_SEVERITIES = [
  { key: 'mild', label: '轻微', className: 'dev-sev-mild' },
  { key: 'moderate', label: '中等', className: 'dev-sev-moderate' },
  { key: 'severe', label: '严重', className: 'dev-sev-severe' },
  { key: 'critical', label: '危急', className: 'dev-sev-critical' },
];

const DEVIATION_TYPES = ['访视超窗', '漏做检查', '用药偏差', '方案违背', '知情同意问题', '数据缺失', '不良事件相关', '其他'];

const VERSION_STORAGE = 'hxwl-61309-versions';
const AUDIT_STORAGE = 'hxwl-61309-audit';

const MIGRATION_STRATEGIES = [
  { key: 'keep', label: '保留旧计划', desc: '不迁移，受试者继续按旧版方案执行' },
  { key: 'migrate', label: '迁移到新计划', desc: '将未执行访视自动迁移至新版方案' },
  { key: 'manual', label: '人工确认', desc: '标记为待确认，需人工逐条审核后决定' },
];

const DIFF_TYPES = {
  added: { label: '新增', className: 'diff-added' },
  removed: { label: '删除', className: 'diff-removed' },
  changed: { label: '变更', className: 'diff-changed' },
  unchanged: { label: '未变', className: 'diff-unchanged' },
};

function loadDeviations() {
  const raw = localStorage.getItem(appConfig.deviationStorage);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(d => ({ ...d, centerId: d.centerId || 'default' }));
      }
    } catch {}
  }
  const seedRecs = loadRecords();
  const seedDevs = seedRecs
    .filter(r => r.deviation && r.deviation.trim())
    .map(r => ({
      id: uid(),
      centerId: r.centerId || 'default',
      subjectNo: r.subjectNo,
      visitName: r.visitName,
      group: r.group,
      severity: r.status === '已超窗' ? 'moderate' : 'mild',
      type: r.status === '已超窗' ? '访视超窗' : '其他',
      status: r.status === '已超窗' ? 'investigating' : 'pending',
      title: `${r.subjectNo} ${r.visitName} 偏差`,
      description: r.deviation,
      reportedBy: '迁移导入',
      reportedAt: r.createdAt ? r.createdAt.slice(0, 10) : today,
      resolution: '',
      closedAt: null,
      sourceRecordId: r.id,
      timeline: [{ status: '创建', at: today, by: '迁移导入', note: r.deviation }],
    }));
  return seedDevs;
}

function saveDeviations(deviations) {
  localStorage.setItem(appConfig.deviationStorage, JSON.stringify(deviations));
}

function loadVersions() {
  const raw = localStorage.getItem(VERSION_STORAGE);
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  return [];
}

function saveVersions(versions) {
  localStorage.setItem(VERSION_STORAGE, JSON.stringify(versions));
}

function loadAudits() {
  const raw = localStorage.getItem(AUDIT_STORAGE);
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  return [];
}

function saveAudits(audits) {
  localStorage.setItem(AUDIT_STORAGE, JSON.stringify(audits));
}

function compareVisitLists(oldVisits, newVisits) {
  const oldMap = new Map((oldVisits || []).filter(v => v.visitName).map(v => [v.visitName, v]));
  const newMap = new Map((newVisits || []).filter(v => v.visitName).map(v => [v.visitName, v]));
  const result = [];
  const allNames = new Set([...oldMap.keys(), ...newMap.keys()]);
  for (const name of allNames) {
    const oldV = oldMap.get(name);
    const newV = newMap.get(name);
    if (oldV && !newV) {
      result.push({ visitName: name, type: 'removed', old: oldV, new: null, changes: [] });
    } else if (!oldV && newV) {
      result.push({ visitName: name, type: 'added', old: null, new: newV, changes: [] });
    } else {
      const changes = [];
      if (Number(oldV.plannedDays) !== Number(newV.plannedDays)) {
        changes.push({ field: 'plannedDays', label: '计划天数', oldVal: oldV.plannedDays, newVal: newV.plannedDays });
      }
      if (Number(oldV.windowDays || 0) !== Number(newV.windowDays || 0)) {
        changes.push({ field: 'windowDays', label: '窗口天数', oldVal: oldV.windowDays, newVal: newV.windowDays });
      }
      if ((oldV.items || '') !== (newV.items || '')) {
        changes.push({ field: 'items', label: '检查项目', oldVal: oldV.items, newVal: newV.items });
      }
      result.push({
        visitName: name,
        type: changes.length > 0 ? 'changed' : 'unchanged',
        old: oldV,
        new: newV,
        changes,
      });
    }
  }
  return result.sort((a, b) => {
    const aDays = a.new ? Number(a.new.plannedDays) : Number(a.old.plannedDays);
    const bDays = b.new ? Number(b.new.plannedDays) : Number(b.old.plannedDays);
    return aDays - bDays;
  });
}

function calculateSubjectImpact(subjectRecords, diffs) {
  const impacts = [];
  const completedVisitNames = new Set(
    subjectRecords.filter(r => r.status === '已完成').map(r => r.visitName)
  );
  const manualAdjusted = new Set(
    subjectRecords.filter(r => r.status === '已完成' && (r.timeline || []).some(t => t.by === '操作员' && t.status === '已完成')).map(r => r.visitName)
  );
  for (const diff of diffs) {
    const isCompleted = completedVisitNames.has(diff.visitName);
    const isManual = manualAdjusted.has(diff.visitName);
    if (diff.type === 'added') {
      impacts.push({
        visitName: diff.visitName,
        diffType: diff.type,
        affected: !isCompleted,
        reason: isCompleted ? '已完成访视，不受影响' : '新增访视节点，需安排执行',
        protected: isCompleted,
      });
    } else if (diff.type === 'removed') {
      impacts.push({
        visitName: diff.visitName,
        diffType: diff.type,
        affected: !isCompleted,
        reason: isCompleted ? '已完成访视，保留记录不被删除' : '访视节点被删除，需确认处理方式',
        protected: isCompleted,
      });
    } else if (diff.type === 'changed') {
      const changeDescs = diff.changes.map(c => `${c.label}: ${c.oldVal}→${c.newVal}`);
      impacts.push({
        visitName: diff.visitName,
        diffType: diff.type,
        affected: !isCompleted && !isManual,
        reason: isCompleted ? '已完成访视，不覆盖' : isManual ? '人工调整记录，需人工确认' : `变更: ${changeDescs.join(', ')}`,
        protected: isCompleted || isManual,
        changes: diff.changes,
      });
    }
  }
  return impacts;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function withIds(items) {
  return items.map((item) => ({ id: uid(), timeline: item.timeline || [{ status: item.status, at: today, by: '系统' }], ...item }));
}

function loadRecords() {
  const raw = localStorage.getItem(appConfig.storage);
  let records;
  if (raw) {
    try {
      records = JSON.parse(raw);
    } catch {
      records = withIds(appConfig.seed);
    }
  } else {
    records = withIds(appConfig.seed);
  }
  return records.map(r => ({ ...r, centerId: r.centerId || 'default' }));
}

function loadTemplates() {
  const raw = localStorage.getItem(appConfig.templateStorage);
  let templates;
  if (raw) {
    try {
      templates = JSON.parse(raw);
    } catch {
      templates = [];
    }
  } else {
    templates = [];
  }
  return templates.map(t => ({ ...t, centerId: t.centerId || 'default' }));
}

function saveTemplates(templates) {
  localStorage.setItem(appConfig.templateStorage, JSON.stringify(templates));
}

function loadCenters() {
  const raw = localStorage.getItem(appConfig.centerStorage);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }
  return [{ ...DEFAULT_CENTER }];
}

function saveCenters(centers) {
  localStorage.setItem(appConfig.centerStorage, JSON.stringify(centers));
}

function addDays(dateStr, days) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().slice(0, 10);
}

function computeVisitStatus(plannedDate, windowDays, actualStatus) {
  if (actualStatus && actualStatus !== '待访视') return actualStatus;
  if (!plannedDate) return '待访视';
  const plan = new Date(plannedDate);
  const now = new Date(today);
  const window = Number(windowDays) || 0;
  const start = new Date(plan);
  start.setDate(start.getDate() - window);
  const end = new Date(plan);
  end.setDate(end.getDate() + window);
  if (now > end) return '已超窗';
  if (now >= start && now <= end) return '窗口内';
  return '待访视';
}

function validateTemplate(template) {
  const errors = [];
  if (!template.name || !template.name.trim()) {
    errors.push('模板名称不能为空');
  }
  const names = new Set();
  const validVisits = (template.visits || []).filter(v => v.visitName || v.plannedDays !== '' || v.windowDays !== '' || v.items);
  for (const v of validVisits) {
    if (v.visitName) {
      if (names.has(v.visitName)) {
        errors.push(`访视名称 "${v.visitName}" 重复`);
      }
      names.add(v.visitName);
    }
    if (v.plannedDays === '' || v.plannedDays === null || v.plannedDays === undefined) {
      if (v.visitName) {
        errors.push(`访视 "${v.visitName}" 缺失计划天数`);
      }
    } else if (Number(v.plannedDays) < 0) {
      errors.push(`访视 "${v.visitName}" 计划天数不能为负数`);
    }
    if (v.windowDays !== '' && v.windowDays !== null && v.windowDays !== undefined) {
      if (Number(v.windowDays) < 0) {
        errors.push(`访视 "${v.visitName}" 窗口天数不能为负数`);
      }
    }
  }
  if (validVisits.length === 0) {
    errors.push('至少配置一条有效访视');
  }
  return errors;
}

function statusClass(status) {
  const index = appConfig.statuses.indexOf(status);
  return ['status-a', 'status-b', 'status-c', 'status-d'][index] || 'status-a';
}

function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function rowsToCSV(headers, rows) {
  const headerLine = headers.map(h => escapeCSV(h.label)).join(',');
  const bodyLines = rows.map(row =>
    headers.map(h => escapeCSV(row[h.key])).join(',')
  );
  return '\ufeff' + [headerLine, ...bodyLines].join('\r\n');
}

function downloadBlob(content, filename, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

const EXPORT_CSV_HEADERS = [
  { key: 'centerName', label: '研究中心' },
  { key: 'subjectNo', label: '受试者编号' },
  { key: 'group', label: '试验分组' },
  { key: 'visitName', label: '访视名称' },
  { key: 'enrollDate', label: '入组日期' },
  { key: 'plannedDate', label: '计划访视日期' },
  { key: 'plannedDays', label: '计划天数(相对入组)' },
  { key: 'windowDays', label: '窗口天数(±)' },
  { key: 'actualDate', label: '实际完成日期' },
  { key: 'items', label: '检查项目' },
  { key: 'status', label: '访视状态' },
  { key: 'deviation', label: '偏差记录(简要)' },
  { key: 'hasLinkedDeviation', label: '是否关联偏差单' },
  { key: 'deviationSeverity', label: '关联偏差严重程度' },
  { key: 'deviationStatus', label: '关联偏差状态' },
  { key: 'timeline', label: '状态时间线' },
  { key: 'createdAt', label: '记录创建时间' },
];

const EXPORT_DEVIATION_HEADERS = [
  { key: 'centerName', label: '研究中心' },
  { key: 'subjectNo', label: '受试者编号' },
  { key: 'visitName', label: '访视名称' },
  { key: 'group', label: '试验分组' },
  { key: 'severity', label: '严重程度' },
  { key: 'type', label: '偏差类型' },
  { key: 'status', label: '处理状态' },
  { key: 'title', label: '偏差标题' },
  { key: 'description', label: '详细描述' },
  { key: 'reportedBy', label: '报告人' },
  { key: 'reportedAt', label: '报告日期' },
  { key: 'resolution', label: '处理措施/关闭说明' },
  { key: 'closedAt', label: '关闭日期' },
  { key: 'timeline', label: '偏差时间线' },
];

const EXPORT_TIMELINE_HEADERS = [
  { key: 'centerName', label: '研究中心' },
  { key: 'subjectNo', label: '受试者编号' },
  { key: 'visitName', label: '访视名称' },
  { key: 'recordType', label: '记录类型' },
  { key: 'eventStatus', label: '事件/状态' },
  { key: 'eventAt', label: '发生日期' },
  { key: 'eventBy', label: '操作人' },
  { key: 'eventNote', label: '备注' },
];

function formatExportDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
}

function getActualDateFromTimeline(timeline) {
  if (!timeline || !Array.isArray(timeline)) return '';
  const completed = timeline.find(t => t.status === '已完成');
  return completed ? completed.at : '';
}

function severityLabel(key) {
  return DEVIATION_SEVERITIES.find(s => s.key === key)?.label || key;
}
function devStatusLabel(key) {
  return DEVIATION_STATUSES.find(s => s.key === key)?.label || key;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function App() {
  const [records, setRecords] = useState(loadRecords);
  const [form, setForm] = useState(appConfig.defaultValues);
  const [filters, setFilters] = useState({ query: '', status: '全部' });
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState('record');

  const [templates, setTemplates] = useState(loadTemplates);
  const [templateForm, setTemplateForm] = useState({
    id: '',
    name: '',
    visits: DEFAULT_VISITS.map(v => ({ ...v })),
  });
  const [templateErrors, setTemplateErrors] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const [centers, setCenters] = useState(loadCenters);
  const [activeCenterId, setActiveCenterId] = useState('default');
  const [centerForm, setCenterForm] = useState({ id: '', name: '', code: '', pi: '', location: '' });

  const [deviations, setDeviations] = useState(loadDeviations);
  const [devForm, setDevForm] = useState({
    id: '', subjectNo: '', visitName: '', group: '', severity: 'mild', type: '其他',
    status: 'pending', title: '', description: '', reportedBy: '', resolution: '', sourceRecordId: '',
  });
  const [devFilters, setDevFilters] = useState({ query: '', severity: '全部', type: '全部' });
  const [selectedDev, setSelectedDev] = useState(null);

  const [exportFilters, setExportFilters] = useState({
    startDate: '',
    endDate: '',
    group: '全部',
    status: '全部',
    subjectQuery: '',
  });
  const [exportPreview, setExportPreview] = useState(null);
  const [exportProgress, setExportProgress] = useState({ active: false, current: 0, total: 0, phase: '', cancelled: false });
  const exportCancelledRef = useRef(false);
  const [exportHistory, setExportHistory] = useState([]);
  const [versions, setVersions] = useState(loadVersions);
  const [audits, setAudits] = useState(loadAudits);
  const [versionTab, setVersionTab] = useState('list');
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [comparePair, setComparePair] = useState({ oldId: '', newId: '' });
  const [migrationForm, setMigrationForm] = useState({
    versionId: '',
    subjectStrategies: {},
    globalStrategy: 'manual',
  });
  const [migrationPreview, setMigrationPreview] = useState(null);
  const [migrationStep, setMigrationStep] = useState('select');

  function switchCenter(centerId) {
    setActiveCenterId(centerId);
    setSelected(null);
    setSelectedDev(null);
  }

  function persistDeviations(next) {
    setDeviations(next);
    saveDeviations(next);
  }

  function addDeviation() {
    if (!devForm.title.trim()) { alert('请填写偏差标题'); return; }
    if (!devForm.subjectNo.trim()) { alert('请填写受试者编号'); return; }
    if (devForm.id) {
      const next = deviations.map(d => d.id === devForm.id ? {
        ...d, ...devForm,
        timeline: devForm.status !== d.status
          ? [...(d.timeline || []), { status: `状态变更: ${d.status}→${devForm.status}`, at: today, by: devForm.reportedBy || '操作员' }]
          : d.timeline,
      } : d);
      persistDeviations(next);
    } else {
      const newDev = {
        id: uid(),
        centerId: activeCenterId,
        ...devForm,
        reportedAt: today,
        closedAt: devForm.status === 'closed' ? today : null,
        timeline: [{ status: '创建', at: today, by: devForm.reportedBy || '操作员', note: devForm.description }],
      };
      persistDeviations([newDev, ...deviations]);
      setSelectedDev(newDev);
    }
    setDevForm({
      id: '', subjectNo: '', visitName: '', group: '', severity: 'mild', type: '其他',
      status: 'pending', title: '', description: '', reportedBy: '', resolution: '', sourceRecordId: '',
    });
  }

  function editDeviation(d) {
    setDevForm({
      id: d.id,
      subjectNo: d.subjectNo,
      visitName: d.visitName || '',
      group: d.group || '',
      severity: d.severity,
      type: d.type,
      status: d.status,
      title: d.title,
      description: d.description || '',
      reportedBy: d.reportedBy || '',
      resolution: d.resolution || '',
      sourceRecordId: d.sourceRecordId || '',
    });
  }

  function deleteDeviation(id) {
    if (!confirm('确认删除该偏差记录？')) return;
    persistDeviations(deviations.filter(d => d.id !== id));
    if (selectedDev?.id === id) setSelectedDev(null);
    if (devForm.id === id) setDevForm({
      id: '', subjectNo: '', visitName: '', group: '', severity: 'mild', type: '其他',
      status: 'pending', title: '', description: '', reportedBy: '', resolution: '', sourceRecordId: '',
    });
  }

  function updateDeviationStatus(id, newStatus) {
    const next = deviations.map(d => d.id === id ? {
      ...d,
      status: newStatus,
      closedAt: newStatus === 'closed' ? today : d.closedAt,
      timeline: [...(d.timeline || []), { status: `状态变更: ${d.status}→${newStatus}`, at: today, by: '操作员' }],
    } : d);
    persistDeviations(next);
    if (selectedDev?.id === id) setSelectedDev(next.find(d => d.id === id));
  }

  function createDevFromRecord(item) {
    setDevForm({
      id: '',
      subjectNo: item.subjectNo,
      visitName: item.visitName || '',
      group: item.group || '',
      severity: item.status === '已超窗' ? 'moderate' : 'mild',
      type: item.status === '已超窗' ? '访视超窗' : '其他',
      status: 'pending',
      title: `${item.subjectNo} ${item.visitName} 偏差`,
      description: item.deviation || '',
      reportedBy: '',
      resolution: '',
      sourceRecordId: item.id,
    });
    setActiveTab('deviation');
  }

  function persistCenters(next) {
    setCenters(next);
    saveCenters(next);
  }

  function addCenter() {
    if (!centerForm.name.trim()) { alert('中心名称不能为空'); return; }
    if (centerForm.id) {
      const next = centers.map(c => c.id === centerForm.id ? { ...c, ...centerForm } : c);
      persistCenters(next);
    } else {
      const newCenter = { ...centerForm, id: uid(), createdAt: today };
      persistCenters([newCenter, ...centers]);
      switchCenter(newCenter.id);
    }
    setCenterForm({ id: '', name: '', code: '', pi: '', location: '' });
  }

  function editCenter(c) {
    setCenterForm({ id: c.id, name: c.name, code: c.code || '', pi: c.pi || '', location: c.location || '' });
  }

  function deleteCenter(id) {
    if (id === 'default') { alert('默认中心不可删除'); return; }
    if (!confirm('删除中心后，该中心下的受试者数据将归入默认中心，确认删除？')) return;
    const nextRecords = records.map(r => r.centerId === id ? { ...r, centerId: 'default' } : r);
    persist(nextRecords);
    const nextTemplates = templates.map(t => t.centerId === id ? { ...t, centerId: 'default' } : t);
    persistTemplates(nextTemplates);
    const nextDevs = deviations.map(d => d.centerId === id ? { ...d, centerId: 'default' } : d);
    persistDeviations(nextDevs);
    persistCenters(centers.filter(c => c.id !== id));
    if (activeCenterId === id) switchCenter('default');
    if (centerForm.id === id) setCenterForm({ id: '', name: '', code: '', pi: '', location: '' });
  }

  function persist(next) {
    setRecords(next);
    localStorage.setItem(appConfig.storage, JSON.stringify(next));
  }

  function persistTemplates(next) {
    setTemplates(next);
    saveTemplates(next);
  }

  function addRecord(event) {
    event.preventDefault();
    const nextRecord = {
      id: uid(),
      ...form,
      centerId: activeCenterId,
      status: form.status || appConfig.primaryStatus,
      createdAt: new Date().toISOString(),
      timeline: [{ status: form.status || appConfig.primaryStatus, at: today, by: '录入' }]
    };
    persist([nextRecord, ...records]);
    setForm(appConfig.defaultValues);
    setSelectedTemplateId('');
    setSelected(nextRecord);
  }

  function addRecordsFromTemplate(event) {
    event.preventDefault();
    if (!selectedTemplateId) {
      alert('请先选择访视方案模板');
      return;
    }
    const tpl = templates.find(t => t.id === selectedTemplateId);
    if (!tpl) return;
    if (!form.enrollDate) {
      alert('请填写入组日期');
      return;
    }
    const validVisits = (tpl.visits || []).filter(v => v.visitName && v.plannedDays !== '' && v.plannedDays !== null && v.plannedDays !== undefined);
    if (validVisits.length === 0) {
      alert('模板中没有有效访视配置');
      return;
    }
    const newRecords = validVisits.map(v => {
      const plannedDate = addDays(form.enrollDate, v.plannedDays);
      const initialStatus = computeVisitStatus(plannedDate, v.windowDays, null);
      return {
        id: uid(),
        subjectNo: form.subjectNo,
        group: form.group,
        enrollDate: form.enrollDate,
        plannedDate,
        visitName: v.visitName,
        plannedDays: Number(v.plannedDays),
        windowDays: String(v.windowDays ?? 0),
        items: v.items || '',
        deviation: '',
        centerId: activeCenterId,
        status: initialStatus,
        createdAt: new Date().toISOString(),
        timeline: [{ status: initialStatus, at: today, by: '模板生成' }],
      };
    });
    persist([...newRecords, ...records]);
    setForm(appConfig.defaultValues);
    setSelectedTemplateId('');
    if (newRecords.length > 0) setSelected(newRecords[0]);
  }

  function updateStatus(id, status) {
    const next = records.map((item) => item.id === id ? {
      ...item,
      status,
      timeline: [...(item.timeline || []), { status, at: today, by: '操作员' }]
    } : item);
    persist(next);
    if (selected?.id === id) setSelected(next.find((item) => item.id === id));
  }

  function removeRecord(id) {
    const next = records.filter((item) => item.id !== id);
    persist(next);
    if (selected?.id === id) setSelected(null);
  }

  function duplicateRecord(item) {
    const copied = { ...item, id: uid(), status: appConfig.primaryStatus, timeline: [{ status: appConfig.primaryStatus, at: today, by: '复制' }] };
    persist([copied, ...records]);
    setSelected(copied);
  }

  function resetTemplateForm() {
    setTemplateForm({
      id: '',
      name: '',
      visits: DEFAULT_VISITS.map(v => ({ ...v })),
    });
    setTemplateErrors([]);
  }

  function saveTemplateForm() {
    const toSave = {
      ...templateForm,
      centerId: templateForm.centerId || activeCenterId,
      visits: templateForm.visits.map(v => ({
        ...v,
        plannedDays: v.plannedDays === '' ? '' : Number(v.plannedDays),
        windowDays: v.windowDays === '' ? '' : Number(v.windowDays),
      })),
    };
    const errors = validateTemplate(toSave);
    if (errors.length > 0) {
      setTemplateErrors(errors);
      return;
    }
    setTemplateErrors([]);
    if (toSave.id) {
      const next = templates.map(t => t.id === toSave.id ? { ...toSave } : t);
      persistTemplates(next);
    } else {
      const newTpl = { ...toSave, id: uid(), createdAt: today };
      persistTemplates([newTpl, ...templates]);
    }
    resetTemplateForm();
  }

  function editTemplate(tpl) {
    setTemplateForm({
      id: tpl.id,
      name: tpl.name,
      centerId: tpl.centerId || 'default',
      visits: (tpl.visits || []).map(v => ({ ...v })),
    });
    setTemplateErrors([]);
  }

  function deleteTemplate(id) {
    if (!confirm('确认删除该模板？')) return;
    const next = templates.filter(t => t.id !== id);
    persistTemplates(next);
    if (selectedTemplateId === id) setSelectedTemplateId('');
    if (templateForm.id === id) resetTemplateForm();
  }

  function updateVisitField(index, key, value) {
    const nextVisits = [...templateForm.visits];
    nextVisits[index] = { ...nextVisits[index], [key]: value };
    setTemplateForm({ ...templateForm, visits: nextVisits });
  }

  function addVisitRow() {
    const nextIdx = templateForm.visits.length + 1;
    setTemplateForm({
      ...templateForm,
      visits: [...templateForm.visits, { visitName: `V${nextIdx}`, plannedDays: '', windowDays: '', items: '' }],
    });
  }

  function removeVisitRow(index) {
    if (templateForm.visits.length <= 1) return;
    const nextVisits = templateForm.visits.filter((_, i) => i !== index);
    setTemplateForm({ ...templateForm, visits: nextVisits });
  }

  const previewTimeline = useMemo(() => {
    const validVisits = (templateForm.visits || [])
      .filter(v => v.visitName && v.plannedDays !== '' && v.plannedDays !== null && v.plannedDays !== undefined)
      .sort((a, b) => Number(a.plannedDays) - Number(b.plannedDays));
    if (validVisits.length === 0) return { items: [], max: 0 };
    const max = Math.max(...validVisits.map(v => Number(v.plannedDays) + Number(v.windowDays || 0)), 7);
    return { items: validVisits, max };
  }, [templateForm.visits]);

  const centerRecords = useMemo(() => {
    return records.filter(r => r.centerId === activeCenterId);
  }, [records, activeCenterId]);

  const filteredRecords = useMemo(() => {
    return records
      .filter((item) => item.centerId === activeCenterId)
      .filter((item) => !filters.query || `${item.subjectNo}${item.group}${item.visitName}`.includes(filters.query))
      .filter((item) => filters.status === '全部' || item.status === filters.status)
      .sort((a, b) => {
        const aDate = a.enrollDate || a.createdAt || '';
        const bDate = b.enrollDate || b.createdAt || '';
        if (aDate !== bDate) return String(aDate).localeCompare(String(bDate));
        return (a.plannedDays ?? 0) - (b.plannedDays ?? 0);
      });
  }, [records, filters, activeCenterId]);

  const metrics = [
    { label: "受试者", value: new Set(centerRecords.map((item) => item.subjectNo)).size },
    { label: "窗口内", value: centerRecords.filter((item) => item.status === '窗口内').length },
    { label: "已超窗", value: centerRecords.filter((item) => item.status === '已超窗').length },
  ];

  const groupedByDate = useMemo(() => {
    return filteredRecords.reduce((acc, item) => {
      const key = item.plannedDate || item.enrollDate || '未排期';
      (acc[key] ||= []).push(item);
      return acc;
    }, {});
  }, [filteredRecords]);

  const groupedBySubject = useMemo(() => {
    return centerRecords.reduce((acc, item) => {
      const key = item.subjectNo || '未命名';
      (acc[key] ||= []).push(item);
      return acc;
    }, {});
  }, [centerRecords]);

  const centerTemplates = useMemo(() => {
    return templates.filter(t => t.centerId === activeCenterId);
  }, [templates, activeCenterId]);

  const centerName = centers.find(c => c.id === activeCenterId)?.name || '未知中心';

  const centerDeviations = useMemo(() => {
    return deviations.filter(d => d.centerId === activeCenterId);
  }, [deviations, activeCenterId]);

  const filteredDeviations = useMemo(() => {
    return centerDeviations
      .filter(d => !devFilters.query || `${d.subjectNo}${d.visitName}${d.title}${d.description}`.includes(devFilters.query))
      .filter(d => devFilters.severity === '全部' || d.severity === devFilters.severity)
      .filter(d => devFilters.type === '全部' || d.type === devFilters.type);
  }, [centerDeviations, devFilters]);

  const devStats = useMemo(() => {
    const cd = centerDeviations;
    return {
      total: cd.length,
      pending: cd.filter(d => d.status === 'pending').length,
      investigating: cd.filter(d => d.status === 'investigating').length,
      closed: cd.filter(d => d.status === 'closed').length,
      critical: cd.filter(d => d.severity === 'severe' || d.severity === 'critical').length,
      overdue: cd.filter(d => d.status !== 'closed').filter(d => {
        const days = Math.floor((Date.now() - new Date(d.reportedAt || today).getTime()) / (1000 * 60 * 60 * 24));
        return days > 7;
      }).length,
    };
  }, [centerDeviations]);

  const severityClass = (sev) => DEVIATION_SEVERITIES.find(s => s.key === sev)?.className || 'dev-sev-mild';
  const statusMeta = (key) => DEVIATION_STATUSES.find(s => s.key === key) || DEVIATION_STATUSES[0];
  const severityMeta = (key) => DEVIATION_SEVERITIES.find(s => s.key === key) || DEVIATION_SEVERITIES[0];
  const devKanbanCols = useMemo(() => {
    const cols = {};
    for (const s of DEVIATION_STATUSES) cols[s.key] = filteredDeviations.filter(d => d.status === s.key);
    return cols;
  }, [filteredDeviations]);

  const allGroups = useMemo(() => {
    const set = new Set();
    records.forEach(r => r.group && set.add(r.group));
    return Array.from(set);
  }, [records]);

  const allSubjects = useMemo(() => {
    const set = new Set();
    records.forEach(r => r.subjectNo && set.add(r.subjectNo));
    return Array.from(set).sort();
  }, [records]);

  const exportScopeRecords = useMemo(() => {
    const ef = exportFilters;
    const scope = activeCenterId === '__hq__' ? records : records.filter(r => r.centerId === activeCenterId);
    return scope.filter(r => {
      if (ef.group !== '全部' && r.group !== ef.group) return false;
      if (ef.status !== '全部' && r.status !== ef.status) return false;
      if (ef.subjectQuery && !String(r.subjectNo || '').includes(ef.subjectQuery)) return false;
      const refDate = r.plannedDate || r.enrollDate || r.createdAt?.slice(0, 10);
      if (ef.startDate && refDate && refDate < ef.startDate) return false;
      if (ef.endDate && refDate && refDate > ef.endDate) return false;
      return true;
    });
  }, [records, exportFilters, activeCenterId]);

  const exportScopeDeviations = useMemo(() => {
    const ef = exportFilters;
    const scope = activeCenterId === '__hq__' ? deviations : deviations.filter(d => d.centerId === activeCenterId);
    const scopeSubjects = new Set(exportScopeRecords.map(r => r.subjectNo));
    return scope.filter(d => {
      if (ef.group !== '全部' && d.group !== ef.group) return false;
      if (ef.subjectQuery && !String(d.subjectNo || '').includes(ef.subjectQuery)) return false;
      if (scopeSubjects.size > 0 && !scopeSubjects.has(d.subjectNo)) return false;
      if (ef.startDate && d.reportedAt && d.reportedAt < ef.startDate) return false;
      if (ef.endDate && d.reportedAt && d.reportedAt > ef.endDate) return false;
      return true;
    });
  }, [deviations, exportFilters, exportScopeRecords, activeCenterId]);

  const getMissingFields = useCallback((rec) => {
    const missing = [];
    if (!rec.subjectNo) missing.push('受试者编号');
    if (!rec.group) missing.push('试验分组');
    if (!rec.enrollDate) missing.push('入组日期');
    if (!rec.plannedDate) missing.push('计划访视日期');
    if (!rec.items || !String(rec.items).trim()) missing.push('检查项目');
    if (rec.status === '已完成' && !getActualDateFromTimeline(rec.timeline)) missing.push('实际完成日期');
    return missing;
  }, []);

  function runExportPreview() {
    if (exportScopeRecords.length === 0) {
      alert('当前筛选条件下没有可导出的数据');
      return;
    }
    const previewRows = exportScopeRecords.slice(0, 20).map(r => {
      const center = centers.find(c => c.id === r.centerId);
      const linkedDev = deviations.find(d => d.sourceRecordId === r.id);
      return {
        centerName: center?.name || '未知',
        subjectNo: r.subjectNo,
        group: r.group,
        visitName: r.visitName,
        enrollDate: r.enrollDate,
        plannedDate: r.plannedDate,
        plannedDays: r.plannedDays,
        windowDays: r.windowDays,
        actualDate: getActualDateFromTimeline(r.timeline),
        items: r.items,
        status: r.status,
        deviation: r.deviation,
        hasLinkedDeviation: linkedDev ? '是' : '否',
        deviationSeverity: linkedDev ? severityLabel(linkedDev.severity) : '',
        deviationStatus: linkedDev ? devStatusLabel(linkedDev.status) : '',
        timeline: (r.timeline || []).map(t => `${t.at} ${t.status}(${t.by})`).join(' | '),
        createdAt: formatExportDate(r.createdAt),
      };
    });

    const missingInfo = exportScopeRecords
      .map(r => ({ rec: r, missing: getMissingFields(r) }))
      .filter(x => x.missing.length > 0)
      .slice(0, 10)
      .map(x => ({ subjectNo: x.rec.subjectNo, visitName: x.rec.visitName, missing: x.missing.join('、') }));

    setExportPreview({
      rows: previewRows,
      totalCount: exportScopeRecords.length,
      deviationCount: exportScopeDeviations.length,
      missingInfo,
      totalMissing: exportScopeRecords.filter(r => getMissingFields(r).length > 0).length,
      generatedAt: new Date().toLocaleString('zh-CN'),
    });
  }

  async function runExport() {
    if (exportScopeRecords.length === 0) {
      alert('当前筛选条件下没有可导出的数据');
      return;
    }
    exportCancelledRef.current = false;
    const totalSteps = exportScopeRecords.length + exportScopeDeviations.length + 3;
    setExportProgress({ active: true, current: 0, total: totalSteps, phase: '准备导出数据...', cancelled: false });
    await sleep(30);

    try {
      const visitRows = [];
      const devRows = [];
      const timelineRows = [];
      const ts = new Date();
      const stamp = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}_${String(ts.getHours()).padStart(2, '0')}${String(ts.getMinutes()).padStart(2, '0')}`;

      for (let i = 0; i < exportScopeRecords.length; i++) {
        if (exportCancelledRef.current) throw new Error('CANCELLED');
        const r = exportScopeRecords[i];
        const center = centers.find(c => c.id === r.centerId);
        const linkedDev = deviations.find(d => d.sourceRecordId === r.id);
        const actualDate = getActualDateFromTimeline(r.timeline);
        visitRows.push({
          centerName: center?.name || '未知',
          subjectNo: r.subjectNo,
          group: r.group,
          visitName: r.visitName,
          enrollDate: r.enrollDate,
          plannedDate: r.plannedDate,
          plannedDays: r.plannedDays,
          windowDays: r.windowDays,
          actualDate,
          items: r.items,
          status: r.status,
          deviation: r.deviation,
          hasLinkedDeviation: linkedDev ? '是' : '否',
          deviationSeverity: linkedDev ? severityLabel(linkedDev.severity) : '',
          deviationStatus: linkedDev ? devStatusLabel(linkedDev.status) : '',
          timeline: (r.timeline || []).map(t => `${t.at} ${t.status}(${t.by})${t.note ? ': ' + t.note : ''}`).join(' | '),
          createdAt: formatExportDate(r.createdAt),
        });
        (r.timeline || []).forEach(t => {
          timelineRows.push({
            centerName: center?.name || '未知',
            subjectNo: r.subjectNo,
            visitName: r.visitName,
            recordType: '访视记录',
            eventStatus: t.status,
            eventAt: t.at,
            eventBy: t.by,
            eventNote: t.note || '',
          });
        });
        if ((i + 1) % 50 === 0) {
          setExportProgress(p => ({ ...p, current: i + 1, phase: `处理访视记录 ${i + 1} / ${exportScopeRecords.length}` }));
          await sleep(10);
        }
      }
      setExportProgress(p => ({ ...p, current: exportScopeRecords.length, phase: '处理偏差记录...' }));

      for (let j = 0; j < exportScopeDeviations.length; j++) {
        if (exportCancelledRef.current) throw new Error('CANCELLED');
        const d = exportScopeDeviations[j];
        const center = centers.find(c => c.id === d.centerId);
        devRows.push({
          centerName: center?.name || '未知',
          subjectNo: d.subjectNo,
          visitName: d.visitName,
          group: d.group,
          severity: severityLabel(d.severity),
          type: d.type,
          status: devStatusLabel(d.status),
          title: d.title,
          description: d.description,
          reportedBy: d.reportedBy,
          reportedAt: d.reportedAt,
          resolution: d.resolution,
          closedAt: d.closedAt,
          timeline: (d.timeline || []).map(t => `${t.at} ${t.status}(${t.by})${t.note ? ': ' + t.note : ''}`).join(' | '),
        });
        (d.timeline || []).forEach(t => {
          timelineRows.push({
            centerName: center?.name || '未知',
            subjectNo: d.subjectNo,
            visitName: d.visitName,
            recordType: '偏差记录',
            eventStatus: t.status,
            eventAt: t.at,
            eventBy: t.by,
            eventNote: t.note || '',
          });
        });
        if ((j + 1) % 50 === 0) {
          setExportProgress(p => ({ ...p, current: exportScopeRecords.length + j + 1, phase: `处理偏差记录 ${j + 1} / ${exportScopeDeviations.length}` }));
          await sleep(10);
        }
      }

      setExportProgress(p => ({ ...p, phase: '生成 CSV 文件...' }));
      await sleep(30);
      if (exportCancelledRef.current) throw new Error('CANCELLED');

      const visitCSV = rowsToCSV(EXPORT_CSV_HEADERS, visitRows);
      setExportProgress(p => ({ ...p, current: p.current + 1, phase: '生成偏差 CSV...' }));
      await sleep(20);
      if (exportCancelledRef.current) throw new Error('CANCELLED');

      const devCSV = rowsToCSV(EXPORT_DEVIATION_HEADERS, devRows);
      setExportProgress(p => ({ ...p, current: p.current + 1, phase: '生成时间线 CSV...' }));
      await sleep(20);
      if (exportCancelledRef.current) throw new Error('CANCELLED');

      const tlCSV = rowsToCSV(EXPORT_TIMELINE_HEADERS, timelineRows);
      setExportProgress(p => ({ ...p, current: p.current + 1, phase: '下载归档包...' }));
      await sleep(30);

      const scopeLabel = activeCenterId === '__hq__' ? '总部汇总' : (centers.find(c => c.id === activeCenterId)?.code || 'center');
      downloadBlob(visitCSV, `访视数据_${scopeLabel}_${stamp}.csv`);
      await sleep(200);
      downloadBlob(devCSV, `偏差记录_${scopeLabel}_${stamp}.csv`);
      await sleep(200);
      downloadBlob(tlCSV, `状态时间线_${scopeLabel}_${stamp}.csv`);

      setExportHistory(h => [
        { id: uid(), stamp, scope: scopeLabel, visitCount: visitRows.length, devCount: devRows.length, at: new Date().toLocaleString('zh-CN') },
        ...h,
      ].slice(0, 10));

      setExportProgress({ active: false, current: 0, total: 0, phase: '', cancelled: false });
    } catch (err) {
      if (err.message === 'CANCELLED') {
        setExportProgress({ active: false, current: 0, total: 0, phase: '', cancelled: true });
      } else {
        console.error(err);
        alert('导出失败：' + err.message);
        setExportProgress({ active: false, current: 0, total: 0, phase: '', cancelled: false });
      }
    }
  }

  function cancelExport() {
    exportCancelledRef.current = true;
  }

  function resetExportFilters() {
    setExportFilters({ startDate: '', endDate: '', group: '全部', status: '全部', subjectQuery: '' });
    setExportPreview(null);
  }

  function persistVersions(next) {
    setVersions(next);
    saveVersions(next);
  }

  function persistAudits(next) {
    setAudits(next);
    saveAudits(next);
  }

  function addAuditEntry(entry) {
    const audit = {
      id: uid(),
      timestamp: new Date().toISOString(),
      ...entry,
    };
    persistAudits([audit, ...audits]);
    return audit;
  }

  function parseVersionNum(versionStr) {
    if (!versionStr) return 0;
    const m = String(versionStr).match(/v(\d+)/i);
    return m ? parseInt(m[1], 10) : 0;
  }

  function compareVersionOrder(a, b) {
    const numA = parseVersionNum(a?.version);
    const numB = parseVersionNum(b?.version);
    if (numA !== numB) return numB - numA;
    const timeA = a?.publishedAt || '';
    const timeB = b?.publishedAt || '';
    return timeB.localeCompare(timeA);
  }

  function publishVersion(templateId) {
    const tpl = templates.find(t => t.id === templateId);
    if (!tpl) return;
    const existing = versions.filter(v => v.templateId === templateId);
    const versionNum = existing.length + 1;
    const newVersion = {
      id: uid(),
      templateId: templateId,
      templateName: tpl.name,
      version: `v${versionNum}`,
      versionNum: versionNum,
      visits: (tpl.visits || []).map(v => ({ ...v })),
      publishedAt: new Date().toISOString(),
      publishedBy: '操作员',
      centerId: activeCenterId,
      isCurrent: true,
    };
    const next = versions.map(v => v.templateId === templateId && v.isCurrent ? { ...v, isCurrent: false } : v);
    persistVersions([newVersion, ...next]);
    addAuditEntry({
      action: 'publish_version',
      target: newVersion.id,
      detail: `发布方案版本 ${newVersion.templateName} ${newVersion.version}`,
      operator: '操作员',
    });
    return newVersion;
  }

  function getComparison() {
    if (!comparePair.oldId || !comparePair.newId) return null;
    const oldVer = versions.find(v => v.id === comparePair.oldId);
    const newVer = versions.find(v => v.id === comparePair.newId);
    if (!oldVer || !newVer) return null;
    const diffs = compareVisitLists(oldVer.visits, newVer.visits);
    return { oldVer, newVer, diffs };
  }

  function getImpactPreview(versionId) {
    const ver = versions.find(v => v.id === versionId);
    if (!ver) return null;
    const sameTemplate = versions.filter(v => v.templateId === ver.templateId && v.id !== ver.id);
    const verNum = parseVersionNum(ver.version);
    const verTime = ver.publishedAt || '';
    const prevVersion = sameTemplate
      .filter(v => {
        const vNum = parseVersionNum(v.version);
        const vTime = v.publishedAt || '';
        if (vNum < verNum) return true;
        if (vNum === verNum && vTime < verTime) return true;
        return false;
      })
      .sort(compareVersionOrder)[0];
    if (!prevVersion) return { version: ver, subjects: [], diffs: [] };
    const diffs = compareVisitLists(prevVersion.visits, ver.visits);
    const subjectNos = [...new Set(records.filter(r => r.centerId === activeCenterId && r.status !== '已完成').map(r => r.subjectNo))];
    const subjects = subjectNos.map(sn => {
      const subRecs = records.filter(r => r.subjectNo === sn && r.centerId === activeCenterId);
      const impacts = calculateSubjectImpact(subRecs, diffs);
      return { subjectNo: sn, group: subRecs[0]?.group || '', enrollDate: subRecs[0]?.enrollDate || '', impacts, affectedCount: impacts.filter(i => i.affected).length };
    });
    return { version: ver, prevVersion, subjects, diffs };
  }

  function previewMigration(versionId, globalStrategy) {
    const impact = getImpactPreview(versionId);
    if (!impact) return;
    const strategies = {};
    for (const subj of impact.subjects) {
      for (const imp of subj.impacts) {
        if (!imp.affected) continue;
        const key = `${subj.subjectNo}__${imp.visitName}`;
        if (imp.protected) {
          strategies[key] = 'keep';
        } else {
          strategies[key] = globalStrategy;
        }
      }
    }
    setMigrationForm({ versionId, subjectStrategies: strategies, globalStrategy });
    setMigrationPreview(impact);
    setMigrationStep('preview');
  }

  function executeMigration() {
    if (!migrationPreview || !migrationForm.versionId) return;
    const ver = versions.find(v => v.id === migrationForm.versionId);
    if (!ver) return;
    const prevVersion = migrationPreview.prevVersion;

    const migrationOpId = uid();
    const snapshot = {
      migrationOpId: migrationOpId,
      updatedRecords: [],
      deletedRecordIds: [],
      addedRecordIds: [],
      fullRecordSnapshots: [],
      cancelledRecords: [],
    };
    let changedCount = 0;
    let addedCount = 0;
    let deletedCount = 0;

    const subjectRecordsMap = {};
    records.forEach(r => {
      if (r.centerId !== activeCenterId) return;
      const key = r.subjectNo;
      if (!subjectRecordsMap[key]) subjectRecordsMap[key] = [];
      subjectRecordsMap[key].push(r);
    });

    let nextRecords = records.map(r => {
      if (r.centerId !== activeCenterId) return r;
      if (r.status === '已完成') return r;
      if (r.status === '已取消') return r;

      const key = `${r.subjectNo}__${r.visitName}`;
      const strategy = migrationForm.subjectStrategies[key];

      if (strategy === 'manual') {
        snapshot.fullRecordSnapshots.push({ ...r });
        changedCount++;
        return {
          ...r,
          migrationStatus: 'pending_confirm',
          migrationVersion: ver.version,
          migrationOpId: migrationOpId,
          migrationVersionId: ver.id,
        };
      }

      if (!strategy || strategy === 'keep') return r;

      if (strategy === 'migrate') {
        const diff = migrationPreview.diffs.find(d => d.visitName === r.visitName);
        if (diff && diff.type === 'removed') {
          snapshot.fullRecordSnapshots.push({ ...r });
          snapshot.deletedRecordIds.push(r.id);
          snapshot.cancelledRecords.push({ id: r.id, subjectNo: r.subjectNo, visitName: r.visitName });
          deletedCount++;
          changedCount++;
          return {
            ...r,
            status: '已取消',
            migrationStatus: 'cancelled',
            migrationVersion: ver.version,
            migrationOpId: migrationOpId,
            migrationVersionId: ver.id,
            _migrationAction: 'cancel',
            timeline: [...(r.timeline || []), {
              status: `已取消（方案版本删除）`,
              at: today,
              by: '版本管理',
              note: `方案版本变更删除此访视节点: ${prevVersion?.version || 'unknown'} → ${ver.version}`,
              source: `方案版本删除访视节点`,
            }],
          };
        }

        const newVisit = ver.visits.find(v => v.visitName === r.visitName);
        if (!newVisit) return r;

        const oldPlannedDate = r.plannedDate;
        const newPlannedDate = addDays(r.enrollDate, newVisit.plannedDays);
        const newStatus = computeVisitStatus(newPlannedDate, newVisit.windowDays, null);

        const fieldChanges = [
          ...(Number(r.plannedDays) !== Number(newVisit.plannedDays) ? [{ field: 'plannedDays', label: '计划天数', old: r.plannedDays, new: Number(newVisit.plannedDays) }] : []),
          ...(String(r.windowDays) !== String(newVisit.windowDays ?? 0) ? [{ field: 'windowDays', label: '窗口天数', old: r.windowDays, new: String(newVisit.windowDays ?? 0) }] : []),
          ...((r.items || '') !== (newVisit.items || '') ? [{ field: 'items', label: '检查项目', old: r.items || '', new: newVisit.items || '' }] : []),
          ...(oldPlannedDate !== newPlannedDate ? [{ field: 'plannedDate', label: '计划日期', old: oldPlannedDate, new: newPlannedDate }] : []),
          ...(r.status !== newStatus ? [{ field: 'status', label: '访视状态', old: r.status, new: newStatus }] : []),
        ];

        if (fieldChanges.length === 0) return r;

        snapshot.fullRecordSnapshots.push({ ...r });
        snapshot.updatedRecords.push({
          recordId: r.id,
          subjectNo: r.subjectNo,
          visitName: r.visitName,
          action: 'update',
          oldPlannedDays: r.plannedDays,
          newPlannedDays: Number(newVisit.plannedDays),
          oldWindowDays: r.windowDays,
          newWindowDays: String(newVisit.windowDays ?? 0),
          oldItems: r.items,
          newItems: newVisit.items || '',
          oldPlannedDate,
          newPlannedDate,
          oldStatus: r.status,
          newStatus,
          fieldChanges,
        });
        changedCount++;

        const changeNote = fieldChanges.map(fc => `${fc.label}${fc.old}→${fc.new}`).join(', ');
        return {
          ...r,
          plannedDays: Number(newVisit.plannedDays),
          windowDays: String(newVisit.windowDays ?? 0),
          items: newVisit.items || r.items,
          plannedDate: newPlannedDate,
          status: newStatus,
          migrationVersion: ver.version,
          migrationStatus: 'migrated',
          migrationOpId: migrationOpId,
          migrationVersionId: ver.id,
          _migrationAction: 'update',
          timeline: [...(r.timeline || []), {
            status: `版本迁移 ${ver.version}`,
            at: today,
            by: '版本管理',
            note: changeNote,
            source: `方案版本变更: ${prevVersion?.version || 'unknown'} → ${ver.version}`,
          }],
        };
      }
      return r;
    });

    const toAddRecords = [];
    if (prevVersion) {
      const addedDiffs = migrationPreview.diffs.filter(d => d.type === 'added');
      for (const diff of addedDiffs) {
        const newVisit = diff.new;
        if (!newVisit) continue;
        for (const subj of migrationPreview.subjects) {
          const key = `${subj.subjectNo}__${diff.visitName}`;
          const strategy = migrationForm.subjectStrategies[key];
          if (!strategy || strategy === 'keep') continue;
          const subjRecs = subjectRecordsMap[subj.subjectNo] || [];
          if (subjRecs.some(r => r.visitName === diff.visitName && r.status !== '已取消')) continue;

          const enrollDate = subjRecs[0]?.enrollDate || subj.enrollDate;
          const group = subjRecs[0]?.group || subj.group;
          const newPlannedDate = addDays(enrollDate, newVisit.plannedDays);
          const newStatus = computeVisitStatus(newPlannedDate, newVisit.windowDays, null);
          const newId = uid();

          snapshot.addedRecordIds.push(newId);
          const newRecord = {
            id: newId,
            centerId: activeCenterId,
            subjectNo: subj.subjectNo,
            group: group,
            enrollDate: enrollDate,
            visitName: newVisit.visitName,
            plannedDays: Number(newVisit.plannedDays),
            windowDays: String(newVisit.windowDays ?? 0),
            items: newVisit.items || '',
            plannedDate: newPlannedDate,
            deviation: '',
            status: newStatus,
            migrationVersion: ver.version,
            migrationStatus: strategy === 'manual' ? 'pending_confirm' : 'migrated',
            migrationOpId: migrationOpId,
            migrationVersionId: ver.id,
            _migrationAction: 'add',
            createdAt: new Date().toISOString(),
            timeline: [{
              status: strategy === 'manual' ? `待人工确认 ${ver.version}` : `版本迁移新增 ${ver.version}`,
              at: today,
              by: '版本管理',
              note: `新增访视节点 D${newVisit.plannedDays} ±${newVisit.windowDays ?? 0}天，检查项目: ${newVisit.items || '无'}`,
              source: `方案版本新增: ${prevVersion?.version || 'unknown'} → ${ver.version}`,
            }],
          };
          toAddRecords.push(newRecord);
          changedCount++;
          addedCount++;
        }
      }
    }

    nextRecords = [...toAddRecords, ...nextRecords];

    const migrationRecord = {
      id: migrationOpId,
      versionId: ver.id,
      version: ver.version,
      prevVersion: prevVersion?.version,
      templateName: ver.templateName,
      centerId: activeCenterId,
      executedAt: new Date().toISOString(),
      executedBy: '操作员',
      changedCount,
      addedCount,
      deletedCount,
      snapshot,
      globalStrategy: migrationForm.globalStrategy,
      subjectStrategies: { ...migrationForm.subjectStrategies },
    };

    const nextVersions = versions.map(v => ({
      ...v,
      migrations: [...(v.migrations || []), migrationRecord],
      lastMigration: v.id === ver.id ? migrationOpId : v.lastMigration,
    }));

    persist(nextRecords);
    persistVersions(nextVersions);

    snapshot.updatedRecords.forEach(upd => {
      upd.fieldChanges.forEach(fc => {
        addAuditEntry({
          action: 'field_change',
          target: upd.recordId,
          migrationId: migrationOpId,
          detail: `[${ver.version}] ${upd.subjectNo} ${upd.visitName} ${fc.label}: ${fc.old} → ${fc.new}`,
          operator: '版本管理',
          subjectNo: upd.subjectNo,
          visitName: upd.visitName,
          fieldName: fc.field,
          fieldLabel: fc.label,
          oldValue: fc.old,
          newValue: fc.new,
          source: `方案版本 ${prevVersion?.version || 'unknown'} → ${ver.version}`,
        });
      });
    });
    snapshot.addedRecordIds.forEach(rid => {
      const rec = nextRecords.find(r => r.id === rid);
      if (rec) {
        addAuditEntry({
          action: 'record_add',
          target: rid,
          migrationId: migrationOpId,
          detail: `[${ver.version}] 新增访视 ${rec.subjectNo} ${rec.visitName} 计划D${rec.plannedDays} ±${rec.windowDays}天 项目:${rec.items || '无'}`,
          operator: '版本管理',
          subjectNo: rec.subjectNo,
          visitName: rec.visitName,
          plannedDays: rec.plannedDays,
          windowDays: rec.windowDays,
          items: rec.items,
          plannedDate: rec.plannedDate,
          source: `方案版本新增访视节点`,
        });
      }
    });
    snapshot.cancelledRecords.forEach(c => {
      addAuditEntry({
        action: 'record_cancel',
        target: c.id,
        migrationId: migrationOpId,
        detail: `[${ver.version}] 取消访视 ${c.subjectNo} ${c.visitName}（方案版本删除该节点）`,
        operator: '版本管理',
        subjectNo: c.subjectNo,
        visitName: c.visitName,
        source: `方案版本删除访视节点`,
      });
    });

    addAuditEntry({
      action: 'execute_migration',
      target: migrationOpId,
      detail: `执行版本迁移 ${ver.templateName} ${ver.version} (${prevVersion?.version || '首次'}) → ${ver.version}, 更新${snapshot.updatedRecords.length}条, 新增${addedCount}条, 取消${deletedCount}条, 合计${changedCount}条`,
      operator: '操作员',
      snapshotCount: snapshot.fullRecordSnapshots.length + addedCount,
      stats: {
        updated: snapshot.updatedRecords.length,
        added: addedCount,
        cancelled: deletedCount,
        total: changedCount,
      },
    });

    setMigrationStep('done');
    return migrationRecord;
  }

  function rollbackMigration(migrationId) {
    if (!confirm('确认回滚此迁移操作？将完整恢复迁移前的访视计划数据（含已取消记录、撤销新增记录、还原已更新字段）。')) return;

    let migrationRecord = null;
    let targetVersion = null;
    for (const v of versions) {
      const m = (v.migrations || []).find(x => x.id === migrationId);
      if (m) {
        migrationRecord = m;
        targetVersion = v;
        break;
      }
    }

    if (!migrationRecord || !targetVersion) {
      alert('未找到迁移记录快照，无法精确回滚');
      return;
    }

    if (migrationRecord.rolledBack) {
      alert('该迁移已被回滚，无需重复操作');
      return;
    }

    const { snapshot } = migrationRecord;
    if (!snapshot) {
      alert('迁移快照数据缺失');
      return;
    }

    let restoredCount = 0;
    let removedNewCount = 0;
    let restoredCancelledCount = 0;
    let restoredUpdatedCount = 0;
    let restoredManualCount = 0;

    const snapMap = new Map((snapshot.fullRecordSnapshots || []).map(s => [s.id, s]));
    const addedIds = new Set(snapshot.addedRecordIds || []);
    const cancelledIds = new Set(snapshot.deletedRecordIds || []);

    const rollbackTime = new Date().toISOString();

    let nextRecords = records
      .filter(r => {
        if (addedIds.has(r.id) && r.centerId === activeCenterId && r.migrationOpId === migrationId) {
          removedNewCount++;
          restoredCount++;
          addAuditEntry({
            action: 'rollback_remove_added',
            target: r.id,
            migrationId: migrationId,
            detail: `[回滚] 移除迁移新增的访视 ${r.subjectNo} ${r.visitName} D${r.plannedDays}`,
            operator: '版本管理',
            subjectNo: r.subjectNo,
            visitName: r.visitName,
            source: `回滚迁移 ${migrationRecord.version}`,
          });
          return false;
        }
        return true;
      })
      .map(r => {
        if (r.centerId !== activeCenterId) return r;
        if (!r.migrationOpId || r.migrationOpId !== migrationId) return r;

        if (snapMap.has(r.id)) {
          const original = snapMap.get(r.id);

          if (cancelledIds.has(r.id) || r._migrationAction === 'cancel' || r.migrationStatus === 'cancelled') {
            restoredCancelledCount++;
            restoredCount++;
            addAuditEntry({
              action: 'rollback_restore_cancelled',
              target: r.id,
              migrationId: migrationId,
              detail: `[回滚] 恢复被取消的访视 ${original.subjectNo} ${original.visitName}，状态还原为"${original.status}"`,
              operator: '版本管理',
              subjectNo: original.subjectNo,
              visitName: original.visitName,
              oldStatus: '已取消',
              newStatus: original.status,
              source: `回滚迁移 ${migrationRecord.version}`,
            });
            return {
              ...original,
              migrationVersion: undefined,
              migrationStatus: undefined,
              migrationOpId: undefined,
              migrationVersionId: undefined,
              _migrationAction: undefined,
              migrationRolledBack: true,
              rolledBackAt: rollbackTime,
              timeline: [...(original.timeline || []), {
                status: '迁移回滚-已恢复',
                at: today,
                by: '版本管理',
                note: `回滚迁移 ${migrationRecord.version}，从"已取消"恢复为"${original.status}"`,
                source: `回滚迁移 ${migrationRecord.prevVersion || ''} ← ${migrationRecord.version}`,
              }],
            };
          }

          if (r._migrationAction === 'update' || r.migrationStatus === 'migrated') {
            restoredUpdatedCount++;
            restoredCount++;
            const upd = (snapshot.updatedRecords || []).find(u => u.recordId === r.id);
            if (upd) {
              upd.fieldChanges.forEach(fc => {
                addAuditEntry({
                  action: 'rollback_field_restore',
                  target: r.id,
                  migrationId: migrationId,
                  detail: `[回滚] ${original.subjectNo} ${original.visitName} ${fc.label}: ${fc.new} → ${fc.old}`,
                  operator: '版本管理',
                  subjectNo: original.subjectNo,
                  visitName: original.visitName,
                  fieldName: fc.field,
                  fieldLabel: fc.label,
                  oldValue: fc.new,
                  newValue: fc.old,
                  source: `回滚迁移 ${migrationRecord.version}`,
                });
              });
            }
            const fieldRestoreNote = upd ? upd.fieldChanges.map(fc => `${fc.label}${fc.new}→${fc.old}`).join(', ') : '还原至迁移前';
            return {
              ...original,
              migrationVersion: undefined,
              migrationStatus: undefined,
              migrationOpId: undefined,
              migrationVersionId: undefined,
              _migrationAction: undefined,
              migrationRolledBack: true,
              rolledBackAt: rollbackTime,
              timeline: [...(original.timeline || []), {
                status: '迁移回滚-字段已还原',
                at: today,
                by: '版本管理',
                note: fieldRestoreNote,
                source: `回滚迁移 ${migrationRecord.prevVersion || ''} ← ${migrationRecord.version}`,
              }],
            };
          }

          if (r.migrationStatus === 'pending_confirm') {
            restoredManualCount++;
            restoredCount++;
            addAuditEntry({
              action: 'rollback_pending_confirm',
              target: r.id,
              migrationId: migrationId,
              detail: `[回滚] 取消待人工确认标记 ${original.subjectNo} ${original.visitName}`,
              operator: '版本管理',
              subjectNo: original.subjectNo,
              visitName: original.visitName,
              source: `回滚迁移 ${migrationRecord.version}`,
            });
            return {
              ...original,
              migrationVersion: undefined,
              migrationStatus: undefined,
              migrationOpId: undefined,
              migrationVersionId: undefined,
              _migrationAction: undefined,
              migrationRolledBack: true,
              rolledBackAt: rollbackTime,
              timeline: [...(original.timeline || []), {
                status: '迁移回滚-取消待确认',
                at: today,
                by: '版本管理',
                note: `回滚迁移 ${migrationRecord.version}，清除待人工确认标记`,
                source: `回滚迁移 ${migrationRecord.prevVersion || ''} ← ${migrationRecord.version}`,
              }],
            };
          }
        }

        if (r.migrationOpId === migrationId) {
          restoredCount++;
          return {
            ...r,
            migrationVersion: undefined,
            migrationStatus: undefined,
            migrationOpId: undefined,
            migrationVersionId: undefined,
            _migrationAction: undefined,
            migrationRolledBack: true,
            rolledBackAt: rollbackTime,
          };
        }

        return r;
      });

    const nextVersions = versions.map(v => ({
      ...v,
      lastMigration: v.lastMigration === migrationId ? undefined : v.lastMigration,
      migrations: (v.migrations || []).map(m =>
        m.id === migrationId ? { ...m, rolledBack: true, rolledBackAt: rollbackTime, rolledBackBy: '操作员' } : m
      ),
    }));

    persist(nextRecords);
    persistVersions(nextVersions);

    addAuditEntry({
      action: 'rollback_migration',
      target: migrationId,
      detail: `回滚版本迁移 ${migrationRecord.templateName} ${migrationRecord.version}, 还原更新${restoredUpdatedCount}条, 恢复取消${restoredCancelledCount}条, 移除新增${removedNewCount}条, 清除待确认${restoredManualCount}条, 合计${restoredCount}条`,
      operator: '操作员',
      stats: {
        restoredUpdated: restoredUpdatedCount,
        restoredCancelled: restoredCancelledCount,
        removedAdded: removedNewCount,
        restoredPending: restoredManualCount,
        total: restoredCount,
      },
    });

    alert(`回滚完成：\n• 还原字段更新：${restoredUpdatedCount} 条\n• 恢复已取消访视：${restoredCancelledCount} 条\n• 移除新增记录：${removedNewCount} 条\n• 清除待确认标记：${restoredManualCount} 条\n合计：${restoredCount} 条`);
  }

  function getVersionHistory(templateId) {
    return versions
      .filter(v => v.templateId === templateId)
      .sort(compareVersionOrder);
  }

  const centerVersions = useMemo(() => {
    return versions.filter(v => v.centerId === activeCenterId);
  }, [versions, activeCenterId]);

  const comparison = useMemo(() => {
    return getComparison();
  }, [comparePair, versions]);

  const versionAudits = useMemo(() => {
    const relatedActions = [
      'publish_version',
      'execute_migration',
      'rollback_migration',
      'field_change',
      'record_add',
      'record_cancel',
      'rollback_field_restore',
      'rollback_remove_added',
      'rollback_restore_cancelled',
      'rollback_pending_confirm',
    ];
    return audits
      .filter(a => a.action && relatedActions.includes(a.action))
      .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  }, [audits]);

  return (
    <main className="shell" style={{ '--accent': appConfig.accent }}>
      <section className="hero">
        <div>
          <div className="eyebrow"><ClipboardPlus size={18} />{appConfig.domain}</div>
          <h1>{appConfig.title}</h1>
          <p>{appConfig.subtitle}</p>
        </div>
        <div className="hero-right">
            <div className="center-selector">
              <Building2 size={16} />
            <select value={activeCenterId} onChange={(e) => switchCenter(e.target.value)}>
              <option value="__hq__">📊 总部汇总</option>
              {centers.map(c => <option key={c.id} value={c.id}>{c.name}（{c.code}）</option>)}
            </select>
          </div>
          <div className="port-card">
            <span>Local Port</span>
            <strong>{appConfig.port}</strong>
          </div>
        </div>
      </section>

      <section className="metrics">
        {metrics.map((metric) => (
          <article className="metric" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </section>

      <div className="tabs">
        <button
          type="button"
          className={'tab-btn ' + (activeTab === 'record' ? 'active' : '')}
          onClick={() => setActiveTab('record')}
        >
          <ClipboardList size={16} />访视记录
        </button>
        <button
          type="button"
          className={'tab-btn ' + (activeTab === 'deviation' ? 'active' : '')}
          onClick={() => { setActiveTab('deviation'); setSelected(null); }}
        >
          <AlertTriangle size={16} />偏差管理
          {devStats.total > 0 && <span className="tab-badge">{devStats.pending + devStats.investigating}</span>}
        </button>
        <button
          type="button"
          className={'tab-btn ' + (activeTab === 'template' ? 'active' : '')}
          onClick={() => setActiveTab('template')}
        >
          <LayoutTemplate size={16} />访视方案模板
        </button>
        <button
          type="button"
          className={'tab-btn ' + (activeTab === 'center' ? 'active' : '')}
          onClick={() => setActiveTab('center')}
        >
          <Building2 size={16} />中心管理
        </button>
        <button
          type="button"
          className={'tab-btn ' + (activeTab === 'export' ? 'active' : '')}
          onClick={() => { setActiveTab('export'); setSelected(null); setSelectedDev(null); }}
        >
          <FileArchive size={16} />数据导出归档
        </button>
        <button
          type="button"
          className={'tab-btn ' + (activeTab === 'version' ? 'active' : '')}
          onClick={() => { setActiveTab('version'); setSelected(null); setSelectedDev(null); }}
        >
          <GitBranch size={16} />版本管理与迁移
          {centerVersions.length > 0 && <span className="tab-badge">{centerVersions.filter(v => v.isCurrent).length}</span>}
        </button>
      </div>

      {activeCenterId === '__hq__' ? (
        <section className="hq-workspace">
          <div className="panel">
            <div className="panel-title">
              <BarChart3 size={18} />
              <h2>总部汇总视图</h2>
            </div>
            <div className="hq-center-cards">
              {centers.map(c => {
                const cRecords = records.filter(r => r.centerId === c.id);
                const cSubjects = new Set(cRecords.map(r => r.subjectNo)).size;
                const cInWindow = cRecords.filter(r => r.status === '窗口内').length;
                const cOverdue = cRecords.filter(r => r.status === '已超窗').length;
                const cTotal = cRecords.length;
                const cDevs = deviations.filter(d => d.centerId === c.id);
                const cDevOpen = cDevs.filter(d => d.status !== 'closed').length;
                const cDevSevere = cDevs.filter(d => d.severity === 'severe' || d.severity === 'critical').length;
                const cOverdueRate = cTotal > 0 ? ((cOverdue / cTotal) * 100).toFixed(1) : '0.0';
                const cInWindowRate = cTotal > 0 ? ((cInWindow / cTotal) * 100).toFixed(1) : '0.0';
                return (
                  <article className="hq-center-card" key={c.id}>
                    <div className="hq-center-head">
                      <div>
                        <h3>{c.name}</h3>
                        <p>{c.code}{c.pi ? ` · PI: ${c.pi}` : ''}{c.location ? ` · ${c.location}` : ''}</p>
                      </div>
                      <button type="button" className="link-btn" onClick={() => switchCenter(c.id)}>
                        切换到此中心
                      </button>
                    </div>
                    <div className="hq-center-stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                      <div className="hq-stat">
                        <span>入组数</span>
                        <strong>{cSubjects}</strong>
                      </div>
                      <div className="hq-stat">
                        <span>窗口内</span>
                        <strong>{cInWindow}</strong>
                      </div>
                      <div className="hq-stat">
                        <span>超窗数</span>
                        <strong>{cOverdue}</strong>
                      </div>
                      <div className="hq-stat">
                        <span>窗口内率</span>
                        <strong>{cInWindowRate}%</strong>
                      </div>
                      <div className="hq-stat alert">
                        <span>超窗率</span>
                        <strong>{cOverdueRate}%</strong>
                      </div>
                      <div className="hq-stat">
                        <span>总访视</span>
                        <strong>{cTotal}</strong>
                      </div>
                      <div className="hq-stat pending">
                        <span>偏差待处理</span>
                        <strong>{cDevOpen}</strong>
                      </div>
                      <div className="hq-stat critical">
                        <span>严重偏差</span>
                        <strong>{cDevSevere}</strong>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      ) : activeTab === 'record' ? (
        <section className="workspace">
          <form className="panel form-panel" onSubmit={selectedTemplateId ? addRecordsFromTemplate : addRecord}>
            <div className="panel-title">
              <ClipboardList size={18} />
              <h2>新增访视记录</h2>
            </div>
            <div className="form-grid">
              <label className="wide">
                <span>访视方案模板（可选）</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">不使用模板（单条录入）</option>
                    {centerTemplates.map(t => <option key={t.id} value={t.id}>{t.name}（{t.visits?.length || 0}个访视）</option>)}
                  </select>
                </div>
                {selectedTemplateId && (() => {
                  const tpl = templates.find(t => t.id === selectedTemplateId);
                  const count = (tpl?.visits || []).filter(v => v.visitName && v.plannedDays !== '' && v.plannedDays !== null && v.plannedDays !== undefined).length;
                  return <p className="hint" style={{ marginTop: 4 }}>选择后将根据入组日期自动生成 <strong>{count}</strong> 条访视记录</p>;
                })()}
              </label>
              {appConfig.fields.map((field) => (
                ((field.key === 'visitName' || field.key === 'windowDays' || field.key === 'items' || field.key === 'deviation') && selectedTemplateId) ? null : (
                  <label key={field.key} className={field.type === 'textarea' ? 'wide' : ''}>
                    <span>{field.label}</span>
                    {field.type === 'textarea' ? (
                      <textarea value={form[field.key] || ''} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} placeholder={field.placeholder} />
                    ) : field.type === 'select' ? (
                      <select value={form[field.key] || ''} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}>
                        {field.options.map((option) => <option key={option}>{option}</option>)}
                      </select>
                    ) : (
                      <input type={field.type} value={form[field.key] || ''} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} placeholder={field.placeholder} />
                    )}
                  </label>
                )
              ))}
              {!selectedTemplateId && (
                <label>
                  <span>当前状态</span>
                  <select value={form.status || appConfig.primaryStatus} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                    {appConfig.statuses.map((status) => <option key={status}>{status}</option>)}
                  </select>
                </label>
              )}
            </div>
            <button className="primary" type="submit">
              <Plus size={18} />
              {selectedTemplateId ? '根据模板生成全部访视' : '新增'}
            </button>
            <p className="hint">{appConfig.note}</p>
          </form>

          <section className="panel list-panel">
            <div className="toolbar">
              <div className="search">
                <Search size={16} />
                <input value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder={appConfig.filters[0]?.label || '搜索'} />
              </div>
              <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
                <option>全部</option>
                {appConfig.statuses.map((status) => <option key={status}>{status}</option>)}
              </select>
            </div>

            <div className="records">
              {filteredRecords.map((item) => (
                <article className={'record ' + (item.conflict ? 'conflict' : '')} key={item.id} onClick={() => setSelected(item)}>
                  <div className="record-head">
                    <div>
                      <h3>{`${item.subjectNo} ${item.visitName}`}</h3>
                      <p>{`${item.group} · 入组${item.enrollDate}${item.plannedDate ? ` · 计划${item.plannedDate}（第${item.plannedDays ?? '?'}天）` : ''} · ±${item.windowDays}天`}</p>
                    </div>
                    <span className={'status ' + statusClass(item.status)}>{item.status}</span>
                  </div>
                  <p className="record-detail">{item.items}</p>
                  {item.conflict && <div className="warning"><AlertTriangle size={15} />发现冲突</div>}
                  {(() => {
                    const recDev = deviations.find(d => d.sourceRecordId === item.id);
                    if (recDev) {
                      return <div className="warning" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span><AlertTriangle size={14} />已关联偏差（{recDev.status}）</span>
                        <button type="button" className="link-btn" onClick={(e) => { e.stopPropagation(); setSelectedDev(recDev); setActiveTab('deviation'); }} style={{ padding: '2px 8px' }}>
                          查看
                        </button>
                      </div>;
                    }
                    return null;
                  })()}
                  <div className="actions" onClick={(event) => event.stopPropagation()}>
                    {appConfig.statuses.map((status) => (
                      <button key={status} type="button" onClick={() => updateStatus(item.id, status)}>{status}</button>
                    ))}
                    <button type="button" onClick={() => createDevFromRecord(item)}><AlertTriangle size={14} />记录偏差</button>
                    <button type="button" onClick={() => duplicateRecord(item)}><RotateCcw size={14} />复制</button>
                    <button className="ghost-danger" type="button" onClick={() => removeRecord(item.id)}><Trash2 size={14} /></button>
                  </div>
                </article>
              ))}
              {filteredRecords.length === 0 && (
                <p className="empty" style={{ padding: 20, textAlign: 'center' }}>暂无记录，可在左侧录入或从访视方案模板批量生成。</p>
              )}
            </div>
          </section>
        </section>
      ) : activeTab === 'deviation' ? (
        <section className="deviation-workspace">
          <section className="panel deviation-stats-panel">
            <div className="panel-title">
              <AlertCircle size={18} />
              <h2>{centerName} · 偏差统计</h2>
            </div>
            <div className="dev-stats">
              <div className="dev-stat">
                <AlertCircle size={16} />
                <div>
                  <span>偏差总数</span>
                  <strong>{devStats.total}</strong>
                </div>
              </div>
              <div className="dev-stat pending">
                <Clock size={16} />
                <div>
                  <span>待处理</span>
                  <strong>{devStats.pending}</strong>
                </div>
              </div>
              <div className="dev-stat investigating">
                <SearchX size={16} />
                <div>
                  <span>调查中</span>
                  <strong>{devStats.investigating}</strong>
                </div>
              </div>
              <div className="dev-stat closed">
                <CheckSquare size={16} />
                <div>
                  <span>已关闭</span>
                  <strong>{devStats.closed}</strong>
                </div>
              </div>
              <div className="dev-stat critical">
                <AlertTriangle size={16} />
                <div>
                  <span>严重/危急</span>
                  <strong>{devStats.critical}</strong>
                </div>
              </div>
              <div className="dev-stat" style={devStats.overdue > 0 ? { borderColor: '#fecaca', background: '#fef2f2' } : {}}>
                <AlertTriangle size={16} />
                <div>
                  <span>超7天未关闭</span>
                  <strong style={devStats.overdue > 0 ? { color: '#be123c' } : {}}>{devStats.overdue}</strong>
                </div>
              </div>
            </div>
            <div className="dev-toolbar">
              <button type="button" className="secondary-btn" onClick={() => {
                const toClose = filteredDeviations.filter(d => d.status === 'investigating');
                if (toClose.length === 0) { alert('没有调查中的偏差可批量关闭'); return; }
                if (!confirm(`将 ${toClose.length} 条"调查中"偏差批量标记为"已关闭"？`)) return;
                const next = deviations.map(d => {
                  if (d.centerId === activeCenterId && d.status === 'investigating') {
                    return { ...d, status: 'closed', closedAt: today, timeline: [...(d.timeline || []), { status: '状态变更: investigating→closed', at: today, by: '批量操作' }] };
                  }
                  return d;
                });
                persistDeviations(next);
              }}>
                <CheckSquare size={14} />批量关闭调查中
              </button>
            </div>

            <div className="dev-filters">
              <div className="panel-title" style={{ marginBottom: 10 }}>
                <Filter size={14} />
                <h3>筛选条件</h3>
              </div>
              <div className="dev-filter-row" style={{ marginBottom: 10 }}>
                <div className="dev-search">
                  <Search size={14} />
                  <input
                    type="text"
                    value={devFilters.query}
                    onChange={(e) => setDevFilters({ ...devFilters, query: e.target.value })}
                    placeholder="受试者编号/标题/描述"
                  />
                </div>
              </div>
              <div className="dev-filter-row">
                <select value={devFilters.severity} onChange={(e) => setDevFilters({ ...devFilters, severity: e.target.value })}>
                  <option value="全部">全部严重程度</option>
                  {DEVIATION_SEVERITIES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <select value={devFilters.type} onChange={(e) => setDevFilters({ ...devFilters, type: e.target.value })}>
                  <option value="全部">全部类型</option>
                  {DEVIATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="dev-detail-section" style={{ borderTop: '1px solid #e5e7eb', marginTop: 14, paddingTop: 14 }}>
              <div className="panel-title" style={{ marginBottom: 10 }}>
                {devForm.id ? <Edit3 size={14} /> : <Plus size={14} />}
                <h3>{devForm.id ? '编辑偏差' : '新增偏差'}</h3>
                {devForm.id && (
                  <button type="button" className="link-btn" onClick={() => setDevForm({
                    id: '', subjectNo: '', visitName: '', group: '', severity: 'mild', type: '其他',
                    status: 'pending', title: '', description: '', reportedBy: '', resolution: '', sourceRecordId: '',
                  })} style={{ marginLeft: 'auto' }}>
                    <RotateCcw size={12} />新建
                  </button>
                )}
              </div>
              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <label>
                  <span>受试者编号 *</span>
                  <input type="text" value={devForm.subjectNo} onChange={(e) => setDevForm({ ...devForm, subjectNo: e.target.value })} placeholder="SUB-001" />
                </label>
                <label>
                  <span>访视名称</span>
                  <input type="text" value={devForm.visitName} onChange={(e) => setDevForm({ ...devForm, visitName: e.target.value })} placeholder="V1/V2..." />
                </label>
                <label>
                  <span>试验分组</span>
                  <select value={devForm.group} onChange={(e) => setDevForm({ ...devForm, group: e.target.value })}>
                    <option value="">不指定</option>
                    <option>A组</option>
                    <option>B组</option>
                    <option>对照组</option>
                  </select>
                </label>
                <label>
                  <span>严重程度</span>
                  <select value={devForm.severity} onChange={(e) => setDevForm({ ...devForm, severity: e.target.value })}>
                    {DEVIATION_SEVERITIES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>偏差类型</span>
                  <select value={devForm.type} onChange={(e) => setDevForm({ ...devForm, type: e.target.value })}>
                    {DEVIATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label>
                  <span>当前状态</span>
                  <select value={devForm.status} onChange={(e) => setDevForm({ ...devForm, status: e.target.value })}>
                    {DEVIATION_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </label>
                <label className="wide">
                  <span>偏差标题 *</span>
                  <input type="text" value={devForm.title} onChange={(e) => setDevForm({ ...devForm, title: e.target.value })} placeholder="简要描述问题" />
                </label>
                <label className="wide">
                  <span>详细描述</span>
                  <textarea value={devForm.description} onChange={(e) => setDevForm({ ...devForm, description: e.target.value })} placeholder="详细描述偏差情况、发现经过等" rows={3} />
                </label>
                <label>
                  <span>报告人</span>
                  <input type="text" value={devForm.reportedBy} onChange={(e) => setDevForm({ ...devForm, reportedBy: e.target.value })} placeholder="操作员姓名" />
                </label>
                {devForm.status === 'closed' && (
                  <label className="wide">
                    <span>处理措施 / 关闭说明</span>
                    <textarea value={devForm.resolution} onChange={(e) => setDevForm({ ...devForm, resolution: e.target.value })} placeholder="关闭偏差的处理措施和结论" rows={2} />
                  </label>
                )}
              </div>
              <button className="primary" type="button" onClick={addDeviation} style={{ marginTop: 10 }}>
                <Save size={16} />
                {devForm.id ? '保存修改' : '提交偏差'}
              </button>
            </div>
          </section>

          <section className="panel deviation-kanban-panel">
            <div className="panel-title">
              <BarChart3 size={18} />
              <h2>偏差看板 · {filteredDeviations.length} / {centerDeviations.length} 条</h2>
            </div>
            <div className="dev-kanban">
              {DEVIATION_STATUSES.map(s => (
                <div className={`dev-kanban-col ${s.className}`} key={s.key}>
                  <div className="dev-kanban-col-head">
                    <h3>{s.label}</h3>
                    <span className="dev-col-count">{devKanbanCols[s.key]?.length || 0}</span>
                  </div>
                  <div className="dev-kanban-list">
                    {(devKanbanCols[s.key] || []).length === 0 && (
                      <div className="dev-empty-slot">暂无{s.label}偏差</div>
                    )}
                    {(devKanbanCols[s.key] || []).map(d => {
                      const sevMeta = severityMeta(d.severity);
                      const sourceRec = records.find(r => r.id === d.sourceRecordId);
                      return (
                        <article
                          className={`dev-card ${severityClass(d.severity)} ${selectedDev?.id === d.id ? 'selected' : ''}`}
                          key={d.id}
                          onClick={() => setSelectedDev(d)}
                        >
                          <div className="dev-card-head">
                            <span className={`dev-severity ${severityClass(d.severity)}`}>{sevMeta.label}</span>
                            <span className="dev-type-tag">{d.type}</span>
                          </div>
                          <div className="dev-card-title">
                            <strong>{d.title}</strong>
                            {d.group && <span className="dev-group">{d.group}</span>}
                          </div>
                          <p className="dev-card-desc">{d.description || '（无详细描述）'}</p>
                          <div className="dev-card-meta">
                            <span><UserCircle size={12} />{d.subjectNo}{d.visitName ? ` · ${d.visitName}` : ''}</span>
                            <span><Clock size={12} />{d.reportedAt || '-'}</span>
                          </div>
                          {d.reportedBy && (
                            <div className="dev-card-source"><User size={12} />{d.reportedBy}</div>
                          )}
                          {sourceRec && (
                            <div className="dev-card-source"><ClipboardList size={12} />关联访视: {sourceRec.visitName}（{sourceRec.status}）</div>
                          )}
                          <div className="dev-card-actions">
                            {DEVIATION_STATUSES.filter(os => os.key !== s.key).map(os => (
                              <button key={os.key} type="button" className="link-btn" onClick={(e) => { e.stopPropagation(); updateDeviationStatus(d.id, os.key); }}>
                                <ArrowRight size={12} />{os.label}
                              </button>
                            ))}
                            <button type="button" className="link-btn" onClick={(e) => { e.stopPropagation(); editDeviation(d); }}>
                              <Edit3 size={12} />编辑
                            </button>
                            <button type="button" className="link-btn ghost-danger" onClick={(e) => { e.stopPropagation(); deleteDeviation(d.id); }}>
                              <Trash2 size={12} />删除
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="panel deviation-detail-panel">
            <div className="panel-title">
              <CheckCircle2 size={18} />
              <h2>偏差详情</h2>
            </div>
            {selectedDev ? (
              <div>
                <div className="dev-detail-head">
                  <div>
                    <div className="dev-detail-title">{selectedDev.title}</div>
                    <div className="dev-detail-sub">
                      编号: {selectedDev.subjectNo}{selectedDev.visitName ? ` · 访视 ${selectedDev.visitName}` : ''}
                      {selectedDev.group ? ` · ${selectedDev.group}` : ''}
                    </div>
                  </div>
                  <div className="dev-detail-status">
                    <span className={`dev-status-tag ${statusMeta(selectedDev.status).className}`}>{statusMeta(selectedDev.status).label}</span>
                    <span className={`dev-severity ${severityClass(selectedDev.severity)}`}>{severityMeta(selectedDev.severity).label}</span>
                  </div>
                </div>
                <div className="dev-detail-grid">
                  <div className="dev-detail-item">
                    <label>偏差类型</label>
                    <p>{selectedDev.type}</p>
                  </div>
                  <div className="dev-detail-item">
                    <label>归属中心</label>
                    <p>{centers.find(c => c.id === selectedDev.centerId)?.name || '未知'}</p>
                  </div>
                  <div className="dev-detail-item">
                    <label>报告日期</label>
                    <p>{selectedDev.reportedAt || '-'}</p>
                  </div>
                  <div className="dev-detail-item">
                    <label>报告人</label>
                    <p>{selectedDev.reportedBy || '-'}</p>
                  </div>
                  <div className="dev-detail-item">
                    <label>关闭日期</label>
                    <p>{selectedDev.closedAt || '-'}</p>
                  </div>
                  <div className="dev-detail-item">
                    <label>受试者</label>
                    <p>{selectedDev.subjectNo}{selectedDev.visitName ? ` / ${selectedDev.visitName}` : ''}</p>
                  </div>
                </div>

                <div className="dev-detail-section">
                  <h4><FileText size={14} />详细描述</h4>
                  <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {selectedDev.description || '（无详细描述）'}
                  </p>
                </div>

                {selectedDev.resolution && (
                  <div className="dev-detail-section">
                    <h4><CheckSquare size={14} />处理措施 / 关闭说明</h4>
                    <p style={{ fontSize: 13, color: '#065f46', lineHeight: 1.6, whiteSpace: 'pre-wrap', background: '#ecfdf5', padding: 10, borderRadius: 8, border: '1px solid #a7f3d0' }}>
                      {selectedDev.resolution}
                    </p>
                  </div>
                )}

                <div className="dev-detail-section">
                  <h4><CalendarDays size={14} />时间线</h4>
                  <div className="timeline">
                    {(selectedDev.timeline || []).map((step, i) => (
                      <span key={i} style={{ lineHeight: 1.6 }}>
                        {step.at} · {step.status} · {step.by}
                        {step.note && <br />}
                        {step.note && <span className="timeline-note">{step.note}</span>}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="dev-detail-actions">
                  <button type="button" className="primary" onClick={() => editDeviation(selectedDev)}>
                    <Edit3 size={14} />编辑此偏差
                  </button>
                  {selectedDev.sourceRecordId && (
                    <button type="button" className="secondary-btn" onClick={() => {
                      const rec = records.find(r => r.id === selectedDev.sourceRecordId);
                      if (rec) { setSelected(rec); setActiveTab('record'); }
                    }}>
                      <ClipboardList size={14} />查看关联访视
                    </button>
                  )}
                  <button type="button" className="secondary-btn" style={{ borderColor: '#fecaca', color: '#be123c' }} onClick={() => deleteDeviation(selectedDev.id)}>
                    <Trash2 size={14} />删除
                  </button>
                </div>
              </div>
            ) : (
              <p className="empty">点击看板中的任意偏差查看详情，或在左侧提交新偏差。</p>
            )}
          </aside>
        </section>
      ) : activeTab === 'template' ? (
        <section className="workspace">
          <section className="panel form-panel">
            <div className="panel-title">
              <FileText size={18} />
              <h2>{templateForm.id ? '编辑模板' : '新建模板'}</h2>
              {templateForm.id && (
                <button type="button" className="link-btn" onClick={resetTemplateForm} style={{ marginLeft: 'auto' }}>
                  <RotateCcw size={14} />新建
                </button>
              )}
            </div>

            <div className="form-grid">
              <label className="wide">
                <span>模板名称</span>
                <input
                  type="text"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  placeholder="例如：Ⅱ期临床标准访视方案"
                />
              </label>
            </div>

            <div className="visit-config-head">
              <strong>访视配置</strong>
              <button type="button" className="link-btn" onClick={addVisitRow}>
                <Plus size={14} />添加访视
              </button>
            </div>

            <div className="visit-rows">
              {templateForm.visits.map((v, idx) => (
                <div className="visit-row" key={idx}>
                  <div className="visit-row-grid">
                    <label>
                      <span>访视名称</span>
                      <input
                        type="text"
                        value={v.visitName}
                        onChange={(e) => updateVisitField(idx, 'visitName', e.target.value)}
                        placeholder="V1"
                      />
                    </label>
                    <label>
                      <span>计划天数（相对入组日）</span>
                      <input
                        type="number"
                        min="0"
                        value={v.plannedDays}
                        onChange={(e) => updateVisitField(idx, 'plannedDays', e.target.value)}
                        placeholder="0"
                      />
                    </label>
                    <label>
                      <span>允许窗口（±天）</span>
                      <input
                        type="number"
                        min="0"
                        value={v.windowDays}
                        onChange={(e) => updateVisitField(idx, 'windowDays', e.target.value)}
                        placeholder="3"
                      />
                    </label>
                    <label className="wide">
                      <span>检查项目</span>
                      <textarea
                        value={v.items}
                        onChange={(e) => updateVisitField(idx, 'items', e.target.value)}
                        placeholder="生命体征、血常规..."
                      />
                    </label>
                  </div>
                  {templateForm.visits.length > 1 && (
                    <button type="button" className="remove-visit" onClick={() => removeVisitRow(idx)} title="删除此行">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {templateErrors.length > 0 && (
              <div className="error-box">
                <AlertTriangle size={16} />
                <ul>
                  {templateErrors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}

            <div className="template-preview">
              <div className="panel-title" style={{ marginBottom: 10 }}>
                <Eye size={18} />
                <h3>时间轴预览（入组日=D0）</h3>
              </div>
              {previewTimeline.items.length > 0 ? (
                <div className="timeline-preview">
                  <div className="timeline-scale">
                    <span>D0</span>
                    <span style={{ left: `${Math.min(25, 100 * 7 / (previewTimeline.max || 1))}%` }}>D7</span>
                    <span style={{ left: `${Math.min(50, 100 * 14 / (previewTimeline.max || 1))}%` }}>D14</span>
                    <span style={{ left: `${Math.min(75, 100 * 21 / (previewTimeline.max || 1))}%` }}>D21</span>
                    <span style={{ right: 0 }}>D{previewTimeline.max}</span>
                  </div>
                  <div className="timeline-track">
                    <div className="timeline-line" />
                    {previewTimeline.items.map((v, i) => {
                      const pos = previewTimeline.max > 0 ? (Number(v.plannedDays) / previewTimeline.max) * 100 : 0;
                      const windowPct = previewTimeline.max > 0 ? (Number(v.windowDays || 0) / previewTimeline.max) * 100 : 0;
                      const left = Math.max(0, pos - windowPct);
                      const width = Math.min(100 - left, windowPct * 2 || 1.5);
                      return (
                        <div
                          key={i}
                          className="timeline-marker"
                          style={{ left: `${left}%`, width: `${width}%` }}
                          title={`${v.visitName} · D${v.plannedDays} ±${v.windowDays || 0}天`}
                        >
                          <div className="timeline-dot" />
                          <div className="timeline-label">
                            <strong>{v.visitName}</strong>
                            <span>D{Number(v.plannedDays)} ±{Number(v.windowDays || 0)}d</span>
                            {v.items && <em>{v.items.length > 18 ? v.items.slice(0, 18) + '…' : v.items}</em>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="empty" style={{ padding: '16px 0' }}>填写访视名称和计划天数后可预览时间轴。</p>
              )}
            </div>

            <button className="primary" type="button" onClick={saveTemplateForm}>
              <Save size={18} />
              {templateForm.id ? '更新模板' : '保存模板'}
            </button>
            <p className="hint">校验规则：访视名称不重复、窗口和计划天数不为负数、计划天数必填。保存后可在"访视记录"页批量生成。</p>
          </section>

          <section className="panel list-panel">
            <div className="panel-title">
              <List size={18} />
              <h2>模板列表（{centerTemplates.length}）</h2>
            </div>

            <div className="records">
              {centerTemplates.map((tpl) => (
                <article className="record tpl-record" key={tpl.id}>
                  <div className="record-head">
                    <div>
                      <h3>{tpl.name}</h3>
                      <p>创建：{tpl.createdAt || '-'} · {tpl.visits?.length || 0}个访视</p>
                    </div>
                  </div>
                  <div className="tpl-visit-summary">
                    {(tpl.visits || [])
                      .filter(v => v.visitName && v.plannedDays !== '' && v.plannedDays !== null && v.plannedDays !== undefined)
                      .sort((a, b) => Number(a.plannedDays) - Number(b.plannedDays))
                      .map((v, i) => (
                        <span key={i} className="tpl-chip">
                          <strong>{v.visitName}</strong>
                          <span>D{Number(v.plannedDays)} ±{Number(v.windowDays || 0)}</span>
                        </span>
                      ))
                    }
                  </div>
                  <div className="actions">
                    <button type="button" onClick={() => editTemplate(tpl)}>编辑</button>
                    <button className="ghost-danger" type="button" onClick={() => deleteTemplate(tpl.id)}><Trash2 size={14} />删除</button>
                  </div>
                </article>
              ))}
              {centerTemplates.length === 0 && (
                <p className="empty" style={{ padding: 20, textAlign: 'center' }}>暂无模板，在左侧配置后保存即可。</p>
              )}
            </div>
          </section>
        </section>
      ) : activeTab === 'center' ? (
        <section className="workspace">
          <section className="panel form-panel">
            <div className="panel-title">
              <Building2 size={18} />
              <h2>{centerForm.id ? '编辑研究中心' : '新增研究中心'}</h2>
              {centerForm.id && (
                <button type="button" className="link-btn" onClick={() => setCenterForm({ id: '', name: '', code: '', pi: '', location: '' })} style={{ marginLeft: 'auto' }}>
                  <RotateCcw size={14} />新建
                </button>
              )}
            </div>
            <div className="form-grid">
              <label>
                <span>中心名称</span>
                <input type="text" value={centerForm.name} onChange={(e) => setCenterForm({ ...centerForm, name: e.target.value })} placeholder="例如：北京协和医院" />
              </label>
              <label>
                <span>中心编号</span>
                <input type="text" value={centerForm.code} onChange={(e) => setCenterForm({ ...centerForm, code: e.target.value })} placeholder="例如：BJ-XH-001" />
              </label>
              <label>
                <span>主要研究者（PI）</span>
                <input type="text" value={centerForm.pi} onChange={(e) => setCenterForm({ ...centerForm, pi: e.target.value })} placeholder="例如：张三" />
              </label>
              <label>
                <span>所在地区</span>
                <input type="text" value={centerForm.location} onChange={(e) => setCenterForm({ ...centerForm, location: e.target.value })} placeholder="例如：北京市东城区" />
              </label>
            </div>
            <button className="primary" type="button" onClick={addCenter}>
              <Save size={18} />
              {centerForm.id ? '更新中心' : '新增中心'}
            </button>
            <p className="hint">新增中心后将自动切换到该中心视图。默认中心为系统内置，不可删除。</p>
          </section>

          <section className="panel list-panel">
            <div className="panel-title">
              <Building2 size={18} />
              <h2>研究中心列表（{centers.length}）</h2>
            </div>
            <div className="records">
              {centers.map(c => {
                const cRecords = records.filter(r => r.centerId === c.id);
                const cSubjects = new Set(cRecords.map(r => r.subjectNo)).size;
                return (
                  <article className={'record center-record ' + (activeCenterId === c.id ? 'selected-center' : '')} key={c.id} onClick={() => switchCenter(c.id)}>
                    <div className="record-head">
                      <div>
                        <h3><Building2 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />{c.name}</h3>
                        <p>{c.code}{c.pi ? ` · PI: ${c.pi}` : ''}{c.location ? ` · ${c.location}` : ''}</p>
                        <p>受试者 {cSubjects} · 访视 {cRecords.length} · 创建于 {c.createdAt}</p>
                      </div>
                      {activeCenterId === c.id && <span className="status status-b">当前</span>}
                    </div>
                    <div className="actions" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => editCenter(c)}><Edit3 size={14} />编辑</button>
                      {c.id !== 'default' && (
                        <button className="ghost-danger" type="button" onClick={() => deleteCenter(c.id)}><Trash2 size={14} />删除</button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </section>
      ) : activeTab === 'export' ? (
        <section className="export-workspace">
          <section className="panel export-filter-panel">
            <div className="panel-title">
              <Filter size={18} />
              <h2>导出筛选条件</h2>
              <button type="button" className="link-btn" onClick={resetExportFilters} style={{ marginLeft: 'auto' }}>
                <RotateCcw size={14} />重置
              </button>
            </div>

            <div className="export-scope-hint">
              当前数据范围：<strong>{activeCenterId === '__hq__' ? '📊 总部汇总（全部中心）' : centerName}</strong>
            </div>

            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label>
                <span>起始日期（计划/入组日）</span>
                <input
                  type="date"
                  value={exportFilters.startDate}
                  onChange={(e) => setExportFilters({ ...exportFilters, startDate: e.target.value })}
                />
              </label>
              <label>
                <span>截止日期（计划/入组日）</span>
                <input
                  type="date"
                  value={exportFilters.endDate}
                  onChange={(e) => setExportFilters({ ...exportFilters, endDate: e.target.value })}
                />
              </label>
              <label>
                <span>试验分组</span>
                <select
                  value={exportFilters.group}
                  onChange={(e) => setExportFilters({ ...exportFilters, group: e.target.value })}
                >
                  <option value="全部">全部分组</option>
                  {allGroups.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </label>
              <label>
                <span>访视状态</span>
                <select
                  value={exportFilters.status}
                  onChange={(e) => setExportFilters({ ...exportFilters, status: e.target.value })}
                >
                  <option value="全部">全部状态</option>
                  {appConfig.statuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="wide">
                <span>受试者编号搜索</span>
                <input
                  type="text"
                  value={exportFilters.subjectQuery}
                  onChange={(e) => setExportFilters({ ...exportFilters, subjectQuery: e.target.value })}
                  placeholder="输入受试者编号关键词，例如 SUB-001"
                />
              </label>
            </div>

            <div className="export-stats-row">
              <div className="export-stat-item">
                <strong>{exportScopeRecords.length}</strong>
                <span>条访视记录</span>
              </div>
              <div className="export-stat-item">
                <strong>{exportScopeDeviations.length}</strong>
                <span>条偏差记录</span>
              </div>
              <div className="export-stat-item">
                <strong>{new Set(exportScopeRecords.map(r => r.subjectNo)).size}</strong>
                <span>位受试者</span>
              </div>
            </div>

            <div className="export-action-row">
              <button
                type="button"
                className="secondary-btn"
                onClick={runExportPreview}
                disabled={exportProgress.active || exportScopeRecords.length === 0}
              >
                <Eye size={16} />预览数据
              </button>
              <button
                type="button"
                className="primary"
                onClick={runExport}
                disabled={exportProgress.active || exportScopeRecords.length === 0}
                style={{ marginTop: 14 }}
              >
                <Download size={18} />
                导出 CSV 归档包（访视数据 + 偏差记录 + 时间线）
              </button>
            </div>

            {exportProgress.cancelled && (
              <div className="export-cancelled-hint">
                <XCircle size={16} />导出已取消
              </div>
            )}

            {exportProgress.active && (
              <div className="export-progress-panel">
                <div className="export-progress-head">
                  <Loader2 size={18} className="spin" />
                  <span>{exportProgress.phase}</span>
                  <button type="button" className="export-cancel-btn" onClick={cancelExport}>
                    <XCircle size={14} />取消
                  </button>
                </div>
                <div className="export-progress-bar">
                  <div
                    className="export-progress-fill"
                    style={{ width: `${exportProgress.total > 0 ? Math.min(100, (exportProgress.current / exportProgress.total) * 100) : 0}%` }}
                  />
                </div>
                <div className="export-progress-text">
                  {exportProgress.current} / {exportProgress.total} （{exportProgress.total > 0 ? Math.round((exportProgress.current / exportProgress.total) * 100) : 0}%）
                </div>
              </div>
            )}

            {exportPreview && !exportProgress.active && (
              <div className="export-preview-panel">
                <div className="panel-title" style={{ marginTop: 10 }}>
                  <Table size={16} />
                  <h3>数据预览（前 {Math.min(20, exportPreview.rows.length)} 条 / 共 {exportPreview.totalCount} 条）</h3>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280' }}>生成于 {exportPreview.generatedAt}</span>
                </div>

                {exportPreview.totalMissing > 0 && (
                  <div className="export-missing-alert">
                    <AlertTriangle size={18} />
                    <div>
                      <strong>检测到 {exportPreview.totalMissing} 条记录存在缺失字段</strong>
                      <p>以下记录缺少关键数据，建议在导出前补录（最多展示 10 条）：</p>
                      <ul>
                        {exportPreview.missingInfo.map((m, i) => (
                          <li key={i}>
                            <strong>{m.subjectNo || '未命名'} {m.visitName || ''}</strong> — 缺失：{m.missing}
                          </li>
                        ))}
                        {exportPreview.totalMissing > exportPreview.missingInfo.length && (
                          <li style={{ color: '#6b7280' }}>
                            ... 还有 {exportPreview.totalMissing - exportPreview.missingInfo.length} 条记录存在缺失字段
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}

                <div className="export-preview-summary">
                  <span><FileSpreadsheet size={14} /> 访视数据：{exportPreview.totalCount} 条</span>
                  <span><AlertCircle size={14} /> 偏差记录：{exportPreview.deviationCount} 条</span>
                </div>

                <div className="export-preview-table-wrap">
                  <table className="export-preview-table">
                    <thead>
                      <tr>
                        <th>受试者</th>
                        <th>分组</th>
                        <th>访视</th>
                        <th>计划日期</th>
                        <th>实际日期</th>
                        <th>状态</th>
                        <th>检查项目</th>
                        <th>关联偏差</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exportPreview.rows.map((row, i) => (
                        <tr key={i}>
                          <td>{row.subjectNo}</td>
                          <td>{row.group}</td>
                          <td>{row.visitName}</td>
                          <td>{row.plannedDate}</td>
                          <td>{row.actualDate || '-'}</td>
                          <td>{row.status}</td>
                          <td className="export-td-truncate">{row.items}</td>
                          <td>{row.hasLinkedDeviation === '是' ? `${row.deviationSeverity || ''}·${row.deviationStatus || ''}` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="export-package-hint">
                  <Archive size={16} />
                  <div>
                    <strong>归档包内容说明：</strong>
                    <ul>
                      <li><code>访视数据_*.csv</code> — 包含研究中心、受试者、分组、访视名称、入组日期、计划日期、窗口、实际日期、检查项目、访视状态、偏差记录、状态时间线等 17 个字段</li>
                      <li><code>偏差记录_*.csv</code> — 包含严重程度、偏差类型、处理状态、标题、描述、报告信息、处理措施等 14 个字段</li>
                      <li><code>状态时间线_*.csv</code> — 所有访视和偏差的完整状态流转记录，便于审计追踪</li>
                    </ul>
                    <p style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>
                      💡 所有 CSV 文件均使用 UTF-8 with BOM 编码，确保在 Excel 中打开中文不乱码。
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="panel export-history-panel">
            <div className="panel-title">
              <FileArchive size={18} />
              <h2>导出历史（最近 10 次）</h2>
            </div>
            {exportHistory.length === 0 ? (
              <p className="empty" style={{ textAlign: 'center', padding: 20 }}>暂无导出记录，配置筛选条件后点击"导出 CSV 归档包"即可开始。</p>
            ) : (
              <div className="export-history-list">
                {exportHistory.map(h => (
                  <div className="export-history-item" key={h.id}>
                    <div className="export-history-main">
                      <strong>#{h.stamp}</strong>
                      <span>范围：{h.scope}</span>
                      <span>访视 {h.visitCount} 条 · 偏差 {h.devCount} 条</span>
                    </div>
                    <span className="export-history-time">{h.at}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="export-tips-card">
              <h4><AlertCircle size={16} />使用提示</h4>
              <ul>
                <li>大批量数据（超过 500 条）导出时会显示进度条，可随时点击"取消"中止任务</li>
                <li>导出前建议先点击"预览数据"，查看缺失字段提示，确保数据完整</li>
                <li>CSV 文件自带 UTF-8 BOM 标记，在 Excel、WPS 中直接打开不会乱码</li>
                <li>如需按中心分别导出，请在顶部切换到具体中心后再执行导出</li>
              </ul>
            </div>
          </section>
        </section>
      ) : activeTab === 'version' ? (
        <section className="version-workspace">
          <section className="panel version-sidebar">
            <div className="panel-title">
              <GitBranch size={18} />
              <h2>方案版本</h2>
            </div>

            <div className="version-sub-tabs">
              <button type="button" className={'version-sub-btn ' + (versionTab === 'list' ? 'active' : '')} onClick={() => setVersionTab('list')}>
                <History size={14} />版本列表
              </button>
              <button type="button" className={'version-sub-btn ' + (versionTab === 'compare' ? 'active' : '')} onClick={() => setVersionTab('compare')}>
                <GitCompare size={14} />版本对比
              </button>
              <button type="button" className={'version-sub-btn ' + (versionTab === 'audit' ? 'active' : '')} onClick={() => setVersionTab('audit')}>
                <ShieldCheck size={14} />审计日志
              </button>
            </div>

            {versionTab === 'list' && (
              <div className="version-list-section">
                <div className="version-publish-row">
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        if (!confirm('确认基于当前模板发布新版本？发布后将成为当前生效版本。')) return;
                        publishVersion(e.target.value);
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">选择模板发布新版本...</option>
                    {centerTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}（{(t.visits || []).length}个访视）</option>
                    ))}
                  </select>
                </div>

                {centerVersions.length === 0 ? (
                  <p className="empty" style={{ textAlign: 'center', padding: 30 }}>
                    暂无版本记录。<br />选择一个访视方案模板发布首个版本。
                  </p>
                ) : (
                  <div className="version-cards">
                    {(() => {
                      const grouped = {};
                      centerVersions.forEach(v => {
                        const key = v.templateId;
                        (grouped[key] ||= []).push(v);
                      });
                      return Object.entries(grouped).map(([tplId, vers]) => {
                        const sorted = vers.sort(compareVersionOrder);
                        return (
                          <div key={tplId} className="version-group">
                            <div className="version-group-title">
                              <FileText size={14} />
                              <strong>{sorted[0]?.templateName || '未知方案'}</strong>
                              <span className="version-count">{sorted.length} 个版本</span>
                            </div>
                            {sorted.map(v => (
                              <div
                                key={v.id}
                                className={'version-card ' + (selectedVersionId === v.id ? 'selected' : '') + (v.isCurrent ? ' current' : '')}
                                onClick={() => setSelectedVersionId(v.id)}
                              >
                                <div className="version-card-head">
                                  <span className="version-tag">{v.version}</span>
                                  {v.isCurrent && <span className="version-current-badge">当前生效</span>}
                                  {v.lastMigration && <span className="version-migrated-badge">已迁移</span>}
                                </div>
                                <div className="version-card-meta">
                                  <span>{v.publishedAt} · {v.publishedBy}</span>
                                  <span>{(v.visits || []).length} 个访视</span>
                                </div>
                                <div className="version-card-visits">
                                  {(v.visits || [])
                                    .filter(vv => vv.visitName)
                                    .sort((a, b) => Number(a.plannedDays) - Number(b.plannedDays))
                                    .slice(0, 5)
                                    .map((vv, i) => (
                                      <span key={i} className="version-visit-chip">
                                        {vv.visitName} D{vv.plannedDays}
                                      </span>
                                    ))
                                  }
                                  {(v.visits || []).length > 5 && (
                                    <span className="version-visit-more">+{(v.visits || []).length - 5}</span>
                                  )}
                                </div>
                                {v.lastMigration && (
                                  <button
                                    type="button"
                                    className="version-rollback-btn"
                                    onClick={(e) => { e.stopPropagation(); rollbackMigration(v.lastMigration); }}
                                  >
                                    <Undo2 size={12} />回滚迁移
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            )}

            {versionTab === 'compare' && (
              <div className="version-compare-section">
                <div className="compare-selectors">
                  <label>
                    <span>旧版本</span>
                    <select value={comparePair.oldId} onChange={(e) => setComparePair({ ...comparePair, oldId: e.target.value })}>
                      <option value="">选择旧版本...</option>
                      {centerVersions.map(v => (
                        <option key={v.id} value={v.id}>{v.templateName} {v.version} ({v.publishedAt})</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>新版本</span>
                    <select value={comparePair.newId} onChange={(e) => setComparePair({ ...comparePair, newId: e.target.value })}>
                      <option value="">选择新版本...</option>
                      {centerVersions.map(v => (
                        <option key={v.id} value={v.id}>{v.templateName} {v.version} ({v.publishedAt})</option>
                      ))}
                    </select>
                  </label>
                </div>
                {comparison && (
                  <div className="compare-summary">
                    <div className="compare-summary-stats">
                      <span className="diff-added">{comparison.diffs.filter(d => d.type === 'added').length} 新增</span>
                      <span className="diff-removed">{comparison.diffs.filter(d => d.type === 'removed').length} 删除</span>
                      <span className="diff-changed">{comparison.diffs.filter(d => d.type === 'changed').length} 变更</span>
                      <span className="diff-unchanged">{comparison.diffs.filter(d => d.type === 'unchanged').length} 未变</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {versionTab === 'audit' && (
              <div className="version-audit-section">
                {versionAudits.length === 0 ? (
                  <p className="empty" style={{ textAlign: 'center', padding: 20 }}>暂无审计记录。</p>
                ) : (
                  <div className="audit-list">
                    {versionAudits.map(a => (
                      <div key={a.id} className="audit-entry">
                        <div className="audit-icon">
                          {a.action === 'publish_version' && <FileCheck2 size={14} />}
                          {a.action === 'execute_migration' && <ArrowRightLeft size={14} />}
                          {a.action === 'rollback_migration' && <Undo2 size={14} />}
                        </div>
                        <div className="audit-body">
                          <div className="audit-detail">{a.detail}</div>
                          <div className="audit-meta">
                            <span>{a.timestamp ? new Date(a.timestamp).toLocaleString('zh-CN') : ''}</span>
                            <span>{a.operator}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="panel version-main">
            {versionTab === 'list' && selectedVersionId && (() => {
              const ver = centerVersions.find(v => v.id === selectedVersionId);
              if (!ver) return <p className="empty">请选择一个版本查看详情。</p>;
              return (
                <div className="version-detail">
                  <div className="panel-title">
                    <FileCheck2 size={18} />
                    <h2>{ver.templateName} {ver.version}</h2>
                    {ver.isCurrent && <span className="version-current-badge" style={{ marginLeft: 8 }}>当前生效</span>}
                  </div>
                  <div className="version-detail-meta">
                    <span><Clock size={12} /> 发布日期：{ver.publishedAt}</span>
                    <span><User size={12} /> 发布人：{ver.publishedBy}</span>
                    <span><ClipboardList size={12} /> 访视数量：{(ver.visits || []).length}</span>
                  </div>

                  <div className="version-visit-table-wrap">
                    <table className="version-visit-table">
                      <thead>
                        <tr>
                          <th>访视名称</th>
                          <th>计划天数</th>
                          <th>窗口(±天)</th>
                          <th>检查项目</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(ver.visits || [])
                          .filter(v => v.visitName)
                          .sort((a, b) => Number(a.plannedDays) - Number(b.plannedDays))
                          .map((v, i) => (
                            <tr key={i}>
                              <td><strong>{v.visitName}</strong></td>
                              <td>D{v.plannedDays}</td>
                              <td>±{v.windowDays || 0}</td>
                              <td>{v.items || '-'}</td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </div>

                  {ver.isCurrent && (
                    <div className="version-migration-section">
                      <div className="panel-title">
                        <ArrowRightLeft size={18} />
                        <h3>访视计划迁移</h3>
                      </div>
                      <p className="hint" style={{ marginBottom: 12 }}>
                        将当前生效版本的访视计划迁移到已入组受试者。已完成访视和人工调整记录不会被覆盖。
                      </p>

                      {migrationStep === 'select' && (
                        <div className="migration-select">
                          <label>
                            <span>全局迁移策略</span>
                            <select
                              value={migrationForm.globalStrategy}
                              onChange={(e) => setMigrationForm({ ...migrationForm, globalStrategy: e.target.value })}
                            >
                              {MIGRATION_STRATEGIES.map(s => (
                                <option key={s.key} value={s.key}>{s.label}</option>
                              ))}
                            </select>
                          </label>
                          <div className="strategy-desc">
                            {MIGRATION_STRATEGIES.find(s => s.key === migrationForm.globalStrategy)?.desc}
                          </div>
                          <button
                            type="button"
                            className="primary"
                            onClick={() => previewMigration(ver.id, migrationForm.globalStrategy)}
                          >
                            <Eye size={16} />预览迁移影响
                          </button>
                        </div>
                      )}

                      {migrationStep === 'preview' && migrationPreview && (
                        <div className="migration-preview">
                          <div className="migration-preview-header">
                            <h4>
                              <AlertTriangle size={16} /> 迁移影响预览
                            </h4>
                            <span className="migration-diff-summary">
                              {migrationPreview.diffs.filter(d => d.type !== 'unchanged').length} 项差异 · {migrationPreview.subjects.filter(s => s.affectedCount > 0).length} 位受试者受影响
                            </span>
                          </div>

                          {migrationPreview.diffs.filter(d => d.type !== 'unchanged').length > 0 && (
                            <div className="migration-diffs">
                              <strong>方案差异：</strong>
                              {migrationPreview.diffs.filter(d => d.type !== 'unchanged').map((d, i) => (
                                <span key={i} className={'diff-badge ' + (DIFF_TYPES[d.type]?.className || '')}>
                                  {d.visitName}: {DIFF_TYPES[d.type]?.label || d.type}
                                  {d.type === 'changed' && d.changes.length > 0 && (
                                    <em>({d.changes.map(c => `${c.label} ${c.oldVal}→${c.newVal}`).join(', ')})</em>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}

                          {migrationPreview.subjects.length === 0 ? (
                            <p className="empty" style={{ padding: 16, textAlign: 'center' }}>当前中心没有已入组受试者需要迁移。</p>
                          ) : (
                            <div className="migration-subjects">
                              {migrationPreview.subjects.filter(s => s.affectedCount > 0).map(subj => (
                                <div key={subj.subjectNo} className="migration-subject-card">
                                  <div className="migration-subject-head">
                                    <strong>{subj.subjectNo}</strong>
                                    <span>{subj.group} · 入组{subj.enrollDate}</span>
                                    <span className="migration-affected-count">{subj.affectedCount} 项受影响</span>
                                  </div>
                                  <div className="migration-impact-list">
                                    {subj.impacts.filter(imp => imp.affected).map((imp, i) => (
                                      <div key={i} className="migration-impact-item">
                                        <div className="migration-impact-visit">
                                          <span className={'diff-badge ' + (DIFF_TYPES[imp.diffType]?.className || '')}>
                                            {DIFF_TYPES[imp.diffType]?.label || imp.diffType}
                                          </span>
                                          <strong>{imp.visitName}</strong>
                                        </div>
                                        <div className="migration-impact-reason">{imp.reason}</div>
                                        {!imp.protected && (
                                          <div className="migration-impact-strategy">
                                            <label>
                                              <span>策略</span>
                                              <select
                                                value={migrationForm.subjectStrategies[`${subj.subjectNo}__${imp.visitName}`] || 'manual'}
                                                onChange={(e) => {
                                                  const next = { ...migrationForm.subjectStrategies };
                                                  next[`${subj.subjectNo}__${imp.visitName}`] = e.target.value;
                                                  setMigrationForm({ ...migrationForm, subjectStrategies: next });
                                                }}
                                              >
                                                {MIGRATION_STRATEGIES.map(s => (
                                                  <option key={s.key} value={s.key}>{s.label}</option>
                                                ))}
                                              </select>
                                            </label>
                                          </div>
                                        )}
                                        {imp.protected && (
                                          <div className="migration-impact-protected">
                                            <ShieldCheck size={12} /> 受保护（不覆盖）
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="migration-actions">
                            <button type="button" className="secondary-btn" onClick={() => { setMigrationStep('select'); setMigrationPreview(null); }}>
                              <RotateCcw size={14} />返回修改
                            </button>
                            <button
                              type="button"
                              className="primary"
                              onClick={() => {
                                if (!confirm('确认执行迁移？未执行访视将按所选策略更新。')) return;
                                executeMigration();
                              }}
                              disabled={!migrationPreview.subjects.some(s => s.affectedCount > 0)}
                            >
                              <ArrowRightLeft size={16} />执行迁移
                            </button>
                          </div>
                        </div>
                      )}

                      {migrationStep === 'done' && (
                        <div className="migration-done">
                          <div className="migration-done-icon">
                            <CheckCircle2 size={40} />
                          </div>
                          <h3>迁移完成</h3>
                          <p>访视计划已按策略更新。已完成访视和人工调整记录保持不变。</p>
                          <p className="hint">可在"审计日志"标签页查看本次迁移的详细记录。如需撤销，可在版本卡片中点击"回滚迁移"。</p>
                          <button type="button" className="secondary-btn" onClick={() => { setMigrationStep('select'); setMigrationPreview(null); }}>
                            <RefreshCw size={14} />再次迁移
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {versionTab === 'list' && !selectedVersionId && (
              <div className="version-main-empty">
                <GitBranch size={48} />
                <h3>选择一个版本查看详情</h3>
                <p>在左侧版本列表中点击某个版本，可查看其访视配置、执行迁移操作。</p>
                <p className="hint">如需对比两个版本，请切换到"版本对比"标签。</p>
              </div>
            )}

            {versionTab === 'compare' && comparison && (
              <div className="compare-detail">
                <div className="panel-title">
                  <GitCompare size={18} />
                  <h2>{comparison.oldVer.templateName} {comparison.oldVer.version} → {comparison.newVer.version}</h2>
                </div>

                <div className="compare-versions-row">
                  <div className="compare-version-col">
                    <h4>{comparison.oldVer.version}（旧）· {comparison.oldVer.publishedAt}</h4>
                    <table className="compare-table">
                      <thead>
                        <tr><th>访视</th><th>天数</th><th>窗口</th><th>项目</th></tr>
                      </thead>
                      <tbody>
                        {(comparison.oldVer.visits || []).filter(v => v.visitName).sort((a, b) => Number(a.plannedDays) - Number(b.plannedDays)).map((v, i) => (
                          <tr key={i}><td>{v.visitName}</td><td>D{v.plannedDays}</td><td>±{v.windowDays || 0}</td><td>{v.items || '-'}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="compare-arrow-col">
                    <ArrowLeftRight size={20} />
                  </div>
                  <div className="compare-version-col">
                    <h4>{comparison.newVer.version}（新）· {comparison.newVer.publishedAt}</h4>
                    <table className="compare-table">
                      <thead>
                        <tr><th>访视</th><th>天数</th><th>窗口</th><th>项目</th></tr>
                      </thead>
                      <tbody>
                        {(comparison.newVer.visits || []).filter(v => v.visitName).sort((a, b) => Number(a.plannedDays) - Number(b.plannedDays)).map((v, i) => (
                          <tr key={i}><td>{v.visitName}</td><td>D{v.plannedDays}</td><td>±{v.windowDays || 0}</td><td>{v.items || '-'}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="compare-diff-list">
                  <h4><GitCompare size={14} /> 差异明细</h4>
                  {comparison.diffs.length === 0 ? (
                    <p className="empty">两个版本完全一致。</p>
                  ) : (
                    <table className="diff-table">
                      <thead>
                        <tr>
                          <th>访视名称</th>
                          <th>差异类型</th>
                          <th>旧计划天数</th>
                          <th>新计划天数</th>
                          <th>旧窗口</th>
                          <th>新窗口</th>
                          <th>检查项目变更</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparison.diffs.map((d, i) => (
                          <tr key={i} className={'diff-row ' + (DIFF_TYPES[d.type]?.className || '')}>
                            <td><strong>{d.visitName}</strong></td>
                            <td><span className={'diff-badge ' + (DIFF_TYPES[d.type]?.className || '')}>{DIFF_TYPES[d.type]?.label || d.type}</span></td>
                            <td>{d.old ? `D${d.old.plannedDays}` : '-'}</td>
                            <td>{d.new ? `D${d.new.plannedDays}` : '-'}</td>
                            <td>{d.old ? `±${d.old.windowDays || 0}` : '-'}</td>
                            <td>{d.new ? `±${d.new.windowDays || 0}` : '-'}</td>
                            <td>
                              {d.type === 'changed' ? d.changes.map((c, j) => (
                                <span key={j} className="diff-change-item">
                                  {c.label}: {String(c.oldVal)}→{String(c.newVal)}
                                </span>
                              )) : d.type === 'added' ? (d.new?.items || '-') : (d.old?.items || '-')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {versionTab === 'compare' && !comparison && (
              <div className="version-main-empty">
                <GitCompare size={48} />
                <h3>选择两个版本进行对比</h3>
                <p>在左侧分别选择旧版本和新版本，系统将自动比较访视节点、相对天数、窗口和检查项目的差异。</p>
              </div>
            )}

            {versionTab === 'audit' && (
              <div className="audit-detail-panel">
                <div className="panel-title">
                  <ShieldCheck size={18} />
                  <h2>版本管理审计日志</h2>
                </div>
                <p className="hint" style={{ marginBottom: 16 }}>
                  完整记录所有版本发布、迁移执行、字段变更、记录增删及回滚操作，每条日期和状态变化均可追溯来源。
                </p>
                {versionAudits.length === 0 ? (
                  <p className="empty" style={{ padding: 30, textAlign: 'center' }}>暂无审计记录。发布版本或执行迁移后将自动记录。</p>
                ) : (
                  <div className="audit-table-wrap">
                    <table className="audit-table">
                      <thead>
                        <tr>
                          <th style={{ width: 170 }}>时间</th>
                          <th style={{ width: 110 }}>操作类型</th>
                          <th style={{ width: 80 }}>操作人</th>
                          <th style={{ width: 110 }}>受试者</th>
                          <th style={{ width: 90 }}>访视</th>
                          <th>变更详情</th>
                          <th style={{ width: 180 }}>来源</th>
                        </tr>
                      </thead>
                      <tbody>
                        {versionAudits.map(a => (
                          <tr key={a.id} className={'audit-row audit-row-' + a.action}>
                            <td className="audit-time">{a.timestamp ? new Date(a.timestamp).toLocaleString('zh-CN') : '-'}</td>
                            <td>
                              <span className={'audit-type-badge audit-type-' + a.action}>
                                {a.action === 'publish_version' && '发布版本'}
                                {a.action === 'execute_migration' && '执行迁移'}
                                {a.action === 'rollback_migration' && '回滚迁移'}
                                {a.action === 'field_change' && '字段变更'}
                                {a.action === 'record_add' && '新增记录'}
                                {a.action === 'record_cancel' && '取消访视'}
                                {a.action === 'rollback_field_restore' && '回滚字段'}
                                {a.action === 'rollback_remove_added' && '回滚新增'}
                                {a.action === 'rollback_restore_cancelled' && '回滚取消'}
                                {a.action === 'rollback_pending_confirm' && '回滚待确认'}
                              </span>
                            </td>
                            <td>{a.operator || '-'}</td>
                            <td>{a.subjectNo || '-'}</td>
                            <td>{a.visitName || '-'}</td>
                            <td>
                              <div className="audit-detail">{a.detail || '-'}</div>
                              {a.fieldName && (
                                <div className="audit-field-change">
                                  <span className="audit-field-name">{a.fieldLabel || a.fieldName}</span>
                                  <span className="audit-old-val">{String(a.oldValue ?? '-')}</span>
                                  <span className="audit-arrow">→</span>
                                  <span className="audit-new-val">{String(a.newValue ?? '-')}</span>
                                </div>
                              )}
                              {a.stats && (
                                <div className="audit-stats">
                                  统计:
                                  {a.stats.updated !== undefined && <span>更新{a.stats.updated}</span>}
                                  {a.stats.added !== undefined && <span>新增{a.stats.added}</span>}
                                  {a.stats.cancelled !== undefined && <span>取消{a.stats.cancelled}</span>}
                                  {a.stats.total !== undefined && <span>合计{a.stats.total}</span>}
                                  {a.stats.restoredUpdated !== undefined && <span>还原更新{a.stats.restoredUpdated}</span>}
                                  {a.stats.restoredCancelled !== undefined && <span>恢复取消{a.stats.restoredCancelled}</span>}
                                  {a.stats.removedAdded !== undefined && <span>移除新增{a.stats.removedAdded}</span>}
                                  {a.stats.restoredPending !== undefined && <span>清待确认{a.stats.restoredPending}</span>}
                                </div>
                              )}
                            </td>
                            <td className="audit-source">
                              {a.source ? (
                                <>
                                  <div className="audit-source-text">{a.source}</div>
                                  {a.migrationId && <div className="audit-migration-id">迁移ID: {a.migrationId.slice(0, 8)}…</div>}
                                </>
                              ) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>
        </section>
      ) : null}

      <section className="insights">
        {activeCenterId === '__hq__' ? (
          <div className="panel" style={{ gridColumn: '1 / -1' }}>
            <div className="panel-title">
              <BarChart3 size={18} />
              <h2>各中心数据对比</h2>
            </div>
            <div className="hq-comparison-table-wrap">
              <table className="hq-comparison-table">
                <thead>
                  <tr>
                    <th>中心</th>
                    <th>编号</th>
                    <th>PI</th>
                    <th>入组数</th>
                    <th>总访视</th>
                    <th>窗口内</th>
                    <th>已超窗</th>
                    <th>窗口内率</th>
                    <th>超窗率</th>
                    <th>偏差待处理</th>
                    <th>严重偏差</th>
                  </tr>
                </thead>
                <tbody>
                  {centers.map(c => {
                    const cRecords = records.filter(r => r.centerId === c.id);
                    const cSubjects = new Set(cRecords.map(r => r.subjectNo)).size;
                    const cInWindow = cRecords.filter(r => r.status === '窗口内').length;
                    const cOverdue = cRecords.filter(r => r.status === '已超窗').length;
                    const cTotal = cRecords.length;
                    const cDevs = deviations.filter(d => d.centerId === c.id);
                    const cDevOpen = cDevs.filter(d => d.status !== 'closed').length;
                    const cDevSevere = cDevs.filter(d => d.severity === 'severe' || d.severity === 'critical').length;
                    const cOverdueRate = cTotal > 0 ? ((cOverdue / cTotal) * 100).toFixed(1) : '0.0';
                    const cInWindowRate = cTotal > 0 ? ((cInWindow / cTotal) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={c.id}>
                        <td><strong>{c.name}</strong></td>
                        <td>{c.code}</td>
                        <td>{c.pi || '-'}</td>
                        <td>{cSubjects}</td>
                        <td>{cTotal}</td>
                        <td>{cInWindow}</td>
                        <td>{cOverdue}</td>
                        <td>{cInWindowRate}%</td>
                        <td className={Number(cOverdueRate) > 20 ? 'text-danger' : ''}>{cOverdueRate}%</td>
                        <td>{cDevOpen}</td>
                        <td className={cDevSevere > 0 ? 'text-danger' : ''}>{cDevSevere}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <>
            <div className="panel">
              <div className="panel-title">
                <CalendarDays size={18} />
                <h2>{centerName} · 受试者访视分组</h2>
              </div>
              <div className="subject-groups">
                {Object.entries(groupedBySubject).map(([subject, items]) => (
                  <div key={subject} className="subject-group">
                    <div className="subject-head">
                      <strong>{subject}</strong>
                      <span>{items[0]?.group} · 入组{items[0]?.enrollDate}</span>
                    </div>
                    <div className="subject-visits">
                      {items
                        .slice()
                        .sort((a, b) => (a.plannedDays ?? 9999) - (b.plannedDays ?? 9999))
                        .map((item) => (
                          <span key={item.id} className={'visit-chip ' + statusClass(item.status)}>
                            <strong>{item.visitName}</strong>
                            <span>D{item.plannedDays ?? '?'} · {item.plannedDate || '-'}</span>
                            <em>{item.status}</em>
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
                {Object.keys(groupedBySubject).length === 0 && (
                  <p className="empty">暂无受试者数据。</p>
                )}
              </div>
            </div>

            <aside className="panel detail-panel">
              <div className="panel-title">
                <CheckCircle2 size={18} />
                <h2>详情</h2>
              </div>
              {selected ? (
                <div className="detail">
                  <h3>{`${selected.subjectNo} ${selected.visitName}`}</h3>
                  <p>{`${selected.group} · 入组${selected.enrollDate}${selected.plannedDate ? ` · 计划访视${selected.plannedDate}` : ''} · ±${selected.windowDays}天`}</p>
                  <p className="record-detail" style={{ fontSize: 12, color: '#6b7280' }}>
                    <Building2 size={12} style={{ verticalAlign: 'middle' }} /> 归属中心：{centers.find(c => c.id === selected.centerId)?.name || '未知'}
                  </p>
                  <p className="record-detail">{selected.items}</p>
                  {selected.deviation && (
                    <div className="warning" style={{ display: 'block' }}>
                      <AlertTriangle size={14} /> <strong>偏差记录：</strong>{selected.deviation}
                    </div>
                  )}
                  {(() => {
                    const recDev = deviations.find(d => d.sourceRecordId === selected.id);
                    if (recDev) {
                      return (
                        <div style={{ padding: '10px 12px', border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 8, marginTop: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <strong style={{ fontSize: 13, color: '#92400e' }}><AlertTriangle size={12} style={{ verticalAlign: 'middle' }} /> 已关联偏差</strong>
                            <span className={`dev-severity ${severityClass(recDev.severity)}`}>{severityMeta(recDev.severity).label}</span>
                          </div>
                          <p style={{ fontSize: 13, color: '#78350f', margin: 0 }}>{recDev.title} · {statusMeta(recDev.status).label}</p>
                          <button type="button" className="link-btn" style={{ marginTop: 8, padding: '4px 0' }} onClick={() => { setSelectedDev(recDev); setActiveTab('deviation'); }}>
                            <ArrowRight size={12} />打开偏差管理查看详情
                          </button>
                        </div>
                      );
                    }
                    return (
                      <button type="button" className="link-btn" style={{ marginTop: 10, padding: '6px 10px', border: '1px dashed #d1d5db', borderRadius: 6 }} onClick={() => createDevFromRecord(selected)}>
                        <AlertTriangle size={12} /> 基于当前访视创建偏差记录
                      </button>
                    );
                  })()}
                  <div className="timeline">
                    {(selected.timeline || []).map((step, index) => (
                      <span key={index}>{step.at} · {step.status} · {step.by}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="empty">点击任意记录查看详情和状态流转。</p>
              )}
            </aside>
          </>
        )}
      </section>
    </main>
  );
}

export default App;
