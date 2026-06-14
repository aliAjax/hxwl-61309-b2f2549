import { useMemo, useState } from 'react';
import { ClipboardPlus, Plus, Search, Trash2, RotateCcw, CheckCircle2, AlertTriangle, ClipboardList, CalendarDays, FileText, Eye, Save, LayoutTemplate, X, List, Building2, BarChart3, Edit3, AlertCircle, SearchX, CheckSquare, UserCircle, Clock, Filter, ArrowRight, User } from 'lucide-react';
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
    "已超窗"
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
