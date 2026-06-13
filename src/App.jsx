import { useMemo, useState } from 'react';
import { ClipboardPlus, Plus, Search, Trash2, RotateCcw, CheckCircle2, AlertTriangle, ClipboardList, CalendarDays, FileText, Eye, Save, LayoutTemplate, X, List } from 'lucide-react';
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
          className={'tab-btn ' + (activeTab === 'template' ? 'active' : '')}
          onClick={() => setActiveTab('template')}
        >
          <LayoutTemplate size={16} />访视方案模板
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
