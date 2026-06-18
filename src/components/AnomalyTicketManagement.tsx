import { useState } from "react";
import type {
  CleanArea, AnomalyTicket, TicketStatus, TicketAnomalyType,
} from "../domain";
import {
  CLEAN_AREAS, TICKET_ASSIGNEES, TICKET_STATUS_FILTERS,
  TICKET_STATUS_TAG_CLASS, TICKET_ANOMALY_TYPE_CLASS,
  nextTicketStatus, prevTicketStatus,
} from "../domain";

interface AnomalyTicketManagementProps {
  tickets: AnomalyTicket[];
  activeFilter: "全部" | TicketStatus;
  onFilterChange: (filter: "全部" | TicketStatus) => void;
  onAddTicket: (ticket: Omit<AnomalyTicket, "id" | "createdAt" | "status">) => void;
  onStatusChange: (ticketId: number, status: TicketStatus) => void;
}

function AnomalyTicketManagement({
  tickets, activeFilter, onFilterChange, onAddTicket, onStatusChange,
}: AnomalyTicketManagementProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    roomId: "",
    area: CLEAN_AREAS[0] as CleanArea,
    anomalyType: "粒子异常" as TicketAnomalyType,
    assignee: TICKET_ASSIGNEES[0],
    remark: "",
  });

  const filtered = activeFilter === "全部" ? tickets : tickets.filter((t) => t.status === activeFilter);

  const counts = {
    "待处理": tickets.filter((t) => t.status === "待处理").length,
    "处理中": tickets.filter((t) => t.status === "处理中").length,
    "已关闭": tickets.filter((t) => t.status === "已关闭").length,
  };

  const handleAdd = () => {
    if (!form.roomId.trim()) return;
    onAddTicket({
      roomId: form.roomId.trim(),
      area: form.area,
      anomalyType: form.anomalyType,
      assignee: form.assignee,
      remark: form.remark.trim(),
    });
    setForm((prev) => ({ ...prev, roomId: "", remark: "" }));
    setShowForm(false);
  };

  return (
    <section className="ticket-section panel">
      <div className="section-heading">
        <div>
          <p>异常跟踪</p>
          <h2>异常处理工单</h2>
        </div>
        <button className="primary-action" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "收起表单" : "新增工单"}
        </button>
      </div>

      <div className="ticket-stats">
        {(Object.entries(counts) as [TicketStatus, number][]).map(([label, count]) => (
          <div key={label} className={`ticket-stat ${TICKET_STATUS_TAG_CLASS[label]}`}>
            <strong>{count}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="chips muted" style={{ marginBottom: 18 }}>
        {TICKET_STATUS_FILTERS.map((f) => (
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
        <div className="ticket-form">
          <label>
            <span>房间编号</span>
            <input
              placeholder="例如 CR-1201"
              value={form.roomId}
              onChange={(e) => setForm((p) => ({ ...p, roomId: e.target.value }))}
            />
          </label>
          <label>
            <span>洁净等级</span>
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
            <span>异常类型</span>
            <select
              value={form.anomalyType}
              onChange={(e) => setForm((p) => ({ ...p, anomalyType: e.target.value as TicketAnomalyType }))}
            >
              <option value="粒子异常">粒子异常</option>
              <option value="压差异常">压差异常</option>
              <option value="温湿度偏移">温湿度偏移</option>
            </select>
          </label>
          <label>
            <span>负责人</span>
            <select
              value={form.assignee}
              onChange={(e) => setForm((p) => ({ ...p, assignee: e.target.value }))}
            >
              {TICKET_ASSIGNEES.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label className="ticket-form-remark">
            <span>备注</span>
            <input
              placeholder="异常描述或处理说明"
              value={form.remark}
              onChange={(e) => setForm((p) => ({ ...p, remark: e.target.value }))}
            />
          </label>
          <button
            className="primary-action"
            style={{ alignSelf: "end" }}
            onClick={handleAdd}
          >
            确认创建
          </button>
        </div>
      )}

      <div className="ticket-list">
        {filtered.map((ticket) => {
          const nextStatus = nextTicketStatus(ticket.status);
          const prevStatus = prevTicketStatus(ticket.status);
          return (
            <article key={ticket.id} className="ticket-card">
              <div className="ticket-card-header">
                <div className="ticket-room-info">
                  <span className="ticket-room-id">{ticket.roomId}</span>
                  <span className="ticket-area">{ticket.area}</span>
                </div>
                <span className={`ticket-status-tag ${TICKET_STATUS_TAG_CLASS[ticket.status]}`}>
                  {ticket.status}
                </span>
              </div>
              <div className="ticket-card-body">
                <div className="ticket-anomaly-type">
                  <span className={`ticket-type-badge ${TICKET_ANOMALY_TYPE_CLASS[ticket.anomalyType]}`}>
                    {ticket.anomalyType}
                  </span>
                </div>
                <div className="ticket-meta">
                  <div className="ticket-meta-item">
                    <span className="ticket-meta-label">负责人</span>
                    <span className="ticket-meta-value">{ticket.assignee}</span>
                  </div>
                  <div className="ticket-meta-item">
                    <span className="ticket-meta-label">创建时间</span>
                    <span className="ticket-meta-value">{ticket.createdAt}</span>
                  </div>
                </div>
                {ticket.remark && (
                  <div className="ticket-remark">
                    <span className="ticket-meta-label">备注</span>
                    <p>{ticket.remark}</p>
                  </div>
                )}
              </div>
              <div className="ticket-actions">
                {prevStatus && (
                  <button
                    className="ticket-action-btn secondary"
                    onClick={() => onStatusChange(ticket.id, prevStatus)}
                  >
                    回退到{prevStatus}
                  </button>
                )}
                {nextStatus && (
                  <button
                    className="ticket-action-btn primary"
                    onClick={() => onStatusChange(ticket.id, nextStatus)}
                  >
                    标记为{nextStatus}
                  </button>
                )}
              </div>
            </article>
          );
        })}
        {filtered.length === 0 && <p className="ticket-empty">暂无匹配的工单</p>}
      </div>
    </section>
  );
}

export default AnomalyTicketManagement;
