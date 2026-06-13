import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { ClipboardPlus, Plus, Search, Trash2, RotateCcw, CheckCircle2, AlertTriangle, ClipboardList, CalendarDays, FileText, Eye, Save, LayoutTemplate, X, List, Upload, FileSpreadsheet, Users, Check, Download, Bell, Phone, MessageSquare, Send, Clock, ChevronLeft, ChevronRight, GripVertical, AlertCircle, Stethoscope, Square, SquareCheckBig, FileX } from 'lucide-react';
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
  "notifyStorage": "hxwl-61309-notify-records",
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

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function withIds(items) {
  return items.map((item) => ({ id: uid(), timeline: item.timeline || [{ status: item.status, at: today, by: '系统' }], ...item }));
}

function loadRecords() {
  const raw = localStorage.getItem(appConfig.storage);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return withIds(appConfig.seed);
    }
  }
  return withIds(appConfig.seed);
}

function loadTemplates() {
  const raw = localStorage.getItem(appConfig.templateStorage);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return [];
}

function saveTemplates(templates) {
  localStorage.setItem(appConfig.templateStorage, JSON.stringify(templates));
}

function loadNotifications() {
  const raw = localStorage.getItem(appConfig.notifyStorage);
  if (raw) {
    try { return JSON.parse(raw); }
    catch { return []; }
  }
  return [];
}

function saveNotifications(records) {
  localStorage.setItem(appConfig.notifyStorage, JSON.stringify(records));
}

function addDays(dateStr, days) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().slice(0, 10);
}

function safeAddDays(dateStr, days) {
  if (!dateStr) return null;
  if (typeof dateStr !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  if (y < 1900 || y > 2100) return null;
  const n = Number(days);
  if (!isFinite(n) || isNaN(n)) return null;
  const safeDays = Math.max(-36500, Math.min(36500, Math.round(n)));
  const result = new Date(y, m, day + safeDays);
  if (isNaN(result.getTime())) return null;
  const ry = result.getFullYear();
  if (ry < 1900 || ry > 2100) return null;
  return toISODate(result);
}

function parseSafeDate(dateStr) {
  if (!dateStr) return null;
  if (typeof dateStr !== 'string') return null;
  let d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    d = new Date(dateStr + 'T00:00:00');
  } else {
    d = new Date(dateStr);
  }
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  if (y < 1900 || y > 2100) return null;
  return d;
}

function toISODate(d) {
  if (!d || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function computeWindowDates(record) {
  if (!record || typeof record !== 'object') {
    return { windowStart: null, windowEnd: null, targetDate: null, scheduledDate: null, allDates: [] };
  }
  const plannedDate = record.plannedDate || '';
  const scheduledDate = record.scheduledDate || plannedDate || '';
  const windowDays = Number(record.windowDays) || 0;
  const hasValidPlannedDate = plannedDate && parseSafeDate(plannedDate);
  const hasValidScheduledDate = scheduledDate && parseSafeDate(scheduledDate);

  if (!hasValidPlannedDate && !hasValidScheduledDate) {
    return { windowStart: null, windowEnd: null, targetDate: null, scheduledDate: null, allDates: [] };
  }

  const ws = hasValidPlannedDate ? safeAddDays(plannedDate, -windowDays) : null;
  const we = hasValidPlannedDate ? safeAddDays(plannedDate, windowDays) : null;
  const allDates = [];
  if (ws && we) {
    const start = parseSafeDate(ws);
    const end = parseSafeDate(we);
    if (start && end) {
      try {
        const current = new Date(start);
        const endTime = end.getTime();
        let iterations = 0;
        const maxIterations = 366;
        while (current.getTime() <= endTime && iterations < maxIterations) {
          allDates.push(toISODate(current));
          current.setDate(current.getDate() + 1);
          iterations++;
        }
      } catch (e) {
        console.warn('计算窗口日期出错:', e);
      }
    }
  }
  if (hasValidScheduledDate && !allDates.includes(scheduledDate)) {
    allDates.push(scheduledDate);
  }
  return {
    windowStart: ws,
    windowEnd: we,
    targetDate: hasValidPlannedDate ? plannedDate : null,
    scheduledDate: hasValidScheduledDate ? scheduledDate : null,
    allDates,
  };
}

function getCalendarMonthGrid(year, month) {
  try {
    const safeYear = Math.max(1900, Math.min(2100, Number(year) || new Date().getFullYear()));
    const safeMonth = Math.max(0, Math.min(11, Number(month) || 0));
    
    const firstDay = new Date(safeYear, safeMonth, 1);
    if (isNaN(firstDay.getTime())) {
      const now = new Date();
      return getCalendarMonthGrid(now.getFullYear(), now.getMonth());
    }
    
    const startDow = firstDay.getDay();
    const startOffset = startDow === 0 ? 6 : startDow - 1;
    const gridStart = new Date(safeYear, safeMonth, 1 - startOffset);
    const cells = [];
    
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      if (!isNaN(d.getTime())) {
        cells.push(d);
      }
    }
    
    if (cells.length !== 42) {
      console.warn('日历网格生成异常，返回默认值');
      const now = new Date();
      return getCalendarMonthGrid(now.getFullYear(), now.getMonth());
    }
    
    return cells;
  } catch (e) {
    console.error('生成日历网格出错:', e);
    const now = new Date();
    return getCalendarMonthGrid(now.getFullYear(), now.getMonth());
  }
}

function getWeekDays(baseDate) {
  try {
    const d = parseSafeDate(baseDate) || new Date();
    if (isNaN(d.getTime())) {
      return getWeekDays(toISODate(new Date()));
    }
    const dow = d.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(d);
    monday.setDate(d.getDate() + mondayOffset);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const dd = new Date(monday);
      dd.setDate(monday.getDate() + i);
      if (!isNaN(dd.getTime())) {
        days.push(dd);
      }
    }
    if (days.length !== 7) {
      console.warn('周历生成异常，返回默认值');
      return getWeekDays(toISODate(new Date()));
    }
    return days;
  } catch (e) {
    console.error('生成周历出错:', e);
    return getWeekDays(toISODate(new Date()));
  }
}

