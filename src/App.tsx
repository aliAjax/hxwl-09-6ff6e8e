import { useState, useMemo } from "react";
import "./styles.css";

type PlanStatus = "未开始" | "进行中" | "已完成";
type CleanArea = "ISO 5" | "ISO 6" | "ISO 7" | "黄光区";

interface InspectionPlan {
  id: number;
  date: string;
  area: string;
  role: string;
  inspector: string;
  status: PlanStatus;
}

interface ThresholdRange {
  min: number;
  max: number;
}

interface AreaThreshold {
  area: CleanArea;
  particle05um: number;
  particle5um: number;
  pressure: ThresholdRange;
  temperature: ThresholdRange;
  humidity: ThresholdRange;
}

interface SampleRecord {
  id: number;
  roomId: string;
  area: CleanArea;
  particle05um: number;
  particle5um: number;
  pressure: number;
  temperature: number;
  humidity: number;
}

const defaultThresholds: AreaThreshold[] = [
  {
    area: "ISO 5",
    particle05um: 3520,
    particle5um: 29,
    pressure: { min: 12, max: 20 },
    temperature: { min: 20, max: 24 },
    humidity: { min: 40, max: 50 },
  },
  {
    area: "ISO 6",
    particle05um: 35200,
    particle5um: 293,
    pressure: { min: 10, max: 18 },
    temperature: { min: 20, max: 25 },
    humidity: { min: 35, max: 55 },
  },
  {
    area: "ISO 7",
    particle05um: 352000,
    particle5um: 2930,
    pressure: { min: 8, max: 15 },
    temperature: { min: 18, max: 26 },
    humidity: { min: 30, max: 60 },
  },
  {
    area: "黄光区",
    particle05um: 35200,
    particle5um: 293,
    pressure: { min: 10, max: 18 },
    temperature: { min: 21, max: 25 },
    humidity: { min: 40, max: 55 },
  },
];

const sampleRecords: SampleRecord[] = [
  { id: 1, roomId: "CR-1201", area: "ISO 5", particle05um: 4200, particle5um: 35, pressure: 15, temperature: 22, humidity: 45 },
  { id: 2, roomId: "CR-2107", area: "ISO 6", particle05um: 28000, particle5um: 200, pressure: 15, temperature: 22, humidity: 48 },
  { id: 3, roomId: "Y-0302", area: "黄光区", particle05um: 30000, particle5um: 250, pressure: 12, temperature: 23, humidity: 54 },
  { id: 4, roomId: "CR-3305", area: "ISO 7", particle05um: 380000, particle5um: 3100, pressure: 7, temperature: 27, humidity: 62 },
  { id: 5, roomId: "CR-1108", area: "ISO 5", particle05um: 2800, particle5um: 20, pressure: 14, temperature: 21, humidity: 42 },
];

const initialPlans: InspectionPlan[] = [
  { id: 1, date: "2026-06-18", area: "ISO 5", role: "巡检员", inspector: "张伟", status: "进行中" },
  { id: 2, date: "2026-06-18", area: "ISO 6", role: "厂务工程师", inspector: "李娜", status: "未开始" },
  { id: 3, date: "2026-06-18", area: "黄光区", role: "班组长", inspector: "王强", status: "已完成" },
  { id: 4, date: "2026-06-18", area: "ISO 7", role: "巡检员", inspector: "赵敏", status: "未开始" },
  { id: 5, date: "2026-06-18", area: "ISO 5", role: "厂务工程师", inspector: "陈磊", status: "已完成" },
];

const statusFilters: ("全部" | PlanStatus)[] = ["全部", "未开始", "进行中", "已完成"];

const planAreas: CleanArea[] = ["ISO 5", "ISO 6", "ISO 7", "黄光区"];
const planRoles = ["巡检员", "厂务工程师", "班组长"];

const statusTagClass: Record<PlanStatus, string> = {
  "未开始": "plan-tag-pending",
  "进行中": "plan-tag-active",
  "已完成": "plan-tag-done",
};

type AnomalyType = "particle" | "pressure" | "temp" | "humidity" | "none";

