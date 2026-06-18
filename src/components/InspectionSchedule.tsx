import { useState } from "react";
import type {
  CleanArea, InspectionPlan, PlanStatus,
} from "../domain";
import {
  CLEAN_AREAS, PLAN_ROLES, PLAN_STATUS_FILTERS, PLAN_STATUS_TAG_CLASS,
} from "../domain";

interface InspectionScheduleProps {
  plans: InspectionPlan[];
  activeFilter: "全部" | PlanStatus;
  onFilterChange: (filter: "全部" | PlanStatus) => void;
  onAddPlan: (plan: { date: string; area: CleanArea; role: string; inspector: string }) => void;
  onStatusChange?: (planId: number, status: PlanStatus) => void;
}

function InspectionSchedule({
  plans, activeFilter, onFilterChange, onAddPlan, onStatusChange,
}: InspectionScheduleProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: "2026-06-18",
    area: CLEAN_AREAS[0] as CleanArea,
    role: PLAN_ROLES[0],
    inspector: "",
  });

  const filtered = activeFilter === "全部" ? plans : plans.filter((p) => p.status === activeFilter);

  const counts = {
    "未开始": plans.filter((p) => p.status === "未开始").length,
    "进行中": plans.filter((p) => p.status === "进行中").length,
    "已完成": plans.filter((p) => p.status === "已完成").length,
  };

  const handleAdd = () => {
    if (!form.inspector.trim()) return;
    onAddPlan({
      date: form.date,
      area: form.area,
      role: form.role,
      inspector: form.inspector.trim(),
    });
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
          <div key={label} className={`plan-stat ${PLAN_STATUS_TAG_CLASS[label]}`}>
            <strong>{count}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="chips muted" style={{ marginBottom: 18 }}>
        {PLAN_STATUS_FILTERS.map((f) => (
          <button
            key={f}
            className={activeFilter === f ? "chip-active" : ""}
            onClick={() => onFilterChange(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="plan-form">
          <label>
            <span>日期</span>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
            />
          </label>
          <label>
            <span>区域</span>
            <select
              value={form.area}
              onChange={(e) => setForm((p) => ({ ...p, area: e.target.value as CleanArea }))}
            >
              {CLEAN_AREAS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label>
            <span>角色</span>
            <select
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
            >
              {PLAN_ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label>
            <span>巡检员</span>
            <input
              placeholder="填写巡检员姓名"
              value={form.inspector}
              onChange={(e) => setForm((p) => ({ ...p, inspector: e.target.value }))}
            />
          </label>
          <button
            className="primary-action"
            style={{ alignSelf: "end" }}
            onClick={handleAdd}
          >
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
                <span className={`plan-tag ${PLAN_STATUS_TAG_CLASS[plan.status]}`}>
                  {plan.status}
                </span>
              </div>
              <p>{plan.date} · {plan.role}</p>
            </div>
            {onStatusChange && (
              <div className="plan-card-actions">
                {plan.status !== "已完成" && (
                  <button
                    className="ticket-action-btn primary"
                    onClick={() => {
                      const next = plan.status === "未开始" ? "进行中" : "已完成";
                      onStatusChange(plan.id, next);
                    }}
                  >
                    {plan.status === "未开始" ? "开始巡检" : "完成"}
                  </button>
                )}
              </div>
            )}
          </article>
        ))}
        {filtered.length === 0 && <p className="plan-empty">暂无匹配的巡检计划</p>}
      </div>
    </section>
  );
}

export default InspectionSchedule;
