import { useState } from "react";
import "./styles.css";

type PlanStatus = "未开始" | "进行中" | "已完成";

interface InspectionPlan {
  id: number;
  date: string;
  area: string;
  role: string;
  inspector: string;
  status: PlanStatus;
}

const initialPlans: InspectionPlan[] = [
  { id: 1, date: "2026-06-18", area: "ISO 5", role: "巡检员", inspector: "张伟", status: "进行中" },
  { id: 2, date: "2026-06-18", area: "ISO 6", role: "厂务工程师", inspector: "李娜", status: "未开始" },
  { id: 3, date: "2026-06-18", area: "黄光区", role: "班组长", inspector: "王强", status: "已完成" },
  { id: 4, date: "2026-06-18", area: "ISO 7", role: "巡检员", inspector: "赵敏", status: "未开始" },
  { id: 5, date: "2026-06-18", area: "ISO 5", role: "厂务工程师", inspector: "陈磊", status: "已完成" },
];

const statusFilters: ("全部" | PlanStatus)[] = ["全部", "未开始", "进行中", "已完成"];

const planAreas = ["ISO 5", "ISO 6", "ISO 7", "黄光区"];
const planRoles = ["巡检员", "厂务工程师", "班组长"];

const statusTagClass: Record<PlanStatus, string> = {
  "未开始": "plan-tag-pending",
  "进行中": "plan-tag-active",
  "已完成": "plan-tag-done",
};

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
            <select value={form.area} onChange={(e) => setForm((p) => ({ ...p, area: e.target.value }))}>
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
  const values = project.metrics.map((metric: string, index: number) => {
    const base = [84, 12, 31, 7][index % 4];
    return String(base + index * 3);
  });

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
          <MetricCard key={metric} label={metric} value={values[index]} index={index} />
        ))}
      </section>

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
            <p>示例数据</p>
            <h2>近期记录</h2>
          </div>
          <button>导出摘要</button>
        </div>
        <div className="record-list">
          {project.records.map((record: string[], index: number) => (
            <article key={record.join("-")} className="record-card">
              <div className="record-index">{String(index + 1).padStart(2, "0")}</div>
              <div>
                <h3>{record[0]}</h3>
                <p>{record.slice(1).join(" · ")}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default App;