function checkAnomalies(record: SampleRecord, thresholds: AreaThreshold[]): Record<AnomalyType, boolean> {
  const th = thresholds.find((t) => t.area === record.area);
  if (!th) return { particle: false, pressure: false, temp: false, humidity: false, none: true };
  const particleBad = record.particle05um > th.particle05um || record.particle5um > th.particle5um;
  const pressureBad = record.pressure < th.pressure.min || record.pressure > th.pressure.max;
  const tempBad = record.temperature < th.temperature.min || record.temperature > th.temperature.max;
  const humidityBad = record.humidity < th.humidity.min || record.humidity > th.humidity.max;
  return {
    particle: particleBad,
    pressure: pressureBad,
    temp: tempBad,
    humidity: humidityBad,
    none: !particleBad && !pressureBad && !tempBad && !humidityBad,
  };
}

function getRecordStatus(anomalies: Record<AnomalyType, boolean>): { label: string; cls: string } {
  const count = ["particle", "pressure", "temp", "humidity"].filter((k) => anomalies[k as AnomalyType]).length;
  if (count === 0) return { label: "正常", cls: "record-status-ok" };
  if (count === 1) return { label: "关注", cls: "record-status-watch" };
  return { label: "异常", cls: "record-status-danger" };
}

const project = {
  "id": "hxwl-09",
  "port": 5109,
  "title": "半导体洁净室巡检",
  "subtitle": "洁净等级阈值、粒子计数与异常处理看板",
  "stack": "React + Vite + TypeScript + CSS",
  "theme": [
    "#0f766e",
    "#2563eb",
    "#e11d48"
  ],
  "domain": "洁净室巡检",
  "users": [
    "巡检员",
    "厂务工程师",
    "班组长"
  ],
  "metrics": [
    "粒子异常",
    "压差异常",
    "温湿度偏移",
    "待处理"
  ],
  "filters": [
    "ISO 5",
    "ISO 6",
    "ISO 7",
    "黄光区"
  ],
  "fields": [
    "房间编号",
    "洁净等级",
    "粒子计数",
    "温湿度",
    "压差",
    "设备状态",
    "处理备注"
  ],
  "records": [
    [
      "CR-1201",
      "ISO 5",
      "异常",
      "0.5um粒子超限，已通知厂务"
    ],
    [
      "CR-2107",
      "ISO 6",
      "稳定",
      "压差15Pa，温湿度正常"
    ],
    [
      "Y-0302",
      "黄光区",
      "关注",
      "湿度接近上限"
    ]
  ]
};

const statusColors = ["status-ok", "status-watch", "status-danger"];

function MetricCard({ label, value, index }: { label: string; value: string; index: number }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <i className={statusColors[index % statusColors.length]} />
    </article>
  );
}

interface ThresholdConfigProps {
  thresholds: AreaThreshold[];
  onUpdate: (thresholds: AreaThreshold[]) => void;
}

