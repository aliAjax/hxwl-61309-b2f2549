import { useMemo, useState } from 'react';
import { ClipboardPlus, Plus, Search, Trash2, RotateCcw, CheckCircle2, AlertTriangle, ClipboardList, CalendarDays, FileText, Eye, Save, LayoutTemplate, X, List, Upload, FileSpreadsheet, Users, Check, Download, Bell, Phone, MessageSquare, Send, Clock } from 'lucide-react';
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

function categoryClass(category) {
  const map = { '已超窗': 'cat-overdue', '当天到期': 'cat-due', '窗口内': 'cat-in-window', '即将进入窗口': 'cat-upcoming' };
  return map[category] || 'cat-upcoming';
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
    if (reminderSelected.size === 0) {
      alert('请先选择需要通知的访视记录');
      return;
    }
    if (!notifyOperator.trim()) {
      alert('请填写操作人姓名');
      return;
    }
    setNotifySimulating(true);
    setTimeout(() => {
      const newNotifies = [...reminderSelected].map(recordId => ({
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
            const initialStatus = computeVisitStatus(plannedDate, v.windowDays, null);
            newRecords.push({
              id: uid(),
              subjectNo: row.subjectNo,
              group: row.group,
              enrollDate: row.enrollDate,
              plannedDate,
              visitName: v.visitName,
              plannedDays: Number(v.plannedDays),
              windowDays: String(v.windowDays ?? 0),
              items: v.items || '',
              deviation: '',
              status: initialStatus,
              createdAt: new Date().toISOString(),
              timeline: [{ status: initialStatus, at: today, by: '批量导入' }],
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
      const key = item.plannedDate || item.enrollDate || '未排期';
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
      .filter(r => r.status !== '已完成' && r.plannedDate)
      .map(r => {
        const windowDays = Number(r.windowDays) || 0;
        const windowStart = addDays(r.plannedDate, -windowDays);
        const windowEnd = addDays(r.plannedDate, windowDays);
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
      })
      .filter(r => r.category)
      .sort((a, b) => {
        const order = { '已超窗': 0, '当天到期': 1, '窗口内': 2, '即将进入窗口': 3 };
        return (order[a.category] ?? 9) - (order[b.category] ?? 9);
      });
  }, [records]);

  const filteredReminderVisits = useMemo(() => {
    return reminderVisits.filter(v => {
      if (reminderGroupFilter !== '全部' && v.group !== reminderGroupFilter) return false;
      if (reminderCategoryFilter !== '全部' && v.category !== reminderCategoryFilter) return false;
      if (reminderDateStart && v.plannedDate < reminderDateStart) return false;
      if (reminderDateEnd && v.plannedDate > reminderDateEnd) return false;
      return true;
    });
  }, [reminderVisits, reminderGroupFilter, reminderCategoryFilter, reminderDateStart, reminderDateEnd]);

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
                      <p>{`${item.group} · 入组${item.enrollDate}${item.plannedDate ? ` · 计划${item.plannedDate}（第${item.plannedDays ?? '?'}天）` : ''} · ±${item.windowDays}天`}</p>
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
                          <span>D{item.plannedDays ?? '?'} · {item.plannedDate || '-'}</span>
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
                                  <p>{item.group} · 计划 {item.plannedDate} · 窗口 {item.windowStart} ~ {item.windowEnd}</p>
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
              <p>{`${selected.group} · 入组${selected.enrollDate}${selected.plannedDate ? ` · 计划访视${selected.plannedDate}` : ''} · ±${selected.windowDays}天`}</p>
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
