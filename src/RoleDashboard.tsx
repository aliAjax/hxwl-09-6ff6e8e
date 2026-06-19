import { useState, useMemo } from "react";
import type {
  CleanArea,
  RoleType,
  InspectionPlan,
  AnomalyTicket,
  InspectionRecord,
  AnomalyTrace,
  AreaThreshold,
  TicketStatus,
  PlanStatus,
  TicketAnomalyType,
} from "./domain";

const roles: RoleType[] = ["巡检员", "厂务工程师", "班组长"];

export const roleColors: Record<RoleType, string> = {
  "巡检员": "#0f766e",
  "厂务工程师": "#2563eb",
  "班组长": "#7c3aed",
};

const priorityColors: Record<string, string> = {
  "高": "#e11d48",
  "中": "#d97706",
  "低": "#0f766e",
};

const ticketStatusColors: Record<TicketStatus, string> = {
  "待处理": "#d97706",
  "处理中": "#2563eb",
  "已关闭": "#16a34a",
};

const planStatusColors: Record<PlanStatus, string> = {
  "未开始": "#64748b",
  "进行中": "#2563eb",
  "已完成": "#16a34a",
};

const anomalyTypeColors: Record<TicketAnomalyType, string> = {
  "粒子异常": "#7c3aed",
  "压差异常": "#2563eb",
  "温湿度偏移": "#e11d48",
};

interface RoleDashboardProps {
  onQuickAction?: (action: string) => void;
  activeRole: RoleType;
  onRoleChange: (role: RoleType) => void;
  activeInspector: string;
  onInspectorChange: (inspector: string) => void;
  inspectionPlans: InspectionPlan[];
  inspectionRecords: InspectionRecord[];
  anomalyTickets: AnomalyTicket[];
  anomalyTraces: AnomalyTrace[];
  thresholds: AreaThreshold[];
  todayPlans: InspectionPlan[];
}

function RoleMetricCard({
  label,
  value,
  status,
  roleColor,
}: {
  label: string;
  value: string;
  status: "ok" | "warn" | "danger";
  roleColor: string;
}) {
  const statusClass =
    status === "ok" ? "status-ok" : status === "warn" ? "status-watch" : "status-danger";

  return (
    <article className="role-metric-card">
      <span>{label}</span>
      <strong style={{ color: roleColor }}>{value}</strong>
      <i className={statusClass} />
    </article>
  );
}

function QuickActionButton({
  label,
  icon,
  action,
  roleColor,
  onClick,
}: {
  label: string;
  icon: string;
  action: string;
  roleColor: string;
  onClick: (action: string) => void;
}) {
  return (
    <button
      className="role-quick-action"
      onClick={() => onClick(action)}
      style={{
        borderColor: `${roleColor}33`,
        background: `${roleColor}0d`,
      }}
    >
      <span className="role-action-icon">{icon}</span>
      <span style={{ color: roleColor }}>{label}</span>
    </button>
  );
}