function ThresholdConfig({ thresholds, onUpdate }: ThresholdConfigProps) {
  const [editingArea, setEditingArea] = useState<CleanArea | null>(null);
  const [draft, setDraft] = useState<AreaThreshold | null>(null);

  const startEdit = (area: CleanArea) => {
    const current = thresholds.find((t) => t.area === area);
    if (current) {
      setDraft(JSON.parse(JSON.stringify(current)));
      setEditingArea(area);
    }
  };

  const cancelEdit = () => {
    setEditingArea(null);
    setDraft(null);
  };

  const saveEdit = () => {
    if (!draft) return;
    onUpdate(thresholds.map((t) => (t.area === draft.area ? draft : t)));
    setEditingArea(null);
    setDraft(null);
  };

  const updateDraftField = (field: keyof AreaThreshold, value: number | ThresholdRange, subKey?: "min" | "max") => {
    if (!draft) return;
    if (subKey && typeof value === "number") {
      setDraft({
        ...draft,
        [field]: {
          ...(draft[field] as ThresholdRange),
          [subKey]: value,
        },
      });
    } else {
      setDraft({ ...draft, [field]: value });
    }
  };

  return (
    <section className="threshold-panel panel">
      <div className="section-heading">
        <div>
          <p>厂务工程师配置</p>
          <h2>洁净等级阈值配置</h2>
        </div>
        <div className="threshold-hint">修改阈值后将实时影响下方示例判断结果</div>
      </div>

      <div className="threshold-table-wrap">
        <table className="threshold-table">
          <thead>
            <tr>
              <th rowSpan={2}>洁净区域</th>
              <th colSpan={2}>粒子计数上限 (个/m³)</th>
              <th colSpan={2}>压差 (Pa)</th>
              <th colSpan={2}>温度 (°C)</th>
              <th colSpan={2}>湿度 (%)</th>
              <th rowSpan={2}>操作</th>
            </tr>
            <tr>
              <th>0.5μm</th>
              <th>5.0μm</th>
              <th>最小</th>
              <th>最大</th>
              <th>最小</th>
              <th>最大</th>
              <th>最小</th>
              <th>最大</th>
            </tr>
          </thead>
          <tbody>
            {thresholds.map((t) => (
              <tr key={t.area}>
                <td className="threshold-area">{t.area}</td>
                <td>{t.particle05um.toLocaleString()}</td>
                <td>{t.particle5um.toLocaleString()}</td>
                <td>{t.pressure.min}</td>
                <td>{t.pressure.max}</td>
                <td>{t.temperature.min}</td>
                <td>{t.temperature.max}</td>
                <td>{t.humidity.min}</td>
                <td>{t.humidity.max}</td>
                <td>
                  <button className="threshold-edit-btn" onClick={() => startEdit(t.area)}>
                    编辑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingArea && draft && (
        <div className="threshold-edit-overlay" onClick={cancelEdit}>
          <div className="threshold-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="section-heading">
              <div>
                <p>编辑阈值</p>
                <h2>{draft.area}</h2>
              </div>
            </div>

            <div className="threshold-edit-grid">
              <div className="threshold-edit-group">
                <h4>粒子计数上限</h4>
                <label>
                  <span>0.5μm (个/m³)</span>
                  <input
                    type="number"
                    value={draft.particle05um}
                    onChange={(e) => updateDraftField("particle05um", Number(e.target.value))}
                  />
                </label>
                <label>
                  <span>5.0μm (个/m³)</span>
                  <input
                    type="number"
                    value={draft.particle5um}
                    onChange={(e) => updateDraftField("particle5um", Number(e.target.value))}
                  />
                </label>
              </div>

              <div className="threshold-edit-group">
                <h4>压差范围 (Pa)</h4>
                <label>
                  <span>最小值</span>
                  <input
                    type="number"
                    value={draft.pressure.min}
                    onChange={(e) => updateDraftField("pressure", Number(e.target.value), "min")}
                  />
                </label>
                <label>
                  <span>最大值</span>
                  <input
                    type="number"
                    value={draft.pressure.max}
                    onChange={(e) => updateDraftField("pressure", Number(e.target.value), "max")}
                  />
                </label>
              </div>

              <div className="threshold-edit-group">
                <h4>温度范围 (°C)</h4>
                <label>
                  <span>最小值</span>
                  <input
                    type="number"
                    value={draft.temperature.min}
                    onChange={(e) => updateDraftField("temperature", Number(e.target.value), "min")}
                  />
                </label>
                <label>
                  <span>最大值</span>
                  <input
                    type="number"
                    value={draft.temperature.max}
                    onChange={(e) => updateDraftField("temperature", Number(e.target.value), "max")}
                  />
                </label>
              </div>

              <div className="threshold-edit-group">
                <h4>湿度范围 (%)</h4>
                <label>
                  <span>最小值</span>
                  <input
                    type="number"
                    value={draft.humidity.min}
                    onChange={(e) => updateDraftField("humidity", Number(e.target.value), "min")}
                  />
                </label>
                <label>
                  <span>最大值</span>
                  <input
                    type="number"
                    value={draft.humidity.max}
                    onChange={(e) => updateDraftField("humidity", Number(e.target.value), "max")}
                  />
                </label>
              </div>
            </div>

            <div className="threshold-edit-actions">
              <button onClick={cancelEdit}>取消</button>
              <button className="primary-action" onClick={saveEdit}>
                保存配置
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function PreviewTable({ thresholds }: { thresholds: AreaThreshold[] }) {
  return (
    <section className="preview-panel panel">
      <div className="section-heading">
        <div>
          <p>实时判定预览</p>
          <h2>异常标记预览</h2>
        </div>
        <div className="preview-legend">
          <span className="legend-ok">● 正常</span>
          <span className="legend-watch">● 关注</span>
          <span className="legend-danger">● 异常</span>
        </div>
      </div>

      <div className="preview-table-wrap">
        <table className="preview-table">
          <thead>
            <tr>
              <th>房间编号</th>
              <th>洁净等级</th>
              <th>0.5μm粒子</th>
              <th>5.0μm粒子</th>
              <th>压差(Pa)</th>
              <th>温度(°C)</th>
              <th>湿度(%)</th>
              <th>判定</th>
            </tr>
          </thead>
          <tbody>
            {sampleRecords.map((record) => {
              const anomalies = checkAnomalies(record, thresholds);
              const status = getRecordStatus(anomalies);
              return (
                <tr key={record.id}>
                  <td className="preview-room">{record.roomId}</td>
                  <td>{record.area}</td>
                  <td className={anomalies.particle ? "anomaly-cell" : ""}>
                    {record.particle05um.toLocaleString()}
                    {anomalies.particle && <sup>!</sup>}
                  </td>
                  <td className={anomalies.particle ? "anomaly-cell" : ""}>
                    {record.particle5um.toLocaleString()}
                  </td>
                  <td className={anomalies.pressure ? "anomaly-cell" : ""}>
                    {record.pressure}
                    {anomalies.pressure && <sup>!</sup>}
                  </td>
                  <td className={anomalies.temp ? "anomaly-cell" : ""}>
                    {record.temperature}
                    {anomalies.temp && <sup>!</sup>}
                  </td>
                  <td className={anomalies.humidity ? "anomaly-cell" : ""}>
                    {record.humidity}
                    {anomalies.humidity && <sup>!</sup>}
                  </td>
                  <td>
                    <span className={`record-status ${status.cls}`}>{status.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function InspectionSchedule() {
  const [plans, setPlans] = useState<InspectionPlan[]>(initialPlans);
  const [activeFilter, setActiveFilter] = useState<"全部" | PlanStatus>("全部");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: "2026-06-18", area: planAreas[0], role: planRoles[0], inspector: "" });

  const filtered = activeFilter === "全部" ? plans : plans.filter((p) => p.status === activeFilter);

  const counts = {
    "未开始": plans.filter((p) => p.status === "未开始").length,
    "进行中": plans.filter((p) => p.status === "进行中").length,
    "已完成": plans.filter((p) => p.status === "已完成").length,
  };

  const handleAdd = () => {
    if (!form.inspector.trim()) return;
    const next: InspectionPlan = {
      id: Date.now(),
      date: form.date,
      area: form.area,
      role: form.role,
      inspector: form.inspector.trim(),
      status: "未开始",
    };
    setPlans((prev) => [...prev, next]);
    setForm((prev) => ({ ...prev, inspector: "" }));
    setShowForm(false);
  };

  return (
    <section className="plan-section panel">
      <div className="section-heading">
        <div>
          <p>今日排班</p>
          <h2>巡检计划排班</h2>
        </div>
        <button className="primary-action" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "收起表单" : "新增计划"}
        </button>
      </div>

      <div className="plan-stats">
        {(Object.entries(counts) as [PlanStatus, number][]).map(([label, count]) => (
          <div key={label} className={`plan-stat ${statusTagClass[label]}`}>
            <strong>{count}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="chips muted" style={{ marginBottom: 18 }}>
        {statusFilters.map((f) => (
          <button key={f} className={activeFilter === f ? "chip-active" : ""} onClick={() => setActiveFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="plan-form">
          <label>
            <span>日期</span>
            <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
          </label>
          <label>
            <span>区域</span>
            <select value={form.area} onChange={(e) => setForm((p) => ({ ...p, area: e.target.value as CleanArea }))}>
              {planAreas.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label>
            <span>角色</span>
            <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
              {planRoles.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label>
            <span>巡检员</span>
            <input placeholder="填写巡检员姓名" value={form.inspector} onChange={(e) => setForm((p) => ({ ...p, inspector: e.target.value }))} />
          </label>
          <button className="primary-action" style={{ alignSelf: "end" }} onClick={handleAdd}>
            确认新增
          </button>
        </div>
      )}

      <div className="record-list">
        {filtered.map((plan) => (
          <article key={plan.id} className="record-card plan-card">
            <div className="record-index">{plan.area}</div>
            <div className="plan-card-body">
              <div className="plan-card-top">
                <h3>{plan.inspector}</h3>
                <span className={`plan-tag ${statusTagClass[plan.status]}`}>{plan.status}</span>
              </div>
              <p>{plan.date} · {plan.role}</p>
            </div>
          </article>
        ))}
        {filtered.length === 0 && <p className="plan-empty">暂无匹配的巡检计划</p>}
      </div>
    </section>
  );
}

function App() {
  const [thresholds, setThresholds] = useState<AreaThreshold[]>(defaultThresholds);

  const metricValues = useMemo(() => {
    const results = sampleRecords.map((r) => checkAnomalies(r, thresholds));
    const particle = results.filter((r) => r.particle).length;
    const pressure = results.filter((r) => r.pressure).length;
    const temphum = results.filter((r) => r.temp || r.humidity).length;
    const total = sampleRecords.length - results.filter((r) => r.none).length;
    return [String(particle), String(pressure), String(temphum), String(total)];
  }, [thresholds]);

  const dynamicRecords = useMemo(() => {
    return sampleRecords.map((record) => {
      const anomalies = checkAnomalies(record, thresholds);
      const status = getRecordStatus(anomalies);
      const tags: string[] = [];
      if (anomalies.particle) tags.push("0.5μm/5.0μm粒子超限");
      if (anomalies.pressure) tags.push("压差异常");
      if (anomalies.temp) tags.push("温度偏移");
      if (anomalies.humidity) tags.push("湿度偏移");
      const note = tags.length > 0 ? tags.join("，") + "，已通知厂务" : "各项指标均在阈值内";
      return [record.roomId, record.area, status.label, note] as [string, string, string, string];
    });
  }, [thresholds]);

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">{project.id} · port {project.port}</p>
          <h1>{project.title}</h1>
          <p className="subtitle">{project.subtitle}</p>
        </div>
        <div className="stack-card">
          <span>技术栈</span>
          <strong>{project.stack}</strong>
        </div>
      </section>

      <section className="metrics-grid">
        {project.metrics.map((metric: string, index: number) => (
          <MetricCard key={metric} label={metric} value={metricValues[index]} index={index} />
        ))}
      </section>

      <ThresholdConfig thresholds={thresholds} onUpdate={setThresholds} />

      <PreviewTable thresholds={thresholds} />

      <section className="workspace">
        <aside className="panel narrow">
          <h2>角色</h2>
          <div className="chips">
            {project.users.map((user: string) => (
              <span key={user}>{user}</span>
            ))}
          </div>
          <h2>筛选</h2>
          <div className="chips muted">
            {project.filters.map((filter: string) => (
              <button key={filter}>{filter}</button>
            ))}
          </div>
        </aside>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p>{project.domain}</p>
              <h2>记录字段</h2>
            </div>
            <button className="primary-action">新增记录</button>
          </div>
          <div className="field-grid">
            {project.fields.map((field: string) => (
              <label key={field}>
                <span>{field}</span>
                <input placeholder={"填写" + field} />
              </label>
            ))}
          </div>
        </section>
      </section>

      <InspectionSchedule />

      <section className="records panel">
        <div className="section-heading">
          <div>
            <p>示例数据（跟随阈值实时更新）</p>
            <h2>近期记录</h2>
          </div>
          <button>导出摘要</button>
        </div>
        <div className="record-list">
          {dynamicRecords.map((record, index) => {
            const statusCls =
              record[2] === "正常" ? "record-status-ok" :
              record[2] === "关注" ? "record-status-watch" : "record-status-danger";
            return (
              <article key={record.join("-")} className="record-card">
                <div className="record-index">{String(index + 1).padStart(2, "0")}</div>
                <div>
                  <h3>
                    {record[0]}
                    <span className={`record-status-inline ${statusCls}`}>{record[2]}</span>
                  </h3>
                  <p>{record.slice(1).join(" · ")}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

export default App;