function computeVisitStatus(dateOrRecord, windowDays, actualStatus) {
  try {
    if (actualStatus && actualStatus !== '待访视') return actualStatus;
    
    let scheduledDate;
    if (typeof dateOrRecord === 'object' && dateOrRecord !== null) {
      scheduledDate = dateOrRecord.scheduledDate || dateOrRecord.plannedDate || '';
    } else {
      scheduledDate = dateOrRecord;
    }
    
    if (!scheduledDate || !parseSafeDate(scheduledDate)) return '待访视';
    
    const plan = parseSafeDate(scheduledDate);
    if (!plan) return '待访视';
    
    const now = parseSafeDate(today);
    if (!now) return '待访视';
    
    const window = Number(windowDays) || 0;
    if (!isFinite(window)) return '待访视';
    
    const start = new Date(plan);
    start.setDate(start.getDate() - window);
    if (isNaN(start.getTime())) return '待访视';
    
    const end = new Date(plan);
    end.setDate(end.getDate() + window);
    if (isNaN(end.getTime())) return '待访视';
    
    const nowTime = now.getTime();
    const endTime = end.getTime();
    const startTime = start.getTime();
    
    if (nowTime > endTime) return '已超窗';
    if (nowTime >= startTime && nowTime <= endTime) return '窗口内';
    return '待访视';
  } catch (e) {
    console.warn('计算访视状态出错:', e);
    return actualStatus || '待访视';
  }
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

function categoryClass(category) {
  const map = { '已超窗': 'cat-overdue', '当天到期': 'cat-due', '窗口内': 'cat-in-window', '即将进入窗口': 'cat-upcoming' };
  return map[category] || 'cat-upcoming';
}

function parseItems(itemsStr) {
  if (!itemsStr || typeof itemsStr !== 'string') return [];
  return itemsStr
    .split(/[、,，;；\n]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function initExecutionItems(itemsStr, requiredItems = []) {
  const itemNames = parseItems(itemsStr);
  if (itemNames.length === 0) return [];
  return itemNames.map((name, idx) => ({
    id: `item-${idx}-${uid()}`,
    name,
    required: requiredItems.includes(name) || idx < 2,
    status: 'pending',
    result: '',
    reason: '',
  }));
}

function migrateRecords(records) {
  try {
    return records.map(record => {
      if (!record || typeof record !== 'object') return record;
      const migrated = { ...record };
      if (!migrated.scheduledDate && migrated.plannedDate) {
        migrated.scheduledDate = migrated.plannedDate;
      }
      if (!migrated.executionItems || !Array.isArray(migrated.executionItems)) {
        migrated.executionItems = initExecutionItems(migrated.items);
      }
      if (!migrated.actualDate) {
        migrated.actualDate = '';
      }
      return migrated;
    });
  } catch (e) {
    console.warn('数据迁移出错:', e);
    return records;
  }
}

function App() {
  const [records, setRecords] = useState(() => {
    const loaded = loadRecords();
    return migrateRecords(loaded);
  });
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

  const [batchParsedData, setBatchParsedData] = useState([]);
  const [batchErrors, setBatchErrors] = useState({});
  const [batchFileName, setBatchFileName] = useState('');
  const [batchDragOver, setBatchDragOver] = useState(false);
  const [batchImporting, setBatchImporting] = useState(false);

  const [notifyRecords, setNotifyRecords] = useState(loadNotifications);
  const [reminderGroupFilter, setReminderGroupFilter] = useState('全部');
  const [reminderCategoryFilter, setReminderCategoryFilter] = useState('全部');
  const [reminderDateStart, setReminderDateStart] = useState('');
  const [reminderDateEnd, setReminderDateEnd] = useState('');
  const [reminderSelected, setReminderSelected] = useState(new Set());
  const [notifyMethod, setNotifyMethod] = useState('短信');
  const [notifyOperator, setNotifyOperator] = useState('');
  const [notifySimulating, setNotifySimulating] = useState(false);
  const [notifySuccess, setNotifySuccess] = useState(false);

  const [calView, setCalView] = useState('month');
  const [calBaseDate, setCalBaseDate] = useState(toISODate(new Date()));
  const [calSubjectFilter, setCalSubjectFilter] = useState('全部');
  const [calGroupFilter, setCalGroupFilter] = useState('全部');
  const [draggingRecord, setDraggingRecord] = useState(null);
  const [dragOverDate, setDragOverDate] = useState(null);
  const [reasonModal, setReasonModal] = useState({ open: false, recordId: null, oldDate: '', newDate: '' });
  const [reasonText, setReasonText] = useState('');

  const [executionSelected, setExecutionSelected] = useState(null);
  const [executionForm, setExecutionForm] = useState(null);
  const [executionTab, setExecutionTab] = useState('items');

  function persist(next) {
    try {
      const migrated = migrateRecords(next);
      setRecords(migrated);
      localStorage.setItem(appConfig.storage, JSON.stringify(migrated));
    } catch (e) {
      console.error('保存数据出错:', e);
      setRecords(next);
      localStorage.setItem(appConfig.storage, JSON.stringify(next));
    }
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
      scheduledDate: form.plannedDate || '',
      status: form.status || appConfig.primaryStatus,
      createdAt: new Date().toISOString(),
      timeline: [{ status: form.status || appConfig.primaryStatus, at: today, by: '录入' }],
      executionItems: initExecutionItems(form.items),
      actualDate: '',
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
      const scheduledDate = plannedDate;
      const initialStatus = computeVisitStatus(scheduledDate, v.windowDays, null);
      return {
        id: uid(),
        subjectNo: form.subjectNo,
        group: form.group,
        enrollDate: form.enrollDate,
        plannedDate,
        scheduledDate,
        visitName: v.visitName,
        plannedDays: Number(v.plannedDays),
        windowDays: String(v.windowDays ?? 0),
        items: v.items || '',
        deviation: '',
        status: initialStatus,
        createdAt: new Date().toISOString(),
        timeline: [{ status: initialStatus, at: today, by: '模板生成' }],
        executionItems: initExecutionItems(v.items || ''),
        actualDate: '',
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
    const copied = { 
      ...item, 
      id: uid(), 
      scheduledDate: item.scheduledDate || item.plannedDate,
      status: appConfig.primaryStatus, 
      timeline: [{ status: appConfig.primaryStatus, at: today, by: '复制' }] 
    };
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

  function isValidDate(dateStr) {
    if (!dateStr) return false;
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    const d = new Date(dateStr);
    return d instanceof Date && !isNaN(d) && d.toISOString().slice(0, 10) === dateStr;
  }

  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    result.push(current.trim());
    return result;
  }

  function parseCSV(rawText) {
    let text = rawText;
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1);
    }
    const lines = text.split(/\r?\n/);
    const nonEmptyLines = lines.filter(l => l.trim().length > 0);
    if (nonEmptyLines.length === 0) return [];
    
    const headers = parseCSVLine(nonEmptyLines[0]);
    const headerMap = {};
    headers.forEach((h, i) => {
      headerMap[h.toLowerCase()] = i;
    });
    
    const requiredCols = ['受试者编号', '试验分组', '入组日期', '方案模板'];
    const requiredLower = requiredCols.map(c => c.toLowerCase());
    const missing = requiredLower.filter(col => !(col in headerMap));
    if (missing.length > 0) {
      throw new Error(`CSV文件缺少必要列：${requiredCols.join('、')}`);
    }
    
    const data = [];
    for (let i = 1; i < nonEmptyLines.length; i++) {
      const cols = parseCSVLine(nonEmptyLines[i]);
      while (cols.length < headers.length) cols.push('');
      data.push({
        subjectNo: (cols[headerMap['受试者编号']] || '').trim(),
        group: (cols[headerMap['试验分组']] || '').trim(),
        enrollDate: (cols[headerMap['入组日期']] || '').trim(),
        templateName: (cols[headerMap['方案模板']] || '').trim(),
        rowIndex: lines.indexOf(nonEmptyLines[i]) + 1,
      });
    }
    return data;
  }

  function validateBatchData(data) {
    const errors = {};
    const validGroups = appConfig.fields.find(f => f.key === 'group')?.options || [];
    const validTemplateNames = templates.map(t => t.name);
    const existingSubjects = new Set(records.map(r => r.subjectNo));
    const seenSubjects = new Set();
    
    data.forEach((row, idx) => {
      const rowErrors = [];
      
      if (!row.subjectNo) {
        rowErrors.push('受试者编号不能为空');
      } else {
        if (existingSubjects.has(row.subjectNo)) {
          rowErrors.push(`编号 ${row.subjectNo} 已存在于系统中`);
        }
        if (seenSubjects.has(row.subjectNo)) {
          rowErrors.push(`编号 ${row.subjectNo} 在CSV中重复`);
        }
        seenSubjects.add(row.subjectNo);
      }
      
      if (!row.group) {
        rowErrors.push('试验分组不能为空');
      } else if (!validGroups.includes(row.group)) {
        rowErrors.push(`分组 "${row.group}" 不存在，可选：${validGroups.join('、')}`);
      }
      
      if (!row.enrollDate) {
        rowErrors.push('入组日期不能为空');
      } else if (!isValidDate(row.enrollDate)) {
        rowErrors.push(`日期格式无效 "${row.enrollDate}"，请使用 YYYY-MM-DD 格式`);
      }
      
      if (!row.templateName) {
        rowErrors.push('方案模板不能为空');
      } else if (!validTemplateNames.includes(row.templateName)) {
        rowErrors.push(`模板 "${row.templateName}" 不存在，请先在模板页面创建`);
      }
      
      if (rowErrors.length > 0) {
        errors[idx] = rowErrors;
      }
    });
    
    return errors;
  }

  function handleBatchFile(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('请上传CSV格式文件');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const data = parseCSV(text);
        setBatchParsedData(data);
        setBatchFileName(file.name);
        setBatchErrors(validateBatchData(data));
      } catch (err) {
        alert(err.message);
        setBatchParsedData([]);
        setBatchFileName('');
        setBatchErrors({});
      }
    };
    reader.onerror = () => {
      alert('文件读取失败');
    };
    reader.readAsText(file, 'UTF-8');
  }

  function handleBatchFileInput(e) {
    const file = e.target.files?.[0];
    handleBatchFile(file);
    e.target.value = '';
  }

  function handleBatchDrop(e) {
    e.preventDefault();
    setBatchDragOver(false);
    const file = e.dataTransfer.files?.[0];
    handleBatchFile(file);
  }

  function clearBatchData() {
    setBatchParsedData([]);
    setBatchErrors({});
    setBatchFileName('');
  }

  function toggleReminderSelect(id) {
    const next = new Set(reminderSelected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setReminderSelected(next);
  }

  function toggleSelectAllReminders() {
    if (reminderSelected.size === filteredReminderVisits.length) {
      setReminderSelected(new Set());
    } else {
      setReminderSelected(new Set(filteredReminderVisits.map(v => v.id)));
    }
  }

  function batchNotify() {
    const visibleIds = new Set(filteredReminderVisits.map(v => v.id));
    const validSelected = [...reminderSelected].filter(id => visibleIds.has(id));
    if (validSelected.length === 0) {
      alert('请先选择需要通知的访视记录');
      return;
    }
    if (!notifyOperator.trim()) {
      alert('请填写操作人姓名');
      return;
    }
    setNotifySimulating(true);
    setTimeout(() => {
      const newNotifies = validSelected.map(recordId => ({
        id: uid(),
        recordId,
        notifiedAt: new Date().toISOString(),
        method: notifyMethod,
        operator: notifyOperator.trim(),
      }));
      const next = [...notifyRecords, ...newNotifies];
      setNotifyRecords(next);
      saveNotifications(next);
      setReminderSelected(new Set());
      setNotifySimulating(false);
      setNotifySuccess(true);
      setTimeout(() => setNotifySuccess(false), 2500);
    }, 900);
  }

  function singleNotify(recordId, method) {
    const operator = prompt('请输入操作人姓名：');
    if (!operator || !operator.trim()) return;
    const newNotify = {
      id: uid(),
      recordId,
      notifiedAt: new Date().toISOString(),
      method,
      operator: operator.trim(),
    };
    const next = [...notifyRecords, newNotify];
    setNotifyRecords(next);
    saveNotifications(next);
  }

  function isNotified(recordId) {
    return notifyRecords.some(n => n.recordId === recordId);
  }

  function getNotifyRecordsForVisit(recordId) {
    return notifyRecords.filter(n => n.recordId === recordId);
  }

  function downloadSampleCSV() {
    const sampleContent = [
      '受试者编号,试验分组,入组日期,方案模板',
      'SUB-100,A组,2026-06-01,Ⅱ期临床标准访视方案',
      'SUB-101,B组,2026-06-02,Ⅱ期临床标准访视方案',
      'SUB-102,对照组,2026-06-03,Ⅱ期临床标准访视方案',
    ].join('\n');
    const blob = new Blob(['\uFEFF' + sampleContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sample_batch_import.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function importBatchData() {
    const validRows = batchParsedData.filter((_, idx) => !batchErrors[idx]);
    if (validRows.length === 0) {
      alert('没有可导入的有效数据');
      return;
    }
    
    if (!confirm(`确认导入 ${validRows.length} 条受试者数据？将自动生成对应访视计划。`)) {
      return;
    }
    
    setBatchImporting(true);
    
    setTimeout(() => {
      try {
        const newRecords = [];
        
        for (const row of validRows) {
          const tpl = templates.find(t => t.name === row.templateName);
          if (!tpl) continue;
          
          const validVisits = (tpl.visits || [])
            .filter(v => v.visitName && v.plannedDays !== '' && v.plannedDays !== null && v.plannedDays !== undefined);
          
          for (const v of validVisits) {
            const plannedDate = addDays(row.enrollDate, v.plannedDays);
            const scheduledDate = plannedDate;
            const initialStatus = computeVisitStatus(scheduledDate, v.windowDays, null);
            newRecords.push({
              id: uid(),
              subjectNo: row.subjectNo,
              group: row.group,
              enrollDate: row.enrollDate,
              plannedDate,
              scheduledDate,
              visitName: v.visitName,
              plannedDays: Number(v.plannedDays),
              windowDays: String(v.windowDays ?? 0),
              items: v.items || '',
              deviation: '',
              status: initialStatus,
              createdAt: new Date().toISOString(),
              timeline: [{ status: initialStatus, at: today, by: '批量导入' }],
              executionItems: initExecutionItems(v.items || ''),
              actualDate: '',
            });
          }
        }
        
        persist([...newRecords, ...records]);
        clearBatchData();
        setActiveTab('record');
        alert(`成功导入 ${validRows.length} 名受试者，共生成 ${newRecords.length} 条访视记录`);
      } catch (err) {
        alert('导入失败：' + err.message);
      } finally {
        setBatchImporting(false);
      }
    }, 300);
  }

  function calNavigate(direction) {
    const d = parseSafeDate(calBaseDate) || new Date();
    if (calView === 'month') {
      d.setMonth(d.getMonth() + direction);
    } else {
      d.setDate(d.getDate() + direction * 7);
    }
    setCalBaseDate(toISODate(d));
  }

  function calGoToday() {
    setCalBaseDate(toISODate(new Date()));
  }

  function handleCalDragStart(e, record) {
    try {
      if (!record || !record.id) {
        e.preventDefault();
        return;
      }
      if (record.status === '已完成') {
        e.preventDefault();
        return;
      }
      setDraggingRecord(record);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', record.id);
    } catch (err) {
      console.warn('拖拽开始出错:', err);
      e.preventDefault();
    }
  }

  function handleCalDragOver(e, dateStr) {
    try {
      if (!dateStr || !parseSafeDate(dateStr)) {
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverDate(dateStr);
    } catch (err) {
      console.warn('拖拽悬停出错:', err);
    }
  }

  function handleCalDragLeave() {
    try {
      setDragOverDate(null);
    } catch (err) {
      console.warn('拖拽离开出错:', err);
    }
  }

  function handleCalDrop(e, dateStr) {
    try {
      e.preventDefault();
      setDragOverDate(null);
      if (!draggingRecord || !draggingRecord.id) {
        setDraggingRecord(null);
        return;
      }
      if (!dateStr || !parseSafeDate(dateStr)) {
        setDraggingRecord(null);
        return;
      }
      const currentScheduled = draggingRecord.scheduledDate || draggingRecord.plannedDate || '';
      if (dateStr === currentScheduled) {
        setDraggingRecord(null);
        return;
      }
      setReasonModal({
        open: true,
        recordId: draggingRecord.id,
        oldDate: currentScheduled,
        newDate: dateStr,
      });
      setReasonText('');
      setDraggingRecord(null);
    } catch (err) {
      console.warn('拖拽放置出错:', err);
      setDraggingRecord(null);
      setDragOverDate(null);
    }
  }

  function confirmReasonModal() {
    try {
      if (!reasonText.trim()) {
        alert('请填写调整原因');
        return;
      }
      const { recordId, oldDate, newDate } = reasonModal;
      if (!recordId || !newDate || !parseSafeDate(newDate)) {
        setReasonModal({ open: false, recordId: null, oldDate: '', newDate: '' });
        setReasonText('');
        return;
      }
      const rec = records.find(r => r.id === recordId);
      if (!rec) {
        setReasonModal({ open: false, recordId: null, oldDate: '', newDate: '' });
        setReasonText('');
        return;
      }
      const windowDays = Number(rec.windowDays) || 0;
      let newStatus;
      try {
        newStatus = computeVisitStatus(newDate, windowDays, null);
      } catch (e) {
        console.warn('计算访视状态出错:', e);
        newStatus = rec.status || '待访视';
      }
      const reason = reasonText.trim();
      const next = records.map(item => {
        if (item.id !== recordId) return item;
        const oldDeviation = item.deviation || '';
        const newDeviation = oldDeviation
          ? `${oldDeviation}；预约日由${oldDate}调整至${newDate}（${reason}）`
          : `预约日由${oldDate}调整至${newDate}（${reason}）`;
        const oldTimeline = item.timeline || [];
        const newTimelineEntry = {
          status: newStatus,
          at: today,
          by: `预约调整：${oldDate}→${newDate}，原因：${reason}`
        };
        return {
          ...item,
          scheduledDate: newDate,
          status: newStatus,
          deviation: newDeviation,
          timeline: [...oldTimeline, newTimelineEntry],
        };
      });
      persist(next);
      if (selected?.id === recordId) {
        const updated = next.find(r => r.id === recordId);
        if (updated) setSelected(updated);
      }
      setReasonModal({ open: false, recordId: null, oldDate: '', newDate: '' });
      setReasonText('');
    } catch (err) {
      console.error('确认调整日期出错:', err);
      alert('操作失败，请重试');
      setReasonModal({ open: false, recordId: null, oldDate: '', newDate: '' });
      setReasonText('');
    }
  }

  function cancelReasonModal() {
    setReasonModal({ open: false, recordId: null, oldDate: '', newDate: '' });
    setReasonText('');
  }

  function openExecutionWorkbench(record) {
    const items = record.executionItems && record.executionItems.length > 0
      ? record.executionItems
      : initExecutionItems(record.items);
    setExecutionSelected(record);
    setExecutionForm({
      ...record,
      executionItems: items.map(item => ({ ...item })),
      actualDate: record.actualDate || '',
    });
    setExecutionTab('items');
  }

  function closeExecutionWorkbench() {
    setExecutionSelected(null);
    setExecutionForm(null);
  }

  function updateExecutionItem(itemId, field, value) {
    if (!executionForm) return;
    const nextItems = executionForm.executionItems.map(item =>
      item.id === itemId ? { ...item, [field]: value } : item
    );
    setExecutionForm({ ...executionForm, executionItems: nextItems });
  }

  function toggleExecutionItemStatus(itemId) {
    if (!executionForm) return;
    const nextItems = executionForm.executionItems.map(item => {
      if (item.id !== itemId) return item;
      const nextStatus = item.status === 'done' ? 'pending' : 'done';
      return { ...item, status: nextStatus, reason: nextStatus === 'done' ? '' : item.reason };
    });
    setExecutionForm({ ...executionForm, executionItems: nextItems });
  }

  function setItemSkipped(itemId) {
    if (!executionForm) return;
    const nextItems = executionForm.executionItems.map(item =>
      item.id === itemId ? { ...item, status: 'skipped', result: '' } : item
    );
    setExecutionForm({ ...executionForm, executionItems: nextItems });
  }

  function getUnprocessedRequiredItems() {
    if (!executionForm) return [];
    const { executionItems } = executionForm;
    if (!executionItems || executionItems.length === 0) return [];
    return executionItems.filter(item => {
      if (!item.required) return false;
      if (item.status === 'done') return false;
      if (item.status === 'skipped' && item.reason && item.reason.trim()) return false;
      return true;
    });
  }

  function getSkippedItemsWithoutReason() {
    if (!executionForm) return [];
    const { executionItems } = executionForm;
    if (!executionItems || executionItems.length === 0) return [];
    return executionItems.filter(item =>
      item.status === 'skipped' && (!item.reason || !item.reason.trim())
    );
  }

  function canCompleteVisit() {
    if (!executionForm) return false;
    const { executionItems } = executionForm;
    if (!executionItems || executionItems.length === 0) return false;
    if (getUnprocessedRequiredItems().length > 0) return false;
    if (getSkippedItemsWithoutReason().length > 0) return false;
    return true;
  }

  function isDateOutOfWindow(actualDate, record) {
    if (!actualDate || !record) return false;
    const plannedDate = record.plannedDate || record.scheduledDate;
    if (!plannedDate) return false;
    const windowDays = Number(record.windowDays) || 0;
    const actual = parseSafeDate(actualDate);
    const planned = parseSafeDate(plannedDate);
    if (!actual || !planned) return false;
    const diffDays = Math.round((actual - planned) / (1000 * 60 * 60 * 24));
    return Math.abs(diffDays) > windowDays;
  }

  function getDeviationDays(actualDate, record) {
    if (!actualDate || !record) return 0;
    const plannedDate = record.plannedDate || record.scheduledDate;
    if (!plannedDate) return 0;
    const actual = parseSafeDate(actualDate);
    const planned = parseSafeDate(plannedDate);
    if (!actual || !planned) return 0;
    return Math.round((actual - planned) / (1000 * 60 * 60 * 24));
  }

  function saveExecutionAndComplete() {
    if (!executionForm || !executionSelected) return;
    const unprocessed = getUnprocessedRequiredItems();
    const skippedNoReason = getSkippedItemsWithoutReason();
    if (unprocessed.length > 0) {
      const names = unprocessed.map(i => `"${i.name}"`).join('、');
      alert(`以下必填检查项目尚未处理完成：\n${names}\n\n必填项需标记为"已完成"，或标记为"未完成"并填写原因。`);
      return;
    }
    if (skippedNoReason.length > 0) {
      const names = skippedNoReason.map(i => `"${i.name}"`).join('、');
      alert(`以下标记为"未完成"的检查项目未填写原因：\n${names}\n\n请为所有未完成项目补充原因说明。`);
      return;
    }
    const actualDate = executionForm.actualDate || today;
    const outOfWindow = isDateOutOfWindow(actualDate, executionSelected);
    const deviationDays = getDeviationDays(actualDate, executionSelected);

    const next = records.map(item => {
      if (item.id !== executionSelected.id) return item;
      let deviationText = item.deviation || '';
      if (outOfWindow) {
        const direction = deviationDays > 0 ? '超窗' : '提前';
        const newDeviation = `实际访视日期${actualDate}，较计划${item.plannedDate || item.scheduledDate}${direction}${Math.abs(deviationDays)}天`;
        deviationText = deviationText
          ? `${deviationText}；${newDeviation}`
          : newDeviation;
      }
      const oldTimeline = item.timeline || [];
      const newTimelineEntries = [
        { status: '执行中', at: today, by: '研究员' },
        { status: '已完成', at: today, by: '访视执行完成' },
      ];
      if (outOfWindow) {
        newTimelineEntries.push({ status: '偏差记录', at: today, by: `超窗${Math.abs(deviationDays)}天，自动生成偏差草稿` });
      }
      return {
        ...item,
        status: '已完成',
        actualDate,
        executionItems: executionForm.executionItems,
        deviation: deviationText,
        timeline: [...oldTimeline, ...newTimelineEntries],
      };
    });
    persist(next);
    closeExecutionWorkbench();
    if (outOfWindow) {
      alert(`访视已完成！注意：实际日期超出访视窗口 ${Math.abs(deviationDays)} 天，已自动创建偏差记录。`);
    } else {
      alert('访视已完成！');
    }
  }

  function saveExecutionDraft() {
    if (!executionForm || !executionSelected) return;
    const actualDate = executionForm.actualDate || '';
    const skippedNoReason = getSkippedItemsWithoutReason();
    const next = records.map(item => {
      if (item.id !== executionSelected.id) return item;
      const oldTimeline = item.timeline || [];
      const hasInProgress = oldTimeline.some(t => t.status === '执行中');
      const newTimeline = hasInProgress ? oldTimeline : [...oldTimeline, { status: '执行中', at: today, by: '研究员' }];
      let newStatus = item.status;
      if (item.status === '待访视' || item.status === '窗口内' || item.status === '已超窗') {
        newStatus = item.status;
      }
      return {
        ...item,
        executionItems: executionForm.executionItems,
        actualDate,
        status: newStatus,
        timeline: newTimeline,
      };
    });
    persist(next);
    const updated = next.find(r => r.id === executionSelected.id);
    if (updated) {
      setExecutionSelected(updated);
      setExecutionForm({ ...executionForm, ...updated });
    }
    if (skippedNoReason.length > 0) {
      const names = skippedNoReason.map(i => `"${i.name}"`).join('、');
      alert(`草稿已保存。\n\n注意：以下未完成项目尚未填写原因，完成访视前必须补充：\n${names}`);
    } else {
      alert('执行记录已保存为草稿。');
    }
  }

  function toggleItemRequired(itemId) {
    if (!executionForm) return;
    const nextItems = executionForm.executionItems.map(item =>
      item.id === itemId ? { ...item, required: !item.required } : item
    );
    setExecutionForm({ ...executionForm, executionItems: nextItems });
  }

  const executionStats = useMemo(() => {
    if (!executionForm || !executionForm.executionItems) {
      return {
        total: 0,
        done: 0,
        pending: 0,
        skipped: 0,
        requiredTotal: 0,
        requiredDone: 0,
        requiredHandled: 0,
        skippedNoReason: 0,
      };
    }
    const items = executionForm.executionItems;
    const requiredItems = items.filter(i => i.required);
    return {
      total: items.length,
      done: items.filter(i => i.status === 'done').length,
      pending: items.filter(i => i.status === 'pending').length,
      skipped: items.filter(i => i.status === 'skipped').length,
      requiredTotal: requiredItems.length,
      requiredDone: requiredItems.filter(i => i.status === 'done').length,
      requiredHandled: requiredItems.filter(i =>
        i.status === 'done' || (i.status === 'skipped' && i.reason && i.reason.trim())
      ).length,
      skippedNoReason: items.filter(i =>
        i.status === 'skipped' && (!i.reason || !i.reason.trim())
      ).length,
    };
  }, [executionForm]);

  const batchStats = useMemo(() => {
    const total = batchParsedData.length;
    const valid = batchParsedData.filter((_, idx) => !batchErrors[idx]).length;
    const invalid = total - valid;
    let totalVisits = 0;
    batchParsedData.forEach((row, idx) => {
      if (!batchErrors[idx]) {
        const tpl = templates.find(t => t.name === row.templateName);
        if (tpl) {
          totalVisits += (tpl.visits || []).filter(v => v.visitName && v.plannedDays !== '' && v.plannedDays !== null && v.plannedDays !== undefined).length;
        }
      }
    });
    return { total, valid, invalid, totalVisits };
  }, [batchParsedData, batchErrors, templates]);

  const previewTimeline = useMemo(() => {
    const validVisits = (templateForm.visits || [])
      .filter(v => v.visitName && v.plannedDays !== '' && v.plannedDays !== null && v.plannedDays !== undefined)
      .sort((a, b) => Number(a.plannedDays) - Number(b.plannedDays));
    if (validVisits.length === 0) return { items: [], max: 0 };
    const max = Math.max(...validVisits.map(v => Number(v.plannedDays) + Number(v.windowDays || 0)), 7);
    return { items: validVisits, max };
  }, [templateForm.visits]);

  const filteredRecords = useMemo(() => {
    return records
      .filter((item) => !filters.query || `${item.subjectNo}${item.group}${item.visitName}`.includes(filters.query))
      .filter((item) => filters.status === '全部' || item.status === filters.status)
      .sort((a, b) => {
        const aDate = a.enrollDate || a.createdAt || '';
        const bDate = b.enrollDate || b.createdAt || '';
        if (aDate !== bDate) return String(aDate).localeCompare(String(bDate));
        return (a.plannedDays ?? 0) - (b.plannedDays ?? 0);
      });
  }, [records, filters]);

  const metrics = [
    { label: "受试者", value: new Set(records.map((item) => item.subjectNo)).size },
    { label: "窗口内", value: records.filter((item) => item.status === '窗口内').length },
    { label: "已超窗", value: records.filter((item) => item.status === '已超窗').length },
  ];

  const groupedByDate = useMemo(() => {
    return filteredRecords.reduce((acc, item) => {
      const key = item.scheduledDate || item.plannedDate || item.enrollDate || '未排期';
      (acc[key] ||= []).push(item);
      return acc;
    }, {});
  }, [filteredRecords]);

  const groupedBySubject = useMemo(() => {
    return records.reduce((acc, item) => {
      const key = item.subjectNo || '未命名';
      (acc[key] ||= []).push(item);
      return acc;
    }, {});
  }, [records]);

  const reminderVisits = useMemo(() => {
    const in7Days = addDays(today, 7);
    return records
      .filter(r => {
        if (!r || r.status === '已完成') return false;
        const effectiveDate = r.scheduledDate || r.plannedDate;
        return effectiveDate && parseSafeDate(effectiveDate);
      })
      .map(r => {
        try {
          const windowDays = Number(r.windowDays) || 0;
          const effectiveDate = r.scheduledDate || r.plannedDate;
          const windowStart = safeAddDays(effectiveDate, -windowDays) || effectiveDate;
          const windowEnd = safeAddDays(effectiveDate, windowDays) || effectiveDate;
          let category = '';
          if (today > windowEnd) {
            category = '已超窗';
          } else if (today === windowEnd) {
            category = '当天到期';
          } else if (windowStart <= today && today < windowEnd) {
            category = '窗口内';
          } else if (windowStart > today && windowStart <= in7Days) {
            category = '即将进入窗口';
          }
          return { ...r, windowStart, windowEnd, category };
        } catch (e) {
          console.warn('计算提醒访视出错:', r, e);
          return null;
        }
      })
      .filter(Boolean)
      .filter(r => r.category)
      .sort((a, b) => {
        const order = { '已超窗': 0, '当天到期': 1, '窗口内': 2, '即将进入窗口': 3 };
        return (order[a.category] ?? 9) - (order[b.category] ?? 9);
      });
  }, [records]);

  const filteredReminderVisits = useMemo(() => {
    return reminderVisits.filter(v => {
      if (!v) return false;
      if (reminderGroupFilter !== '全部' && v.group !== reminderGroupFilter) return false;
      if (reminderCategoryFilter !== '全部' && v.category !== reminderCategoryFilter) return false;
      const effectiveDate = v.scheduledDate || v.plannedDate || '';
      if (reminderDateStart && effectiveDate < reminderDateStart) return false;
      if (reminderDateEnd && effectiveDate > reminderDateEnd) return false;
      return true;
    });
  }, [reminderVisits, reminderGroupFilter, reminderCategoryFilter, reminderDateStart, reminderDateEnd]);

  const calRecordsWithWindow = useMemo(() => {
    return records
      .filter(r => {
        if (!r) return false;
        const effectiveDate = r.scheduledDate || r.plannedDate;
        if (!effectiveDate) return false;
        if (parseSafeDate(effectiveDate) === null) return false;
        if (calSubjectFilter !== '全部' && r.subjectNo !== calSubjectFilter) return false;
        if (calGroupFilter !== '全部' && r.group !== calGroupFilter) return false;
        return true;
      })
      .map(r => {
        try {
          const w = computeWindowDates(r);
          return { ...r, windowStart: w.windowStart, windowEnd: w.windowEnd, targetDate: w.targetDate, scheduledDate: w.scheduledDate || r.scheduledDate, allWindowDates: w.allDates };
        } catch (e) {
          console.warn('计算访视窗口出错:', r, e);
          const effectiveDate = r.scheduledDate || r.plannedDate;
          return { ...r, windowStart: null, windowEnd: null, targetDate: effectiveDate, allWindowDates: [effectiveDate] };
        }
      })
      .filter(r => r.allWindowDates && r.allWindowDates.length > 0);
  }, [records, calSubjectFilter, calGroupFilter]);

  const calMonthGrid = useMemo(() => {
    const d = parseSafeDate(calBaseDate) || new Date();
    return getCalendarMonthGrid(d.getFullYear(), d.getMonth());
  }, [calBaseDate]);

  const calWeekDays = useMemo(() => {
    return getWeekDays(calBaseDate);
  }, [calBaseDate]);

  const calVisitsByDate = useMemo(() => {
    const map = {};
    calRecordsWithWindow.forEach(r => {
      try {
        const dates = r.allWindowDates || [r.targetDate || r.plannedDate];
        dates.forEach(ds => {
          if (!ds) return;
          (map[ds] ||= []).push(r);
        });
      } catch (e) {
        console.warn('处理日历访视数据出错:', r, e);
      }
    });
    return map;
  }, [calRecordsWithWindow]);

  const calMonthLabel = useMemo(() => {
    const d = parseSafeDate(calBaseDate) || new Date();
    return `${d.getFullYear()}年${d.getMonth() + 1}月`;
  }, [calBaseDate]);

  const calWeekLabel = useMemo(() => {
    const days = calWeekDays;
    if (days.length === 0) return '';
    const s = days[0];
    const e = days[6];
    return `${s.getMonth() + 1}月${s.getDate()}日 — ${e.getMonth() + 1}月${e.getDate()}日`;
  }, [calWeekDays]);

  useEffect(() => {
    if (reminderSelected.size === 0) return;
    const visibleIds = new Set(filteredReminderVisits.map(v => v.id));
    const next = new Set([...reminderSelected].filter(id => visibleIds.has(id)));
    if (next.size !== reminderSelected.size) {
      setReminderSelected(next);
    }
  }, [filteredReminderVisits]);

  const reminderStats = useMemo(() => ({
    '已超窗': reminderVisits.filter(v => v.category === '已超窗').length,
    '当天到期': reminderVisits.filter(v => v.category === '当天到期').length,
    '窗口内': reminderVisits.filter(v => v.category === '窗口内').length,
    '即将进入窗口': reminderVisits.filter(v => v.category === '即将进入窗口').length,
  }), [reminderVisits]);

  return (
    <main className="shell" style={{ '--accent': appConfig.accent }}>
      <section className="hero">
        <div>
          <div className="eyebrow"><ClipboardPlus size={18} />{appConfig.domain}</div>
          <h1>{appConfig.title}</h1>
          <p>{appConfig.subtitle}</p>
        </div>
        <div className="port-card">
          <span>Local Port</span>
          <strong>{appConfig.port}</strong>
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
          className={'tab-btn ' + (activeTab === 'batch' ? 'active' : '')}
          onClick={() => setActiveTab('batch')}
        >
          <Users size={16} />批量入组
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
          className={'tab-btn ' + (activeTab === 'reminder' ? 'active' : '')}
          onClick={() => setActiveTab('reminder')}
        >
          <Bell size={16} />访视提醒
        </button>
        <button
          type="button"
          className={'tab-btn ' + (activeTab === 'calendar' ? 'active' : '')}
          onClick={() => setActiveTab('calendar')}
        >
          <CalendarDays size={16} />访视日历
        </button>
        <button
          type="button"
          className={'tab-btn ' + (activeTab === 'execution' ? 'active' : '')}
          onClick={() => setActiveTab('execution')}
        >
          <Stethoscope size={16} />访视执行
        </button>
      </div>

      {activeTab === 'record' ? (
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
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}（{t.visits?.length || 0}个访视）</option>)}
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
                      <p>{`${item.group} · 入组${item.enrollDate}${item.plannedDate ? ` · 计划${item.plannedDate}` : ''}${item.scheduledDate && item.scheduledDate !== item.plannedDate ? ` → 预约${item.scheduledDate}` : ''}${item.plannedDays !== undefined && item.plannedDays !== null ? `（第${item.plannedDays ?? '?'}天）` : ''} · ±${item.windowDays}天`}</p>
                    </div>
                    <span className={'status ' + statusClass(item.status)}>{item.status}</span>
                  </div>
                  <p className="record-detail">{item.items}</p>
                  {item.conflict && <div className="warning"><AlertTriangle size={15} />发现冲突</div>}
                  <div className="actions" onClick={(event) => event.stopPropagation()}>
                    {appConfig.statuses.map((status) => (
                      <button key={status} type="button" onClick={() => updateStatus(item.id, status)}>{status}</button>
                    ))}
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
      ) : activeTab === 'batch' ? (
        <section className="batch-workspace">
          <section className="panel form-panel">
            <div className="panel-title">
              <FileSpreadsheet size={18} />
              <h2>受试者批量入组</h2>
            </div>

            <div
              className={`batch-upload-zone ${batchDragOver ? 'drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setBatchDragOver(true); }}
              onDragLeave={() => setBatchDragOver(false)}
              onDrop={handleBatchDrop}
            >
              <input
                type="file"
                accept=".csv"
                id="batch-file-input"
                style={{ display: 'none' }}
                onChange={handleBatchFileInput}
              />
              <label htmlFor="batch-file-input" className="batch-upload-label">
                <Upload size={40} />
                <h3>点击或拖拽上传CSV文件</h3>
                <p>文件需包含：受试者编号、试验分组、入组日期、方案模板</p>
              </label>
            </div>

            {batchFileName && (
              <div className="batch-file-info">
                <FileSpreadsheet size={16} />
                <span>{batchFileName}</span>
                <button type="button" className="link-btn" onClick={clearBatchData}>
                  <X size={14} />清除
                </button>
              </div>
            )}

            {batchParsedData.length > 0 && (
              <>
                <div className="batch-stats">
                  <div className="batch-stat">
                    <span>总计</span>
                    <strong>{batchStats.total}</strong>
                  </div>
                  <div className="batch-stat valid">
                    <Check size={14} />
                    <span>有效</span>
                    <strong>{batchStats.valid}</strong>
                  </div>
                  <div className="batch-stat invalid">
                    <AlertTriangle size={14} />
                    <span>无效</span>
                    <strong>{batchStats.invalid}</strong>
                  </div>
                  <div className="batch-stat">
                    <CalendarDays size={14} />
                    <span>将生成访视</span>
                    <strong>{batchStats.totalVisits}</strong>
                  </div>
                </div>

                <div className="batch-table-container">
                  <table className="batch-table">
                    <thead>
                      <tr>
                        <th style={{ width: 50 }}>行号</th>
                        <th>受试者编号</th>
                        <th>试验分组</th>
                        <th>入组日期</th>
                        <th>方案模板</th>
                        <th style={{ width: 60 }}>状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchParsedData.map((row, idx) => (
                        <tr key={idx} className={batchErrors[idx] ? 'row-error' : 'row-valid'}>
                          <td>{row.rowIndex}</td>
                          <td>{row.subjectNo || <em className="missing">（空）</em>}</td>
                          <td>{row.group || <em className="missing">（空）</em>}</td>
                          <td>{row.enrollDate || <em className="missing">（空）</em>}</td>
                          <td>{row.templateName || <em className="missing">（空）</em>}</td>
                          <td>
                            {batchErrors[idx] ? (
                              <span className="row-status error" title={batchErrors[idx].join('; ')}>
                                <AlertTriangle size={14} />
                              </span>
                            ) : (
                              <span className="row-status ok" title="校验通过">
                                <CheckCircle2 size={14} />
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {Object.keys(batchErrors).length > 0 && (
                  <div className="error-box">
                    <AlertTriangle size={16} />
                    <div>
                      <strong>发现 {Object.keys(batchErrors).length} 条错误，将跳过这些记录：</strong>
                      <ul>
                        {Object.entries(batchErrors).map(([idx, errs]) => (
                          <li key={idx}>
                            第 {batchParsedData[idx].rowIndex} 行：{errs.join('；')}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                <button
                  className="primary"
                  type="button"
                  onClick={importBatchData}
                  disabled={batchStats.valid === 0 || batchImporting}
                >
                  {batchImporting ? (
                    <>导入中...</>
                  ) : (
                    <>
                      <Plus size={18} />
                      导入 {batchStats.valid} 条有效数据（生成 {batchStats.totalVisits} 条访视）
                    </>
                  )}
                </button>

                <div className="hint">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p>CSV文件格式示例：</p>
                    <button type="button" className="link-btn" onClick={downloadSampleCSV}>
                      <Download size={14} />下载示例CSV
                    </button>
                  </div>
                  <pre className="csv-sample">{`受试者编号,试验分组,入组日期,方案模板
SUB-100,A组,2026-06-01,Ⅱ期临床标准访视方案
SUB-101,B组,2026-06-02,Ⅱ期临床标准访视方案
SUB-102,对照组,2026-06-03,Ⅱ期临床标准访视方案`}</pre>
                </div>
              </>
            )}

            {batchParsedData.length === 0 && !batchFileName && (
              <div className="batch-hints">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h4 style={{ margin: 0 }}>使用说明</h4>
                  <button type="button" className="link-btn" onClick={downloadSampleCSV}>
                    <Download size={14} />下载示例CSV
                  </button>
                </div>
                <ol>
                  <li>准备CSV文件，包含以下列：<strong>受试者编号、试验分组、入组日期、方案模板</strong></li>
                  <li><strong>受试者编号</strong>：不能与现有记录或CSV内重复</li>
                  <li><strong>试验分组</strong>：可选值为 {appConfig.fields.find(f => f.key === 'group')?.options.join('、')}</li>
                  <li><strong>入组日期</strong>：格式为 YYYY-MM-DD，如 2026-06-01</li>
                  <li><strong>方案模板</strong>：需先在"访视方案模板"页面创建，填写模板名称</li>
                  <li>上传后系统将自动校验，仅导入校验通过的数据</li>
                  <li>导入后将根据所选模板自动生成所有访视计划</li>
                </ol>
                <p className="hint">当前可用模板：{templates.length > 0 ? templates.map(t => t.name).join('、') : '暂无，请先创建模板'}</p>
              </div>
            )}
          </section>

          <section className="panel list-panel">
            <div className="panel-title">
              <List size={18} />
              <h2>现有受试者列表（{new Set(records.map(r => r.subjectNo)).size}）</h2>
            </div>
            <div className="records">
              {Object.entries(groupedBySubject).map(([subject, items]) => (
                <article className="record tpl-record" key={subject}>
                  <div className="record-head">
                    <div>
                      <h3>{subject}</h3>
                      <p>{items[0]?.group} · 入组{items[0]?.enrollDate} · {items.length}条访视</p>
                    </div>
                  </div>
                  <div className="subject-visits">
                    {items
                      .slice()
                      .sort((a, b) => (a.plannedDays ?? 9999) - (b.plannedDays ?? 9999))
                      .map((item) => (
                        <span key={item.id} className={'visit-chip ' + statusClass(item.status)}>
                          <strong>{item.visitName}</strong>
                          <span>D{item.plannedDays ?? '?'} · {item.scheduledDate || item.plannedDate || '-'}</span>
                          <em>{item.status}</em>
                        </span>
                      ))}
                  </div>
                </article>
              ))}
              {Object.keys(groupedBySubject).length === 0 && (
                <p className="empty" style={{ padding: 20, textAlign: 'center' }}>暂无受试者数据。</p>
              )}
            </div>
          </section>
        </section>
      ) : activeTab === 'reminder' ? (
        <section className="reminder-workspace">
          <section className="panel reminder-panel">
            <div className="panel-title">
              <Bell size={18} />
              <h2>访视提醒工作台</h2>
            </div>

            <div className="reminder-stats">
              <div className="reminder-stat overdue">
                <AlertTriangle size={18} />
                <div>
                  <span>已超窗</span>
                  <strong>{reminderStats['已超窗']}</strong>
                </div>
              </div>
              <div className="reminder-stat due">
                <Clock size={18} />
                <div>
                  <span>当天到期</span>
                  <strong>{reminderStats['当天到期']}</strong>
                </div>
              </div>
              <div className="reminder-stat in-window">
                <CheckCircle2 size={18} />
                <div>
                  <span>窗口内</span>
                  <strong>{reminderStats['窗口内']}</strong>
                </div>
              </div>
              <div className="reminder-stat upcoming">
                <CalendarDays size={18} />
                <div>
                  <span>7天内进入窗口</span>
                  <strong>{reminderStats['即将进入窗口']}</strong>
                </div>
              </div>
            </div>

            <div className="reminder-filters">
              <div className="filter-row">
                <label>
                  <span>试验分组</span>
                  <select value={reminderGroupFilter} onChange={(e) => setReminderGroupFilter(e.target.value)}>
                    <option>全部</option>
                    {appConfig.fields.find(f => f.key === 'group')?.options.map(opt => <option key={opt}>{opt}</option>)}
                  </select>
                </label>
                <label>
                  <span>提醒分类</span>
                  <select value={reminderCategoryFilter} onChange={(e) => setReminderCategoryFilter(e.target.value)}>
                    <option>全部</option>
                    <option>已超窗</option>
                    <option>当天到期</option>
                    <option>窗口内</option>
                    <option>即将进入窗口</option>
                  </select>
                </label>
              </div>
              <div className="filter-row">
                <label>
                  <span>计划日期从</span>
                  <input type="date" value={reminderDateStart} onChange={(e) => setReminderDateStart(e.target.value)} />
                </label>
                <label>
                  <span>计划日期至</span>
                  <input type="date" value={reminderDateEnd} onChange={(e) => setReminderDateEnd(e.target.value)} />
                </label>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setReminderDateStart('');
                    setReminderDateEnd('');
                    setReminderGroupFilter('全部');
                    setReminderCategoryFilter('全部');
                  }}
                  style={{ alignSelf: 'end' }}
                >
                  <RotateCcw size={14} />重置筛选
                </button>
              </div>
            </div>

            <div className="reminder-batch-bar">
              <label className="select-all-label">
                <input
                  type="checkbox"
                  checked={filteredReminderVisits.length > 0 && reminderSelected.size === filteredReminderVisits.length}
                  onChange={toggleSelectAllReminders}
                />
                全选 ({reminderSelected.size}/{filteredReminderVisits.length})
              </label>
              <div className="batch-actions">
                <label>
                  <span>通知方式</span>
                  <select value={notifyMethod} onChange={(e) => setNotifyMethod(e.target.value)} style={{ width: 120 }}>
                    <option>短信</option>
                    <option>电话</option>
                  </select>
                </label>
                <label style={{ width: 160 }}>
                  <span>操作人</span>
                  <input
                    type="text"
                    value={notifyOperator}
                    onChange={(e) => setNotifyOperator(e.target.value)}
                    placeholder="请输入姓名"
                  />
                </label>
                <button
                  type="button"
                  className="primary"
                  style={{ marginTop: 0, width: 'auto', padding: '10px 18px' }}
                  onClick={batchNotify}
                  disabled={reminderSelected.size === 0 || notifySimulating}
                >
                  {notifySimulating ? (
                    <>{notifyMethod === '短信' ? <Send size={16} /> : <Phone size={16} />}发送中...</>
                  ) : (
                    <>{notifyMethod === '短信' ? <MessageSquare size={16} /> : <Phone size={16} />}批量标记已通知</>
                  )}
                </button>
              </div>
            </div>

            {notifySuccess && (
              <div className="success-box">
                <CheckCircle2 size={16} />
                <span>通知记录已成功保存，通知方式：{notifyMethod}</span>
              </div>
            )}
          </section>

          <section className="panel reminder-list-panel">
            <div className="panel-title">
              <List size={18} />
              <h2>待提醒访视列表（{filteredReminderVisits.length}）</h2>
            </div>

            <div className="reminder-list">
              {filteredReminderVisits.length === 0 ? (
                <p className="empty" style={{ padding: 20, textAlign: 'center' }}>
                  暂无符合筛选条件的访视记录。
                </p>
              ) : (
                ['已超窗', '当天到期', '窗口内', '即将进入窗口'].map(cat => {
                  const catItems = filteredReminderVisits.filter(v => v.category === cat);
                  if (catItems.length === 0) return null;
                  return (
                    <div key={cat} className="reminder-category-group">
                      <div className="category-header">
                        <span className={'category-badge ' + categoryClass(cat)}>{cat}</span>
                        <span className="category-count">{catItems.length} 条</span>
                      </div>
                      <div className="reminder-cards">
                        {catItems.map(item => {
                          const notified = isNotified(item.id);
                          const itemNotifies = getNotifyRecordsForVisit(item.id);
                          return (
                            <div
                              key={item.id}
                              className={'reminder-card ' + (reminderSelected.has(item.id) ? 'selected' : '') + (notified ? ' notified' : '')}
                            >
                              <div className="reminder-card-head">
                                <label className="card-checkbox" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={reminderSelected.has(item.id)}
                                    onChange={() => toggleReminderSelect(item.id)}
                                  />
                                </label>
                                <div className="reminder-card-title">
                                  <h3>{item.subjectNo} · {item.visitName}</h3>
                                  <p>{item.group} · 计划 {item.plannedDate}{item.scheduledDate && item.scheduledDate !== item.plannedDate ? ` → 预约 ${item.scheduledDate}` : ''} · 窗口 {item.windowStart} ~ {item.windowEnd}</p>
                                </div>
                                <span className={'status ' + statusClass(item.status)}>{item.status}</span>
                              </div>
                              <div className="reminder-card-body">
                                <p className="reminder-items">检查项目：{item.items || '—'}</p>
                                {notified && (
                                  <div className="notify-history">
                                    <strong>通知记录：</strong>
                                    <ul>
                                      {itemNotifies.map(n => (
                                        <li key={n.id}>
                                          <span className="notify-method">{n.method}</span>
                                          <span className="notify-operator">{n.operator}</span>
                                          <span className="notify-time">{new Date(n.notifiedAt).toLocaleString('zh-CN')}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                              <div className="reminder-card-actions">
                                <button
                                  type="button"
                                  className="notify-btn sms"
                                  onClick={() => singleNotify(item.id, '短信')}
                                >
                                  <MessageSquare size={14} />发送短信
                                </button>
                                <button
                                  type="button"
                                  className="notify-btn phone"
                                  onClick={() => singleNotify(item.id, '电话')}
                                >
                                  <Phone size={14} />拨打电话
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="panel notify-records-panel">
            <div className="panel-title">
              <ClipboardList size={18} />
              <h2>全部通知记录（{notifyRecords.length}）</h2>
            </div>
            {notifyRecords.length === 0 ? (
              <p className="empty" style={{ padding: 20, textAlign: 'center' }}>
                暂无通知记录。
              </p>
            ) : (
              <div className="notify-records-table-wrap">
                <table className="notify-records-table">
                  <thead>
                    <tr>
                      <th>时间</th>
                      <th>受试者</th>
                      <th>访视</th>
                      <th>分组</th>
                      <th>方式</th>
                      <th>操作人</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...notifyRecords]
                      .sort((a, b) => new Date(b.notifiedAt) - new Date(a.notifiedAt))
                      .map(n => {
                        const rec = records.find(r => r.id === n.recordId);
                        return (
                          <tr key={n.id}>
                            <td>{new Date(n.notifiedAt).toLocaleString('zh-CN')}</td>
                            <td>{rec?.subjectNo || '—'}</td>
                            <td>{rec?.visitName || '—'}</td>
                            <td>{rec?.group || '—'}</td>
                            <td>
                              <span className={'notify-method-tag ' + (n.method === '短信' ? 'sms' : 'phone')}>
                                {n.method === '短信' ? <MessageSquare size={12} /> : <Phone size={12} />}
                                {n.method}
                              </span>
                            </td>
                            <td>{n.operator}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>
      ) : activeTab === 'calendar' ? (
        <section className="cal-workspace">
          <section className="panel cal-control-panel">
            <div className="panel-title">
              <CalendarDays size={18} />
              <h2>访视日历排程</h2>
            </div>

            <div className="cal-view-toggle">
              <button type="button" className={'cal-view-btn ' + (calView === 'month' ? 'active' : '')} onClick={() => setCalView('month')}>月视图</button>
              <button type="button" className={'cal-view-btn ' + (calView === 'week' ? 'active' : '')} onClick={() => setCalView('week')}>周视图</button>
            </div>

            <div className="cal-nav">
              <button type="button" className="cal-nav-btn" onClick={() => calNavigate(-1)}><ChevronLeft size={18} /></button>
              <strong className="cal-nav-label">{calView === 'month' ? calMonthLabel : calWeekLabel}</strong>
              <button type="button" className="cal-nav-btn" onClick={() => calNavigate(1)}><ChevronRight size={18} /></button>
              <button type="button" className="link-btn" onClick={calGoToday} style={{ marginLeft: 8 }}>今天</button>
            </div>

            <div className="cal-filters">
              <label>
                <span>受试者</span>
                <select value={calSubjectFilter} onChange={e => setCalSubjectFilter(e.target.value)}>
                  <option>全部</option>
                  {[...new Set(records.map(r => r.subjectNo))].map(s => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label>
                <span>试验分组</span>
                <select value={calGroupFilter} onChange={e => setCalGroupFilter(e.target.value)}>
                  <option>全部</option>
                  {appConfig.fields.find(f => f.key === 'group')?.options.map(opt => <option key={opt}>{opt}</option>)}
                </select>
              </label>
            </div>

            <div className="cal-legend">
              <div className="cal-legend-item"><span className="cal-legend-dot dot-window-start" />窗口开始</div>
              <div className="cal-legend-item"><span className="cal-legend-dot dot-target" />目标日期</div>
              <div className="cal-legend-item"><span className="cal-legend-dot dot-window-end" />窗口结束</div>
              <div className="cal-legend-item"><span className="cal-legend-dot dot-in-window" />窗口内</div>
              <div className="cal-legend-item"><span className="cal-legend-dot dot-completed" />已完成</div>
              <div className="cal-legend-item"><span className="cal-legend-dot dot-overdue" />已超窗</div>
            </div>

            <div className="cal-drag-hint">
              <GripVertical size={14} /> 拖动访视标记可调整预约日期（已完成的访视不可拖动）
            </div>
          </section>

          <section className="panel cal-grid-panel">
            {calView === 'month' ? (
              <div className="cal-month">
                <div className="cal-weekday-header">
                  {['一', '二', '三', '四', '五', '六', '日'].map(d => <div key={d} className="cal-weekday-cell">{d}</div>)}
                </div>
                <div className="cal-month-grid">
                  {calMonthGrid.map((date, idx) => {
                    const ds = toISODate(date);
                    const isCurrentMonth = parseSafeDate(calBaseDate) && date.getMonth() === parseSafeDate(calBaseDate).getMonth();
                    const isToday = ds === today;
                    const isDragOver = dragOverDate === ds;
                    const visits = calVisitsByDate[ds] || [];
                    const uniqueVisits = [];
                    const seenIds = new Set();
                    visits.forEach(v => { if (!seenIds.has(v.id)) { seenIds.add(v.id); uniqueVisits.push(v); } });
                    return (
                      <div
                        key={idx}
                        className={'cal-day-cell' + (isCurrentMonth ? ' current-month' : '') + (isToday ? ' is-today' : '') + (isDragOver ? ' drag-over' : '')}
                        onDragOver={e => handleCalDragOver(e, ds)}
                        onDragLeave={handleCalDragLeave}
                        onDrop={e => handleCalDrop(e, ds)}
                      >
                        <div className="cal-day-number">{date.getDate()}</div>
                        <div className="cal-day-visits">
                          {uniqueVisits.slice(0, 4).map(v => {
                            let dotType = 'dot-in-window';
                            let labelSuffix = '';
                            if (v.status === '已完成') {
                              dotType = 'dot-completed';
                            } else if (v.status === '已超窗') {
                              dotType = 'dot-overdue';
                            } else if (v.windowStart === ds && v.windowEnd === ds) {
                              dotType = 'dot-target';
                              labelSuffix = '(目标)';
                            } else if (v.targetDate === ds) {
                              dotType = 'dot-target';
                              labelSuffix = '(目标)';
                            } else if (v.scheduledDate === ds && v.scheduledDate !== v.targetDate) {
                              dotType = 'dot-in-window';
                              labelSuffix = '(预约)';
                            } else if (v.windowStart === ds) {
                              dotType = 'dot-window-start';
                              labelSuffix = '(窗口开)';
                            } else if (v.windowEnd === ds) {
                              dotType = 'dot-window-end';
                              labelSuffix = '(窗口关)';
                            }
                            return (
                              <div
                                key={v.id + '-' + dotType}
                                className={'cal-visit-tag ' + dotType + (v.status === '已完成' ? ' completed' : '')}
                                draggable={v.status !== '已完成'}
                                onDragStart={e => handleCalDragStart(e, v)}
                                title={`${v.subjectNo} ${v.visitName} · ${v.status} · 窗口 ${v.windowStart}~${v.windowEnd}`}
                              >
                                <span className="cal-visit-dot" />
                                <span className="cal-visit-text">{v.subjectNo}-{v.visitName}{labelSuffix}</span>
                              </div>
                            );
                          })}
                          {uniqueVisits.length > 4 && <div className="cal-more-visits">+{uniqueVisits.length - 4}项</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="cal-week">
                <div className="cal-weekday-header">
                  {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map(d => <div key={d} className="cal-weekday-cell">{d}</div>)}
                </div>
                <div className="cal-week-grid">
                  {calWeekDays.map((date, idx) => {
                    const ds = toISODate(date);
                    const isToday = ds === today;
                    const isDragOver = dragOverDate === ds;
                    const visits = calVisitsByDate[ds] || [];
                    const uniqueVisits = [];
                    const seenIds = new Set();
                    visits.forEach(v => { if (!seenIds.has(v.id)) { seenIds.add(v.id); uniqueVisits.push(v); } });
                    return (
                      <div
                        key={idx}
                        className={'cal-week-col' + (isToday ? ' is-today' : '') + (isDragOver ? ' drag-over' : '')}
                        onDragOver={e => handleCalDragOver(e, ds)}
                        onDragLeave={handleCalDragLeave}
                        onDrop={e => handleCalDrop(e, ds)}
                      >
                        <div className="cal-week-col-header">
                          <span className="cal-week-col-date">{date.getMonth() + 1}/{date.getDate()}</span>
                        </div>
                        <div className="cal-week-col-visits">
                          {uniqueVisits.map(v => {
                            let dotType = 'dot-in-window';
                            let labelSuffix = '';
                            if (v.status === '已完成') {
                              dotType = 'dot-completed';
                            } else if (v.status === '已超窗') {
                              dotType = 'dot-overdue';
                            } else if (v.windowStart === ds && v.windowEnd === ds) {
                              dotType = 'dot-target';
                              labelSuffix = ' · 目标日期';
                            } else if (v.targetDate === ds) {
                              dotType = 'dot-target';
                              labelSuffix = ' · 目标日期';
                            } else if (v.scheduledDate === ds && v.scheduledDate !== v.targetDate) {
                              dotType = 'dot-in-window';
                              labelSuffix = ' · 预约日期';
                            } else if (v.windowStart === ds) {
                              dotType = 'dot-window-start';
                              labelSuffix = ' · 窗口开始';
                            } else if (v.windowEnd === ds) {
                              dotType = 'dot-window-end';
                              labelSuffix = ' · 窗口结束';
                            }
                            return (
                              <div
                                key={v.id + '-' + dotType}
                                className={'cal-week-visit-card ' + dotType + (v.status === '已完成' ? ' completed' : '')}
                                draggable={v.status !== '已完成'}
                                onDragStart={e => handleCalDragStart(e, v)}
                                title={`${v.subjectNo} ${v.visitName} · ${v.status} · 窗口 ${v.windowStart}~${v.windowEnd}`}
                              >
                                <div className="cal-week-visit-header">
                                  <span className="cal-visit-dot" />
                                  <strong>{v.subjectNo} · {v.visitName}{labelSuffix}</strong>
                                </div>
                                <div className="cal-week-visit-info">
                                  <span>{v.group}</span>
                                  <span>±{v.windowDays}天</span>
                                  <span className={'status ' + statusClass(v.status)} style={{ fontSize: 11, padding: '2px 6px' }}>{v.status}</span>
                                </div>
                                <div className="cal-week-visit-window">
                                  窗口：{v.windowStart || '-'} ~ {v.windowEnd || '-'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {reasonModal.open && (
            <div className="modal-overlay" onClick={cancelReasonModal}>
              <div className="modal-box" onClick={e => e.stopPropagation()}>
                <div className="modal-title">
                  <AlertCircle size={20} />
                  <h3>预约日期调整确认</h3>
                </div>
                <div className="modal-body">
                  <p>计划访视日期：<strong>{reasonModal.oldDate}</strong> → <strong>{reasonModal.newDate}</strong></p>
                  <label style={{ marginTop: 12 }}>
                    <span>调整原因（必填）</span>
                    <textarea
                      value={reasonText}
                      onChange={e => setReasonText(e.target.value)}
                      placeholder="请输入调整预约日期的原因..."
                      rows={3}
                      autoFocus
                    />
                  </label>
                </div>
                <div className="modal-actions">
                  <button type="button" className="modal-cancel-btn" onClick={cancelReasonModal}>取消</button>
                  <button type="button" className="primary" style={{ marginTop: 0, width: 'auto', padding: '10px 24px' }} onClick={confirmReasonModal} disabled={!reasonText.trim()}>确认调整</button>
                </div>
              </div>
            </div>
          )}
        </section>
      ) : activeTab === 'execution' ? (
        <section className="execution-workspace">
          <section className="panel execution-list-panel">
            <div className="panel-title">
              <ClipboardList size={18} />
              <h2>待执行访视</h2>
              <span className="execution-count">{filteredRecords.filter(r => r.status !== '已完成').length}</span>
            </div>
            <div className="execution-list">
              {filteredRecords.filter(r => r.status !== '已完成').length === 0 ? (
                <p className="empty" style={{ padding: 20, textAlign: 'center' }}>暂无待执行的访视记录。</p>
              ) : (
                filteredRecords
                  .filter(r => r.status !== '已完成')
                  .sort((a, b) => {
                    const order = { '已超窗': 0, '窗口内': 1, '待访视': 2 };
                    return (order[a.status] ?? 9) - (order[b.status] ?? 9);
                  })
                  .map(item => {
                    const doneCount = (item.executionItems || []).filter(i => i.status === 'done').length;
                    const totalCount = (item.executionItems || []).length;
                    const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
                    return (
                      <article
                        key={item.id}
                        className={'execution-card ' + (executionSelected?.id === item.id ? 'selected' : '')}
                        onClick={() => openExecutionWorkbench(item)}
                      >
                        <div className="execution-card-head">
                          <div>
                            <h3>{item.subjectNo} · {item.visitName}</h3>
                            <p>{item.group} · 计划 {item.plannedDate || item.scheduledDate} · ±{item.windowDays}天</p>
                          </div>
                          <span className={'status ' + statusClass(item.status)}>{item.status}</span>
                        </div>
                        <p className="execution-items-preview">检查项目：{item.items || '—'}</p>
                        <div className="execution-progress">
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="progress-text">{doneCount}/{totalCount} 项已完成</span>
                        </div>
                        {item.actualDate && (
                          <p className="execution-actual-date">实际访视：{item.actualDate}</p>
                        )}
                      </article>
                    );
                  })
              )}
            </div>
          </section>

          <section className="panel execution-detail-panel">
            {executionForm ? (
              <div className="execution-detail">
                <div className="execution-detail-head">
                  <div>
                    <h2>{executionForm.subjectNo} · {executionForm.visitName}</h2>
                    <p>{executionForm.group} · 入组 {executionForm.enrollDate} · 计划访视 {executionForm.plannedDate || executionForm.scheduledDate}</p>
                  </div>
                  <button type="button" className="link-btn" onClick={closeExecutionWorkbench}>
                    <X size={16} />关闭
                  </button>
                </div>

                <div className="execution-summary">
                  <div className="exec-stat">
                    <span className="exec-stat-label">总检查项</span>
                    <strong className="exec-stat-value">{executionStats.total}</strong>
                  </div>
                  <div className="exec-stat done">
                    <span className="exec-stat-label">已完成</span>
                    <strong className="exec-stat-value">{executionStats.done}</strong>
                  </div>
                  <div className="exec-stat pending">
                    <span className="exec-stat-label">待执行</span>
                    <strong className="exec-stat-value">{executionStats.pending}</strong>
                  </div>
                  <div className={'exec-stat skipped' + (executionStats.skippedNoReason > 0 ? ' alert' : '')}>
                    <span className="exec-stat-label">未完成</span>
                    <strong className="exec-stat-value">
                      {executionStats.skipped}
                      {executionStats.skippedNoReason > 0 && <sup style={{ color: '#dc2626' }}> ({executionStats.skippedNoReason}缺原因)</sup>}
                    </strong>
                  </div>
                  <div className="exec-stat required">
                    <span className="exec-stat-label">必填项已处理</span>
                    <strong className="exec-stat-value">{executionStats.requiredHandled}/{executionStats.requiredTotal}</strong>
                  </div>
                </div>

                {executionStats.skippedNoReason > 0 && (
                  <div className="exec-alert warning">
                    <AlertTriangle size={16} />
                    <span>有 <strong>{executionStats.skippedNoReason}</strong> 项未完成检查项目尚未填写原因，完成访视前必须补充。</span>
                  </div>
                )}

                <div className="execution-sub-tabs">
                  <button
                    type="button"
                    className={'exec-sub-tab ' + (executionTab === 'items' ? 'active' : '')}
                    onClick={() => setExecutionTab('items')}
                  >
                    <CheckCircle2 size={14} />检查项目
                  </button>
                  <button
                    type="button"
                    className={'exec-sub-tab ' + (executionTab === 'info' ? 'active' : '')}
                    onClick={() => setExecutionTab('info')}
                  >
                    <FileText size={14} />访视信息
                  </button>
                  <button
                    type="button"
                    className={'exec-sub-tab ' + (executionTab === 'timeline' ? 'active' : '')}
                    onClick={() => setExecutionTab('timeline')}
                  >
                    <Clock size={14} />状态时间线
                  </button>
                </div>

                {executionTab === 'items' && (
                  <div className="execution-items-list">
                    {executionForm.executionItems.map(item => {
                      const missingReason = item.status === 'skipped' && (!item.reason || !item.reason.trim());
                      return (
                      <div key={item.id} className={'exec-item ' + item.status + (item.required ? ' required' : '') + (missingReason ? ' missing-reason' : '')}>
                        <div className="exec-item-head">
                          <label className="exec-item-checkbox" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={item.status === 'done'}
                              onChange={() => toggleExecutionItemStatus(item.id)}
                            />
                            <span className="checkbox-custom">
                              {item.status === 'done' && <Check size={14} />}
                            </span>
                          </label>
                          <div className="exec-item-title">
                            <h4>
                              {item.name}
                              {item.required && <span className="required-tag">必填</span>}
                            </h4>
                            <div className="exec-item-status-row">
                              <span className={'exec-item-status-badge ' + item.status}>
                                {item.status === 'done' ? '已完成' : item.status === 'skipped' ? '未完成' : '待执行'}
                              </span>
                              {missingReason && (
                                <span className="exec-item-warning">
                                  <AlertTriangle size={12} />缺原因
                                </span>
                              )}
                              {item.required && item.status === 'pending' && (
                                <span className="exec-item-hint">待处理</span>
                              )}
                              {item.required && item.status === 'skipped' && !missingReason && (
                                <span className="exec-item-ok">
                                  <Check size={12} />必填项已说明
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="exec-item-actions" onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              className={'status-btn ' + (item.status === 'skipped' ? 'active' : '')}
                              onClick={() => setItemSkipped(item.id)}
                              title="标记为未完成"
                            >
                              <FileX size={14} />未完成
                            </button>
                            <button
                              type="button"
                              className="link-btn"
                              onClick={() => toggleItemRequired(item.id)}
                              title={item.required ? '取消必填' : '设为必填'}
                            >
                              {item.required ? '取消必填' : '设为必填'}
                            </button>
                          </div>
                        </div>

                        {item.status === 'done' && (
                          <div className="exec-item-body">
                            <label>
                              <span>执行结果</span>
                              <textarea
                                value={item.result}
                                onChange={e => updateExecutionItem(item.id, 'result', e.target.value)}
                                placeholder="请记录检查结果..."
                                rows={2}
                              />
                            </label>
                          </div>
                        )}

                        {item.status === 'skipped' && (
                          <div className="exec-item-body skipped-body">
                            <label>
                              <span>未完成原因（必填）</span>
                              <textarea
                                value={item.reason}
                                onChange={e => updateExecutionItem(item.id, 'reason', e.target.value)}
                                placeholder="请说明未完成的原因..."
                                rows={2}
                              />
                            </label>
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}

                {executionTab === 'info' && (
                  <div className="execution-info">
                    <div className="info-grid">
                      <label className="wide">
                        <span>实际访视日期</span>
                        <input
                          type="date"
                          value={executionForm.actualDate || ''}
                          onChange={e => setExecutionForm({ ...executionForm, actualDate: e.target.value })}
                        />
                        {executionForm.actualDate && isDateOutOfWindow(executionForm.actualDate, executionSelected) && (
                          <div className="warning" style={{ marginTop: 8 }}>
                            <AlertTriangle size={14} />
                            <span>实际日期超出访视窗口，完成时将自动创建偏差记录</span>
                          </div>
                        )}
                      </label>
                      <label className="wide">
                        <span>检查项目原文</span>
                        <p className="info-value">{executionForm.items || '—'}</p>
                      </label>
                      {executionForm.deviation && (
                        <label className="wide">
                          <span>已有偏差记录</span>
                          <div className="warning" style={{ display: 'block' }}>
                            <AlertTriangle size={14} /> {executionForm.deviation}
                          </div>
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {executionTab === 'timeline' && (
                  <div className="execution-timeline">
                    <div className="timeline-list">
                      {(executionForm.timeline || []).map((step, index) => (
                        <div key={index} className="timeline-item">
                          <div className="timeline-dot" />
                          <div className="timeline-content">
                            <span className="timeline-status">{step.status}</span>
                            <span className="timeline-time">{step.at}</span>
                            <span className="timeline-by">{step.by}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="execution-actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={saveExecutionDraft}
                  >
                    <Save size={16} />保存草稿
                  </button>
                  <button
                    type="button"
                    className="primary"
                    onClick={saveExecutionAndComplete}
                    disabled={!canCompleteVisit()}
                    style={{ marginTop: 0 }}
                  >
                    <CheckCircle2 size={16} />
                    {canCompleteVisit() ? '完成访视' : '校验未通过'}
                  </button>
                </div>

                {!canCompleteVisit() && (
                  <div className="exec-alert error" style={{ marginTop: 12 }}>
                    <AlertCircle size={16} />
                    <div className="exec-alert-content">
                      <strong>无法完成访视，存在以下问题：</strong>
                      <ul className="exec-alert-list">
                        {(() => {
                          const unprocessed = getUnprocessedRequiredItems();
                          const skippedNoReason = getSkippedItemsWithoutReason();
                          const items = [];
                          if (unprocessed.length > 0) {
                            const names = unprocessed.map(i => `"${i.name}"`).join('、');
                            items.push(
                              <li key="req">
                                以下必填项未处理完毕：{names}
                                <br />
                                <em style={{ fontSize: 12, color: '#667085' }}>处理方式：标记为"已完成"，或标记为"未完成"并填写原因</em>
                              </li>
                            );
                          }
                          if (skippedNoReason.length > 0) {
                            const names = skippedNoReason.map(i => `"${i.name}"`).join('、');
                            items.push(
                              <li key="skip">
                                以下未完成项目缺少原因说明：{names}
                              </li>
                            );
                          }
                          return items;
                        })()}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="execution-empty">
                <Stethoscope size={48} />
                <h3>选择一条访视开始执行</h3>
                <p>从左侧列表选择一条待执行的访视记录，逐项勾选检查项目并记录结果。</p>
              </div>
            )}
          </section>
        </section>
      ) : (
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
              <h2>模板列表（{templates.length}）</h2>
            </div>

            <div className="records">
              {templates.map((tpl) => (
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
              {templates.length === 0 && (
                <p className="empty" style={{ padding: 20, textAlign: 'center' }}>暂无模板，在左侧配置后保存即可。</p>
              )}
            </div>
          </section>
        </section>
      )}

      <section className="insights">
        <div className="panel">
          <div className="panel-title">
            <CalendarDays size={18} />
            <h2>{'受试者访视分组'}</h2>
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
              <p>{`${selected.group} · 入组${selected.enrollDate}${selected.plannedDate ? ` · 计划访视${selected.plannedDate}` : ''}${selected.scheduledDate && selected.scheduledDate !== selected.plannedDate ? ` → 预约访视${selected.scheduledDate}` : ''} · ±${selected.windowDays}天`}</p>
              <p className="record-detail">{selected.items}</p>
              {selected.deviation && (
                <div className="warning" style={{ display: 'block' }}>
                  <AlertTriangle size={14} /> <strong>偏差记录：</strong>{selected.deviation}
                </div>
              )}
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
      </section>
    </main>
  );
}

export default App;