function getPriorityFromArea(area: CleanArea): "高" | "中" | "低" {
  switch (area) {
    case "ISO 5":
      return "高";
    case "ISO 6":
      return "中";
    case "ISO 7":
      return "低";
    case "黄光区":
      return "中";
    default:
      return "中";
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  const parts = dateStr.split(" ");
  if (parts.length > 1) {
    return parts[0];
  }
  return dateStr;
}

function getGreeting(): string {
  const now = new Date();
  const hour = now.getHours();
  if (hour < 12) return "早上好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

function InspectorView({
  plans,
  records,
  tickets,
  roleColor,
  onAction,
  inspector,
}: {
  plans: InspectionPlan[];
  records: InspectionRecord[];
  tickets: AnomalyTicket[];
  roleColor: string;
  onAction: (action: string) => void;
  inspector: string;
}) {
  const priorityBadgeClass = (priority: string) => {
    const color = priorityColors[priority as keyof typeof priorityColors];
    return {
      background: `${color}14`,
      color,
      borderColor: `${color}40`,
    };
  };

  const statusBadgeClass = (status: PlanStatus) => {
    const color = planStatusColors[status];
    return {
      background: `${color}14`,
      color,
      borderColor: `${color}40`,
    };
  };

  const myPlans = plans.filter((p) => p.role === "巡检员" && p.inspector === inspector);
  const pendingPlans = myPlans.filter((p) => p.status !== "已完成");
  const recentAnomalyRecords = records
    .filter((r) => r.status === "异常")
    .slice(0, 5);

  return (
    <div className="role-content-grid">
      <section className="role-panel">
        <div className="role-section-heading">
          <div>
            <p className="role-section-eyebrow" style={{ color: roleColor }}>
              待巡检计划
            </p>
            <h2>我的巡检任务</h2>
          </div>
          <button
            className="role-action-btn primary"
            style={{ background: roleColor, borderColor: roleColor }}
            onClick={() => onAction("viewSchedule")}
          >
            查看全部
          </button>
        </div>
        <div className="role-list">
          {pendingPlans.length === 0 ? (
            <div className="role-empty-state">
              <p>暂无待巡检计划</p>
            </div>
          ) : (
            pendingPlans.slice(0, 5).map((plan) => {
              const priority = getPriorityFromArea(plan.area);
              return (
                <article key={plan.id} className="role-list-card">
                  <div
                    className="role-list-index"
                    style={{ background: roleColor }}
                  >
                    {plan.area.slice(-2)}
                  </div>
                  <div className="role-list-body">
                    <div className="role-list-header">
                      <h3>{plan.area} 巡检</h3>
                      <span
                        className="role-badge"
                        style={statusBadgeClass(plan.status)}
                      >
                        {plan.status}
                      </span>
                    </div>
                    <div className="role-list-meta">
                      <span className="role-area-tag">{plan.area}</span>
                      <span>负责人: {plan.inspector}</span>
                      <span
                        className="role-badge"
                        style={priorityBadgeClass(priority)}
                      >
                        {priority}优先级
                      </span>
                    </div>
                    <div className="role-list-footer">
                      <span className="role-deadline">
                        计划日期: {plan.date}
                      </span>
                      <button
                        className="role-list-action"
                        style={{ color: roleColor, borderColor: `${roleColor}40` }}
                        onClick={() => onAction("createRecord")}
                      >
                        立即巡检
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="role-panel">
        <div className="role-section-heading">
          <div>
            <p className="role-section-eyebrow" style={{ color: "#e11d48" }}>
              最近异常
            </p>
            <h2>异常记录</h2>
          </div>
          <span className="role-count-badge danger">
            {recentAnomalyRecords.length} 条异常
          </span>
        </div>
        <div className="role-list">
          {recentAnomalyRecords.length === 0 ? (
            <div className="role-empty-state">
              <p>暂无异常记录</p>
            </div>
          ) : (
            recentAnomalyRecords.map((record) => {
              const relatedTickets = tickets.filter(
                (t) => t.sourceRecordId === record.id
              );
              return (
                <article key={record.id} className="role-list-card">
                  <div
                    className="role-list-index"
                    style={{ background: "#e11d48" }}
                  >
                    异常
                  </div>
                  <div className="role-list-body">
                    <div className="role-list-header">
                      <h3>{record.roomId}</h3>
                      <span className="role-badge" style={{
                        background: "#e11d4814",
                        color: "#e11d48",
                        borderColor: "#e11d4840",
                      }}>
                        异常
                      </span>
                    </div>
                    <div className="role-list-meta">
                      <span className="role-area-tag">{record.area}</span>
                      <span>设备: {record.deviceStatus}</span>
                    </div>
                    <div className="role-list-footer">
                      <span className="role-deadline">
                        {formatDate(record.createdAt)}
                      </span>
                      {relatedTickets.length > 0 ? (
                        <span className="role-anomaly-count">
                          {relatedTickets.length} 个工单
                        </span>
                      ) : (
                        <button
                          className="role-list-action"
                          style={{ color: roleColor, borderColor: `${roleColor}40` }}
                          onClick={() => onAction("createDeviceTicket")}
                        >
                          创建工单
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function EngineerView({
  tickets,
  records,
  roleColor,
  onAction,
}: {
  tickets: AnomalyTicket[];
  records: InspectionRecord[];
  roleColor: string;
  onAction: (action: string) => void;
}) {
  const priorityBadgeClass = (priority: string) => {
    const color = priorityColors[priority as keyof typeof priorityColors];
    return {
      background: `${color}14`,
      color,
      borderColor: `${color}40`,
    };
  };

  const statusBadgeClass = (status: TicketStatus) => {
    const color = ticketStatusColors[status];
    return {
      background: `${color}14`,
      color,
      borderColor: `${color}40`,
    };
  };

  const typeBadgeClass = (type: TicketAnomalyType) => {
    const color = anomalyTypeColors[type];
    return {
      background: `${color}14`,
      color,
      borderColor: `${color}40`,
    };
  };

  const pendingTickets = tickets.filter(
    (t) => t.status !== "已关闭"
  );

  const deviceStats = useMemo(() => {
    const stats: Record<string, { running: number; fault: number; standby: number }> = {};
    records.forEach((r) => {
      if (!stats[r.area]) {
        stats[r.area] = { running: 0, fault: 0, standby: 0 };
      }
      if (r.deviceStatus === "运行中") {
        stats[r.area].running++;
      } else if (r.deviceStatus === "故障") {
        stats[r.area].fault++;
      } else {
        stats[r.area].standby++;
      }
    });
    return stats;
  }, [records]);

  const deviceList = useMemo(() => {
    const rooms = new Map<string, { roomId: string; area: CleanArea; status: string; lastCheck: string; anomalyCount: number }>();
    records.forEach((r) => {
      const existing = rooms.get(r.roomId);
      if (!existing || new Date(r.createdAt) > new Date(existing.lastCheck)) {
        const anomalyCount = tickets.filter(
          (t) => t.roomId === r.roomId && t.status !== "已关闭"
        ).length;
        rooms.set(r.roomId, {
          roomId: r.roomId,
          area: r.area,
          status: r.deviceStatus,
          lastCheck: r.createdAt,
          anomalyCount,
        });
      }
    });
    return Array.from(rooms.values()).slice(0, 6);
  }, [records, tickets]);

  return (
    <div className="role-content-grid">
      <section className="role-panel">
        <div className="role-section-heading">
          <div>
            <p className="role-section-eyebrow" style={{ color: roleColor }}>
              设备状态
            </p>
            <h2>设备监控</h2>
          </div>
          <button
            className="role-action-btn primary"
            style={{ background: roleColor, borderColor: roleColor }}
            onClick={() => onAction("viewDevices")}
          >
            查看全部
          </button>
        </div>
        <div className="role-list">
          {deviceList.length === 0 ? (
            <div className="role-empty-state">
              <p>暂无设备数据</p>
            </div>
          ) : (
            deviceList.map((device, index) => (
              <article key={device.roomId} className="role-list-card">
                <div className="role-device-icon">
                  <span
                    className="role-device-dot"
                    style={{
                      background:
                        device.status === "运行中"
                          ? "#16a34a"
                          : device.status === "故障"
                          ? "#e11d48"
                          : "#64748b",
                    }}
                  />
                </div>
                <div className="role-list-body">
                  <div className="role-list-header">
                    <h3>{device.roomId}</h3>
                    <span
                      className="role-badge"
                      style={{
                        background:
                          device.status === "运行中"
                            ? "#16a34a14"
                            : device.status === "故障"
                            ? "#e11d4814"
                            : "#64748b14",
                        color:
                          device.status === "运行中"
                            ? "#16a34a"
                            : device.status === "故障"
                            ? "#e11d48"
                            : "#64748b",
                        borderColor:
                          device.status === "运行中"
                            ? "#16a34a40"
                            : device.status === "故障"
                            ? "#e11d4840"
                            : "#64748b40",
                      }}
                    >
                      {device.status}
                    </span>
                  </div>
                  <div className="role-list-meta">
                    <span className="role-area-tag">{device.area}</span>
                  </div>
                  <div className="role-list-footer">
                    <span className="role-deadline">
                      上次检查: {formatDate(device.lastCheck)}
                    </span>
                    {device.anomalyCount > 0 ? (
                      <span className="role-anomaly-count">
                        {device.anomalyCount} 项异常
                      </span>
                    ) : (
                      <span className="role-status-ok">运行正常</span>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="role-panel">
        <div className="role-section-heading">
          <div>
            <p className="role-section-eyebrow" style={{ color: roleColor }}>
              环境异常
            </p>
            <h2>待处理异常</h2>
          </div>
          <button
            className="role-action-btn primary"
            style={{ background: roleColor, borderColor: roleColor }}
            onClick={() => onAction("createDeviceTicket")}
          >
            新增工单
          </button>
        </div>
        <div className="role-list">
          {pendingTickets.length === 0 ? (
            <div className="role-empty-state">
              <p>暂无待处理异常</p>
            </div>
          ) : (
            pendingTickets.slice(0, 5).map((ticket) => {
              const priority = getPriorityFromArea(ticket.area);
              return (
                <article key={ticket.id} className="role-list-card">
                  <div
                    className="role-list-index"
                    style={{
                      background:
                        ticket.status === "待处理"
                          ? "#d97706"
                          : roleColor,
                    }}
                  >
                    #{ticket.id}
                  </div>
                  <div className="role-list-body">
                    <div className="role-list-header">
                      <h3>
                        {ticket.anomalyType} · {ticket.roomId}
                      </h3>
                      <span
                        className="role-badge"
                        style={statusBadgeClass(ticket.status)}
                      >
                        {ticket.status}
                      </span>
                    </div>
                    <div className="role-list-meta">
                      <span className="role-area-tag">{ticket.area}</span>
                      <span>负责人: {ticket.assignee}</span>
                      <span
                        className="role-badge"
                        style={typeBadgeClass(ticket.anomalyType)}
                      >
                        {ticket.anomalyType}
                      </span>
                      <span
                        className="role-badge"
                        style={priorityBadgeClass(priority)}
                      >
                        {priority}
                      </span>
                    </div>
                    <div className="role-list-footer">
                      <span className="role-deadline">
                        创建时间: {formatDate(ticket.createdAt)}
                      </span>
                      {ticket.status !== "已关闭" && (
                        <button
                          className="role-list-action"
                          style={{ color: roleColor, borderColor: `${roleColor}40` }}
                          onClick={() => onAction("createDeviceTicket")}
                        >
                          处理
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function SupervisorView({
  plans,
  tickets,
  records,
  traces,
  thresholds,
  roleColor,
  onAction,
}: {
  plans: InspectionPlan[];
  tickets: AnomalyTicket[];
  records: InspectionRecord[];
  traces: AnomalyTrace[];
  thresholds: AreaThreshold[];
  roleColor: string;
  onAction: (action: string) => void;
}) {
  const priorityBadgeClass = (priority: string) => {
    const color = priorityColors[priority as keyof typeof priorityColors];
    return {
      background: `${color}14`,
      color,
      borderColor: `${color}40`,
    };
  };

  const areaRiskSummary = useMemo(() => {
    const areas: CleanArea[] = ["ISO 5", "ISO 6", "ISO 7", "黄光区"];
    return areas.map((area) => {
      const areaTickets = tickets.filter(
        (t) => t.area === area && t.status !== "已关闭"
      );
      const areaRecords = records.filter((r) => r.area === area);
      const areaTraces = traces.filter(
        (t) => t.area === area && t.status !== "已恢复"
      );
      const anomalyRecords = areaRecords.filter((r) => r.status === "异常");

      let riskLevel: "高" | "中" | "低";
      if (areaTickets.length >= 3 || areaTraces.length >= 2) {
        riskLevel = "高";
      } else if (areaTickets.length >= 1 || areaTraces.length >= 1) {
        riskLevel = "中";
      } else {
        riskLevel = "低";
      }

      return {
        area,
        ticketCount: areaTickets.length,
        traceCount: areaTraces.length,
        anomalyRecordCount: anomalyRecords.length,
        riskLevel,
      };
    });
  }, [tickets, records, traces]);

  const openTickets = tickets.filter((t) => t.status !== "已关闭");

  const summaryMetrics = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayRecords = records.filter((r) => r.createdAt.startsWith(todayStr));
    const todayPlansCount = plans.filter((p) => p.date === todayStr).length;
    const completedPlansCount = plans.filter(
      (p) => p.date === todayStr && p.status === "已完成"
    ).length;
    const completionRate =
      todayPlansCount > 0
        ? Math.round((completedPlansCount / todayPlansCount) * 100)
        : 0;

    const totalTickets = tickets.length;
    const closedTickets = tickets.filter((t) => t.status === "已关闭").length;
    const ticketCloseRate =
      totalTickets > 0 ? Math.round((closedTickets / totalTickets) * 100) : 0;

    const activeTraces = traces.filter((t) => t.status !== "已恢复").length;

    return [
      {
        label: "今日巡检完成率",
        value: completionRate,
        unit: "%",
        trend: completionRate >= 80 ? "up" : completionRate >= 50 ? "stable" : "down",
        changePercent: 0,
        color: "#0f766e",
      },
      {
        label: "异常工单处理率",
        value: ticketCloseRate,
        unit: "%",
        trend: ticketCloseRate >= 70 ? "up" : ticketCloseRate >= 40 ? "stable" : "down",
        changePercent: 0,
        color: "#2563eb",
      },
      {
        label: "活跃异常追踪",
        value: activeTraces,
        unit: "个",
        trend: activeTraces <= 2 ? "down" : activeTraces <= 5 ? "stable" : "up",
        changePercent: 0,
        color: "#7c3aed",
      },
      {
        label: "未关闭工单",
        value: openTickets.length,
        unit: "个",
        trend: openTickets.length <= 2 ? "down" : openTickets.length <= 5 ? "stable" : "up",
        changePercent: 0,
        color: "#e11d48",
      },
    ];
  }, [plans, tickets, traces, records, openTickets.length]);

  const typeLabel: Record<string, string> = {
    plan: "巡检计划",
    ticket: "异常工单",
    inspection: "巡检记录",
  };

  const typeColor: Record<string, string> = {
    plan: "#2563eb",
    ticket: "#e11d48",
    inspection: "#7c3aed",
  };

  return (
    <div className="role-content-grid">
      <section className="role-panel">
        <div className="role-section-heading">
          <div>
            <p className="role-section-eyebrow" style={{ color: roleColor }}>
              区域风险
            </p>
            <h2>风险汇总</h2>
          </div>
          <button
            className="role-action-btn primary"
            style={{ background: roleColor, borderColor: roleColor }}
            onClick={() => onAction("exportReport")}
          >
            导出报表
          </button>
        </div>
        <div className="role-summary-grid">
          {areaRiskSummary.map((item, index) => (
            <article key={item.area} className="role-summary-card">
              <div className="role-summary-header">
                <span className="role-summary-label">{item.area}</span>
                <span
                  className={`role-trend ${
                    item.riskLevel === "高"
                      ? "up"
                      : item.riskLevel === "中"
                      ? "stable"
                      : "down"
                  }`}
                  style={{
                    color:
                      item.riskLevel === "高"
                        ? "#e11d48"
                        : item.riskLevel === "中"
                        ? "#d97706"
                        : "#16a34a",
                  }}
                >
                  {item.riskLevel === "高"
                    ? "↑ 高风险"
                    : item.riskLevel === "中"
                    ? "→ 中风险"
                    : "↓ 低风险"}
                </span>
              </div>
              <div
                className="role-summary-value"
                style={{
                  color:
                    item.riskLevel === "高"
                      ? "#e11d48"
                      : item.riskLevel === "中"
                      ? "#d97706"
                      : "#16a34a",
                }}
              >
                {item.ticketCount + item.traceCount}
                <span className="role-summary-unit">项异常</span>
              </div>
              <div className="role-progress-bar">
                <div
                  className="role-progress-fill"
                  style={{
                    width: `${Math.min(
                      ((item.ticketCount + item.traceCount) / 10) * 100,
                      100
                    )}%`,
                    background:
                      item.riskLevel === "高"
                        ? "#e11d48"
                        : item.riskLevel === "中"
                        ? "#d97706"
                        : "#16a34a",
                  }}
                />
              </div>
              <div className="role-summary-details">
                <span>工单: {item.ticketCount}</span>
                <span>追踪: {item.traceCount}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="role-panel">
        <div className="role-section-heading">
          <div>
            <p className="role-section-eyebrow" style={{ color: "#e11d48" }}>
              待处理
            </p>
            <h2>未关闭工单</h2>
          </div>
          <span className="role-count-badge danger">
            {openTickets.length} 项未关闭
          </span>
        </div>
        <div className="role-list">
          {openTickets.length === 0 ? (
            <div className="role-empty-state">
              <p>暂无未关闭工单</p>
            </div>
          ) : (
            openTickets.slice(0, 5).map((ticket) => {
              const priority = getPriorityFromArea(ticket.area);
              return (
                <article key={ticket.id} className="role-list-card">
                  <div
                    className="role-list-index"
                    style={{ background: typeColor["ticket"] }}
                  >
                    工单
                  </div>
                  <div className="role-list-body">
                    <div className="role-list-header">
                      <h3>
                        {ticket.anomalyType} · {ticket.roomId}
                      </h3>
                      <span
                        className="role-badge"
                        style={{
                          background: `${typeColor["ticket"]}14`,
                          color: typeColor["ticket"],
                          borderColor: `${typeColor["ticket"]}40`,
                        }}
                      >
                        {ticket.status}
                      </span>
                    </div>
                    <div className="role-list-meta">
                      <span className="role-area-tag">{ticket.area}</span>
                      <span>负责人: {ticket.assignee}</span>
                      <span
                        className="role-badge"
                        style={priorityBadgeClass(priority)}
                      >
                        {priority}
                      </span>
                    </div>
                    <div className="role-list-footer">
                      <span className="role-deadline">
                        创建: {formatDate(ticket.createdAt)}
                      </span>
                      <button
                        className="role-list-action"
                        style={{ color: roleColor, borderColor: `${roleColor}40` }}
                        onClick={() => onAction("assignTask")}
                      >
                        分配处理
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

export default function RoleDashboard({
  onQuickAction,
  activeRole,
  onRoleChange,
  activeInspector,
  onInspectorChange,
  inspectionPlans,
  inspectionRecords,
  anomalyTickets,
  anomalyTraces,
  thresholds,
  todayPlans,
}: RoleDashboardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [displayedRole, setDisplayedRole] = useState<RoleType>(activeRole);
  const greeting = getGreeting();

  const roleColor = roleColors[activeRole];

  const handleRoleChange = (role: RoleType) => {
    if (role !== activeRole) {
      setIsLoading(true);
      setDisplayedRole(role);
      setTimeout(() => {
        onRoleChange(role);
        setIsLoading(false);
      }, 200);
    }
  };

  const handleAction = (action: string) => {
    if (onQuickAction) {
      onQuickAction(action);
    }
  };

  const inspectorOptions = useMemo(() => {
    return Array.from(
      new Set(
        todayPlans
          .filter((p) => p.role === "巡检员" && p.inspector.trim())
          .map((p) => p.inspector)
      )
    );
  }, [todayPlans]);

  const currentInspector =
    inspectorOptions.includes(activeInspector)
      ? activeInspector
      : inspectorOptions[0] ?? activeInspector;

  const metrics = useMemo((): { label: string; value: string; status: "ok" | "warn" | "danger" }[] => {
    switch (activeRole) {
      case "巡检员": {
        const myTodayPlans = todayPlans.filter(
          (p) => p.role === "巡检员" && p.inspector === currentInspector
        );
        const pendingPlans = myTodayPlans.filter((p) => p.status !== "已完成");
        const completedPlans = myTodayPlans.filter((p) => p.status === "已完成");
        const todayRecords = inspectionRecords.filter((r) =>
          r.createdAt.startsWith(new Date().toISOString().slice(0, 10))
        );
        const anomalyRecords = todayRecords.filter((r) => r.status === "异常");
        const pendingStatus: "ok" | "warn" = pendingPlans.length > 3 ? "warn" : "ok";
        const anomalyStatus: "ok" | "danger" = anomalyRecords.length > 0 ? "danger" : "ok";
        return [
          { label: "待巡检计划", value: String(pendingPlans.length), status: pendingStatus },
          { label: "今日已完成", value: String(completedPlans.length), status: "ok" },
          { label: "今日巡检记录", value: String(todayRecords.length), status: "ok" },
          { label: "异常记录", value: String(anomalyRecords.length), status: anomalyStatus },
        ];
      }
      case "厂务工程师": {
        const pendingTickets = anomalyTickets.filter((t) => t.status === "待处理");
        const processingTickets = anomalyTickets.filter((t) => t.status === "处理中");
        const faultDevices = inspectionRecords.filter((r) => r.deviceStatus === "故障");
        const runningDevices = inspectionRecords.filter((r) => r.deviceStatus === "运行中");
        const faultStatus: "ok" | "danger" = faultDevices.length > 0 ? "danger" : "ok";
        const pendingStatus: "ok" | "warn" = pendingTickets.length > 3 ? "warn" : "ok";
        return [
          { label: "运行设备", value: String(runningDevices.length), status: "ok" },
          { label: "故障设备", value: String(faultDevices.length), status: faultStatus },
          { label: "待处理异常", value: String(pendingTickets.length), status: pendingStatus },
          { label: "处理中", value: String(processingTickets.length), status: "ok" },
        ];
      }
      case "班组长": {
        const totalPlans = inspectionPlans.length;
        const completedPlans = inspectionPlans.filter((p) => p.status === "已完成").length;
        const openTickets = anomalyTickets.filter((t) => t.status !== "已关闭").length;
        const activeTraces = anomalyTraces.filter((t) => t.status !== "已恢复").length;
        const openTicketStatus: "ok" | "warn" | "danger" =
          openTickets > 5 ? "danger" : openTickets > 2 ? "warn" : "ok";
        const traceStatus: "ok" | "warn" = activeTraces > 3 ? "warn" : "ok";
        return [
          { label: "巡检计划总数", value: String(totalPlans), status: "ok" },
          { label: "已完成计划", value: String(completedPlans), status: "ok" },
          { label: "未关闭工单", value: String(openTickets), status: openTicketStatus },
          { label: "活跃追踪", value: String(activeTraces), status: traceStatus },
        ];
      }
      default:
        return [];
    }
  }, [activeRole, todayPlans, inspectionRecords, anomalyTickets, inspectionPlans, anomalyTraces, currentInspector]);

  const quickActions = useMemo(() => {
    switch (activeRole) {
      case "巡检员":
        return [
          { label: "录入巡检记录", icon: "📝", action: "createRecord" },
          { label: "查看巡检计划", icon: "📋", action: "viewSchedule" },
          { label: "扫描房间二维码", icon: "📱", action: "scanQR" },
        ];
      case "厂务工程师":
        return [
          { label: "创建设备工单", icon: "🔧", action: "createDeviceTicket" },
          { label: "阈值配置", icon: "⚙️", action: "configureThreshold" },
          { label: "查看设备列表", icon: "🖥️", action: "viewDevices" },
        ];
      case "班组长":
        return [
          { label: "分配巡检任务", icon: "📋", action: "assignTask" },
          { label: "查看排班表", icon: "📅", action: "viewSchedule" },
          { label: "导出日报表", icon: "📊", action: "exportReport" },
        ];
      default:
        return [];
    }
  }, [activeRole]);

  const renderRoleContent = () => {
    switch (activeRole) {
      case "巡检员":
        return (
          <InspectorView
            plans={todayPlans}
            records={inspectionRecords}
            tickets={anomalyTickets}
            roleColor={roleColor}
            onAction={handleAction}
            inspector={currentInspector}
          />
        );
      case "厂务工程师":
        return (
          <EngineerView
            tickets={anomalyTickets}
            records={inspectionRecords}
            roleColor={roleColor}
            onAction={handleAction}
          />
        );
      case "班组长":
        return (
          <SupervisorView
            plans={inspectionPlans}
            tickets={anomalyTickets}
            records={inspectionRecords}
            traces={anomalyTraces}
            thresholds={thresholds}
            roleColor={roleColor}
            onAction={handleAction}
          />
        );
      default:
        return null;
    }
  };

  return (
    <section className="role-dashboard panel">
      <div className="role-header">
        <div className="role-header-left">
          <p className="role-eyebrow" style={{ color: roleColor }}>
            角色工作台
          </p>
          <h1 className="role-title">
            {greeting}，{activeRole}
          </h1>
          <p className="role-subtitle">
            根据您的角色，以下是今日需要关注的重点内容
          </p>
          {activeRole === "巡检员" && inspectorOptions.length > 0 && (
            <label className="role-person-select">
              <span>当前巡检员</span>
              <select
                value={currentInspector}
                onChange={(event) => onInspectorChange(event.target.value)}
              >
                {inspectorOptions.map((inspector) => (
                  <option key={inspector} value={inspector}>
                    {inspector}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="role-switcher">
          {roles.map((role) => (
            <button
              key={role}
              className={`role-switch-btn ${
                activeRole === role ? "active" : ""
              }`}
              style={
                activeRole === role
                  ? {
                      background: roleColors[role],
                      borderColor: roleColors[role],
                      color: "#fff",
                    }
                  : {}
              }
              onClick={() => handleRoleChange(role)}
              disabled={isLoading}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="role-skeleton">
          <div className="role-skeleton-metrics">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="role-skeleton-card" />
            ))}
          </div>
          <div className="role-skeleton-actions">
            {[1, 2, 3].map((i) => (
              <div key={i} className="role-skeleton-action" />
            ))}
          </div>
          <div className="role-skeleton-content">
            <div className="role-skeleton-panel">
              <div className="role-skeleton-heading" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="role-skeleton-item" />
              ))}
            </div>
            <div className="role-skeleton-panel">
              <div className="role-skeleton-heading" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="role-skeleton-item" />
              ))}
            </div>
          </div>
        </div>
      )}

      {!isLoading && (
        <>
          <div className="role-metrics-grid role-content-fade">
            {metrics.map((metric, index) => (
              <RoleMetricCard
                key={`${activeRole}-metric-${index}`}
                label={metric.label}
                value={metric.value}
                status={metric.status}
                roleColor={roleColor}
              />
            ))}
          </div>

          <div className="role-actions role-content-fade">
            {quickActions.map((action, index) => (
              <QuickActionButton
                key={`${activeRole}-action-${index}`}
                label={action.label}
                icon={action.icon}
                action={action.action}
                roleColor={roleColor}
                onClick={handleAction}
              />
            ))}
          </div>

          <div className="role-content-fade">{renderRoleContent()}</div>
        </>
      )}
    </section>
  );
}
