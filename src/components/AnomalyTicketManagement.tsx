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
  onAddTicket: (ticket: Omit<AnomalyTicket, "id" | "createdAt" | "status" | "processNotes">) => void;
  onStatusChange: (ticketId: number, status: TicketStatus, processNote?: string) => void;
}

function AnomalyTicketManagement({
  tickets, activeFilter, onFilterChange, onAddTicket, onStatusChange,
}: AnomalyTicketManagementProps) {
  const [showForm, setShowForm] = useState(false);
  const [assigneeFilter, setAssigneeFilter] = useState<string>("全部");
  const [pendingAction, setPendingAction] = useState<{
    ticketId: number;
    targetStatus: TicketStatus;
    direction: "forward" | "backward";
  } | null>(null);
  const [processNoteInput, setProcessNoteInput] = useState("");
  const [form, setForm] = useState({
    roomId: "",
    area: CLEAN_AREAS[0] as CleanArea,
    anomalyType: "粒子异常" as TicketAnomalyType,
    assignee: TICKET_ASSIGNEES[0],
    remark: "",
  });

  const filtered = tickets.filter((t) => {
    if (activeFilter !== "全部" && t.status !== activeFilter) return false;
    if (assigneeFilter !== "全部" && t.assignee !== assigneeFilter) return false;
    return true;
  });

  const counts = {
    "待处理": tickets.filter((t) => t.status === "待处理").length,
    "处理中": tickets.filter((t) => t.status === "处理中").length,
    "已关闭": tickets.filter((t) => t.status === "已关闭").length,
  };

  const assigneeCounts = TICKET_ASSIGNEES.map((name) => ({
    name,
    count: tickets.filter((t) => t.assignee === name).length,
  }));

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

  const handleStatusClick = (
    ticketId: number,
    targetStatus: TicketStatus,
    direction: "forward" | "backward"
  ) => {
    if (direction === "forward") {
      setPendingAction({ ticketId, targetStatus, direction });
      setProcessNoteInput("");
    } else {
      onStatusChange(ticketId, targetStatus);
    }
  };

  const confirmStatusChange = () => {
    if (!pendingAction) return;
    onStatusChange(
      pendingAction.ticketId,
      pendingAction.targetStatus,
      processNoteInput.trim() || undefined
    );
    setPendingAction(null);
    setProcessNoteInput("");
  };

  const cancelStatusChange = () => {
    setPendingAction(null);
    setProcessNoteInput("");
  };

  const getLastProcessNote = (ticket: AnomalyTicket) => {
    const notes = ticket.processNotes || [];
    return notes.length > 0 ? notes[notes.length - 1] : null;
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

      <div className="ticket-filter-bar">
        <div className="ticket-filter-group">
          <span className="ticket-filter-label">状态</span>
          <div className="chips muted">
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
        </div>
        <div className="ticket-filter-group">
          <span className="ticket-filter-label">负责人</span>
          <div className="chips muted">
            <button
              className={assigneeFilter === "全部" ? "chip-active" : ""}
              onClick={() => setAssigneeFilter("全部")}
            >
              全部
            </button>
            {TICKET_ASSIGNEES.map((name) => (
              <button
                key={name}
                className={assigneeFilter === name ? "chip-active" : ""}
                onClick={() => setAssigneeFilter(name)}
              >
                {name}
                <span className="chip-count">
                  {assigneeCounts.find((a) => a.name === name)?.count ?? 0}
                </span>
              </button>
            ))}
          </div>
        </div>
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
          const lastNote = getLastProcessNote(ticket);
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
                {lastNote && (
                  <div className="ticket-process-note">
                    <div className="ticket-process-note-header">
                      <span className="ticket-meta-label">最近处理说明</span>
                      <span className="ticket-process-note-time">{lastNote.timestamp}</span>
                    </div>
                    <p>{lastNote.note}</p>
                    <span className="ticket-process-note-transition">
                      {lastNote.fromStatus} → {lastNote.toStatus}
                    </span>
                  </div>
                )}
              </div>
              <div className="ticket-actions">
                {prevStatus && (
                  <button
                    className="ticket-action-btn secondary"
                    onClick={() => handleStatusClick(ticket.id, prevStatus, "backward")}
                  >
                    回退到{prevStatus}
                  </button>
                )}
                {nextStatus && (
                  <button
                    className="ticket-action-btn primary"
                    onClick={() => handleStatusClick(ticket.id, nextStatus, "forward")}
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

      {pendingAction && (
        <div className="ticket-note-overlay" onClick={cancelStatusChange}>
          <div className="ticket-note-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>推进工单状态</h3>
            <p className="ticket-note-desc">
              将工单标记为「{pendingAction.targetStatus}」，可填写处理说明（选填）
            </p>
            <textarea
              className="ticket-note-input"
              placeholder="请输入处理说明，例如：已安排工程师排查..."
              value={processNoteInput}
              onChange={(e) => setProcessNoteInput(e.target.value)}
              rows={3}
              autoFocus
            />
            <div className="ticket-note-actions">
              <button className="ticket-action-btn secondary" onClick={cancelStatusChange}>
                取消
              </button>
              <button className="ticket-action-btn primary" onClick={confirmStatusChange}>
                确认{processNoteInput.trim() ? "并添加说明" : "推进"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default AnomalyTicketManagement;
