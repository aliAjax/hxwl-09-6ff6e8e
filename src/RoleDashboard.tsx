import { useState, useEffect, useCallback } from "react";
import {
  generateRoleDashboardData,
  roleColors,
  priorityColors,
  taskStatusColors,
  deviceStatusColors,
  type RoleType,
  type RoleDashboardData,
  type PendingRoom,
  type TodayTask,
  type DeviceStatus,
  type AnomalyHandle,
  type SummaryMetric,
  type OverdueItem,
} from "./mockData";

const roles: RoleType[] = ["巡检员", "厂务工程师", "班组长"];

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

function InspectorView({
  data,
  roleColor,
  onAction,
}: {
  data: RoleDashboardData;
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

  const statusBadgeClass = (status: string) => {
    const color = taskStatusColors[status as keyof typeof taskStatusColors];
    return {
      background: `${color}14`,
      color,
      borderColor: `${color}40`,
    };
  };

  return (
    <div className="role-content-grid">
      <section className="role-panel">
        <div className="role-section-heading">
          <div>
            <p className="role-section-eyebrow" style={{ color: roleColor }}>
              优先处理
            </p>
            <h2>待录入房间</h2>
          </div>
          <button
            className="role-action-btn primary"
            style={{ background: roleColor, borderColor: roleColor }}
            onClick={() => onAction("createRecord")}
          >
            快速录入
          </button>
        </div>
        <div className="role-list">
          {data.pendingRooms?.map((room: PendingRoom) => (
            <article key={room.id} className="role-list-card">
              <div
                className="role-list-index"
                style={{ background: roleColor }}
              >
                {room.roomId.slice(-2)}
              </div>
              <div className="role-list-body">
                <div className="role-list-header">
                  <h3>{room.roomId}</h3>
                  <span
                    className="role-badge"
                    style={priorityBadgeClass(room.priority)}
                  >
                    {room.priority}优先级
                  </span>
                </div>
                <div className="role-list-meta">
                  <span className="role-area-tag">{room.area}</span>
                  <span>上次巡检: {room.lastInspection}</span>
                </div>
                <div className="role-list-footer">
                  <span className="role-deadline">
                    截止: {room.deadline}
                  </span>
                  <button
                    className="role-list-action"
                    style={{ color: roleColor, borderColor: `${roleColor}40` }}
                    onClick={() => onAction("createRecord")}
                  >
                    立即录入
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="role-panel">
        <div className="role-section-heading">
          <div>
            <p className="role-section-eyebrow" style={{ color: roleColor }}>
              今日安排
            </p>
            <h2>今日任务</h2>
          </div>
          <span className="role-count-badge">
            {data.todayTasks?.filter((t) => t.status !== "已完成").length} 项待处理
          </span>
        </div>
        <div className="role-list">
          {data.todayTasks?.map((task: TodayTask) => (
            <article key={task.id} className="role-list-card">
              <div
                className="role-list-index"
                style={{
                  background:
                    task.status === "已完成"
                      ? "#16a34a"
                      : task.status === "已逾期"
                      ? "#e11d48"
                      : roleColor,
                }}
              >
                {task.type.slice(0, 2)}
              </div>
              <div className="role-list-body">
                <div className="role-list-header">
                  <h3>
                    {task.title} · {task.roomId}
                  </h3>
                  <span
                    className="role-badge"
                    style={statusBadgeClass(task.status)}
                  >
                    {task.status}
                  </span>
                </div>
                <div className="role-list-meta">
                  <span className="role-area-tag">{task.area}</span>
                  <span className="role-type-tag">{task.type}</span>
                </div>
                <div className="role-list-footer">
                  <span className="role-deadline">
                    截止: {task.deadline}
                  </span>
                  {task.status !== "已完成" && (
                    <button
                      className="role-list-action"
                      style={{ color: roleColor, borderColor: `${roleColor}40` }}
                      onClick={() => onAction("viewSchedule")}
                    >
                      查看详情
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function EngineerView({
  data,
  roleColor,
  onAction,
}: {
  data: RoleDashboardData;
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

  const statusBadgeClass = (status: string) => {
    const color = taskStatusColors[status as keyof typeof taskStatusColors];
    return {
      background: `${color}14`,
      color,
      borderColor: `${color}40`,
    };
  };

  const deviceStatusBadge = (status: string) => {
    const color = deviceStatusColors[status as keyof typeof deviceStatusColors];
    return {
      background: `${color}14`,
      color,
      borderColor: `${color}40`,
    };
  };

  const deviceDotColor = (status: string) => {
    return deviceStatusColors[status as keyof typeof deviceStatusColors];
  };

  return (
    <div className="role-content-grid">
      <section className="role-panel">
        <div className="role-section-heading">
          <div>
            <p className="role-section-eyebrow" style={{ color: roleColor }}>
              设备监控
            </p>
            <h2>设备状态</h2>
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
          {data.devices?.map((device: DeviceStatus) => (
            <article key={device.id} className="role-list-card">
              <div className="role-device-icon">
                <span
                  className="role-device-dot"
                  style={{ background: deviceDotColor(device.status) }}
                />
              </div>
              <div className="role-list-body">
                <div className="role-list-header">
                  <h3>{device.name}</h3>
                  <span
                    className="role-badge"
                    style={deviceStatusBadge(device.status)}
                  >
                    {device.status}
                  </span>
                </div>
                <div className="role-list-meta">
                  <span className="role-area-tag">{device.area}</span>
                  <span>{device.roomId}</span>
                </div>
                <div className="role-list-footer">
                  <span className="role-deadline">
                    上次检查: {device.lastCheck}
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
          ))}
        </div>
      </section>

      <section className="role-panel">
        <div className="role-section-heading">
          <div>
            <p className="role-section-eyebrow" style={{ color: roleColor }}>
              异常处理
            </p>
            <h2>待处理工单</h2>
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
          {data.anomalyHandles?.map((handle: AnomalyHandle) => (
            <article key={handle.id} className="role-list-card">
              <div
                className="role-list-index"
                style={{
                  background:
                    handle.status === "已逾期"
                      ? "#e11d48"
                      : handle.status === "待处理"
                      ? "#d97706"
                      : roleColor,
                }}
              >
                #{handle.ticketId}
              </div>
              <div className="role-list-body">
                <div className="role-list-header">
                  <h3>
                    {handle.anomalyType} · {handle.roomId}
                  </h3>
                  <span
                    className="role-badge"
                    style={statusBadgeClass(handle.status)}
                  >
                    {handle.status}
                  </span>
                </div>
                <div className="role-list-meta">
                  <span className="role-area-tag">{handle.area}</span>
                  <span>负责人: {handle.assignee}</span>
                  <span
                    className="role-badge"
                    style={priorityBadgeClass(handle.priority)}
                  >
                    {handle.priority}
                  </span>
                </div>
                <div className="role-list-footer">
                  <span className="role-deadline">
                    创建时间: {handle.createdAt}
                  </span>
                  {handle.status !== "已完成" && (
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
          ))}
        </div>
      </section>
    </div>
  );
}

function SupervisorView({
  data,
  roleColor,
  onAction,
}: {
  data: RoleDashboardData;
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
              团队概览
            </p>
            <h2>汇总指标</h2>
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
          {data.summaryMetrics?.map((metric: SummaryMetric, index: number) => (
            <article key={index} className="role-summary-card">
              <div className="role-summary-header">
                <span className="role-summary-label">{metric.label}</span>
                <span
                  className={`role-trend ${metric.trend}`}
                  style={{ color: metric.color }}
                >
                  {metric.trend === "up"
                    ? "↑"
                    : metric.trend === "down"
                    ? "↓"
                    : "→"}
                  {Math.abs(metric.changePercent)}%
                </span>
              </div>
              <div className="role-summary-value" style={{ color: metric.color }}>
                {metric.value}
                <span className="role-summary-unit">{metric.unit}</span>
              </div>
              <div className="role-progress-bar">
                <div
                  className="role-progress-fill"
                  style={{
                    width: `${Math.min(metric.value, 100)}%`,
                    background: metric.color,
                  }}
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="role-panel">
        <div className="role-section-heading">
          <div>
            <p className="role-section-eyebrow" style={{ color: "#e11d48" }}>
              需要关注
            </p>
            <h2>逾期项</h2>
          </div>
          <span className="role-count-badge danger">
            {data.overdueItems?.length} 项已逾期
          </span>
        </div>
        <div className="role-list">
          {data.overdueItems?.map((item: OverdueItem) => (
            <article key={item.id} className="role-list-card">
              <div
                className="role-list-index"
                style={{ background: typeColor[item.type] }}
              >
                {typeLabel[item.type].slice(0, 2)}
              </div>
              <div className="role-list-body">
                <div className="role-list-header">
                  <h3>
                    {item.title} · {item.roomId}
                  </h3>
                  <span className="role-overdue-badge">
                    逾期 {item.overdueDays} 天
                  </span>
                </div>
                <div className="role-list-meta">
                  <span className="role-area-tag">{item.area}</span>
                  <span
                    className="role-badge"
                    style={{
                      background: `${typeColor[item.type]}14`,
                      color: typeColor[item.type],
                      borderColor: `${typeColor[item.type]}40`,
                    }}
                  >
                    {typeLabel[item.type]}
                  </span>
                  <span>负责人: {item.assignee}</span>
                  <span
                    className="role-badge"
                    style={priorityBadgeClass(item.priority)}
                  >
                    {item.priority}
                  </span>
                </div>
                <div className="role-list-footer">
                  <span className="role-deadline">
                    需立即跟进处理
                  </span>
                  <button
                    className="role-list-action"
                    style={{ color: roleColor, borderColor: `${roleColor}40` }}
                    onClick={() => onAction("assignTask")}
                  >
                    重新分配
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

interface RoleDashboardProps {
  onQuickAction?: (action: string) => void;
}

export default function RoleDashboard({ onQuickAction }: RoleDashboardProps) {
  const [activeRole, setActiveRole] = useState<RoleType>("巡检员");
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<RoleDashboardData | null>(
    null
  );
  const [displayedRole, setDisplayedRole] = useState<RoleType>("巡检员");

  const loadRoleData = useCallback((role: RoleType) => {
    setIsLoading(true);
    setDashboardData(null);
    setDisplayedRole(role);

    setTimeout(() => {
      const data = generateRoleDashboardData(role);
      setDashboardData(data);
      setIsLoading(false);
    }, 300);
  }, []);

  useEffect(() => {
    loadRoleData(activeRole);
  }, [activeRole, loadRoleData]);

  const handleRoleChange = (role: RoleType) => {
    if (role !== activeRole) {
      setActiveRole(role);
    }
  };

  const handleAction = (action: string) => {
    if (onQuickAction) {
      onQuickAction(action);
    }
  };

  const displayRoleColor = roleColors[displayedRole];

  const renderRoleContent = () => {
    if (!dashboardData) return null;

    switch (displayedRole) {
      case "巡检员":
        return (
          <InspectorView
            data={dashboardData}
            roleColor={displayRoleColor}
            onAction={handleAction}
          />
        );
      case "厂务工程师":
        return (
          <EngineerView
            data={dashboardData}
            roleColor={displayRoleColor}
            onAction={handleAction}
          />
        );
      case "班组长":
        return (
          <SupervisorView
            data={dashboardData}
            roleColor={displayRoleColor}
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
          <p className="role-eyebrow" style={{ color: roleColors[activeRole] }}>
            角色工作台
          </p>
          <h1 className="role-title">
            {dashboardData ? dashboardData.greeting : "加载中"}，{activeRole}
          </h1>
          <p className="role-subtitle">
            根据您的角色，以下是今日需要关注的重点内容
          </p>
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

      {!isLoading && dashboardData && (
        <>
          <div className="role-metrics-grid role-content-fade">
            {dashboardData.metrics.map((metric, index) => (
              <RoleMetricCard
                key={`${displayedRole}-metric-${index}`}
                label={metric.label}
                value={metric.value}
                status={metric.status}
                roleColor={displayRoleColor}
              />
            ))}
          </div>

          <div className="role-actions role-content-fade">
            {dashboardData.quickActions.map((action, index) => (
              <QuickActionButton
                key={`${displayedRole}-action-${index}`}
                label={action.label}
                icon={action.icon}
                action={action.action}
                roleColor={displayRoleColor}
                onClick={handleAction}
              />
            ))}
          </div>

          <div className="role-content-fade">
            {renderRoleContent()}
          </div>
        </>
      )}
    </section>
  );
}
