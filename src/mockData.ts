type CleanArea = "ISO 5" | "ISO 6" | "ISO 7" | "黄光区";
type TrendAnomalyType = "粒子异常" | "压差异常" | "温湿度偏移" | "待处理数量";
type RoleType = "巡检员" | "厂务工程师" | "班组长";
type DeviceStatusType = "运行中" | "待机" | "故障" | "维护中";
type TaskPriority = "高" | "中" | "低";
type TaskStatus = "待处理" | "进行中" | "已完成" | "已逾期";

export interface PendingRoom {
  id: number;
  roomId: string;
  area: CleanArea;
  lastInspection: string;
  deadline: string;
  priority: TaskPriority;
}

export interface TodayTask {
  id: number;
  title: string;
  roomId: string;
  area: CleanArea;
  type: string;
  deadline: string;
  status: TaskStatus;
  priority: TaskPriority;
}

export interface DeviceStatus {
  id: number;
  name: string;
  roomId: string;
  area: CleanArea;
  status: DeviceStatusType;
  lastCheck: string;
  anomalyCount: number;
}

export interface AnomalyHandle {
  id: number;
  ticketId: number;
  roomId: string;
  area: CleanArea;
  anomalyType: string;
  assignee: string;
  status: TaskStatus;
  createdAt: string;
  priority: TaskPriority;
}

export interface SummaryMetric {
  label: string;
  value: number;
  unit: string;
  trend: "up" | "down" | "stable";
  changePercent: number;
  color: string;
}

export interface OverdueItem {
  id: number;
  type: "plan" | "ticket" | "inspection";
  title: string;
  roomId: string;
  area: CleanArea;
  overdueDays: number;
  assignee: string;
  priority: TaskPriority;
}

export interface RoleDashboardData {
  role: RoleType;
  greeting: string;
  metrics: { label: string; value: string; status: "ok" | "warn" | "danger" }[];
  quickActions: { label: string; icon: string; action: string }[];
  pendingRooms?: PendingRoom[];
  todayTasks?: TodayTask[];
  devices?: DeviceStatus[];
  anomalyHandles?: AnomalyHandle[];
  summaryMetrics?: SummaryMetric[];
  overdueItems?: OverdueItem[];
}

export interface TrendDataPoint {
  date: string;
  value: number;
}

export interface TrendSummary {
  current: number;
  previous: number;
  changePercent: number;
  trend: "up" | "down" | "stable";
  max: number;
  min: number;
  avg: number;
}

export interface AnomalyTrendData {
  data: TrendDataPoint[];
  summary: TrendSummary;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function hashStringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function getDateRange(days: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(`${d.getMonth() + 1}/${d.getDate()}`);
  }
  return dates;
}

function getBaseValueForType(type: TrendAnomalyType): number {
  switch (type) {
    case "粒子异常": return 15;
    case "压差异常": return 8;
    case "温湿度偏移": return 10;
    case "待处理数量": return 12;
    default: return 10;
  }
}

function getVarianceForType(type: TrendAnomalyType): number {
  switch (type) {
    case "粒子异常": return 10;
    case "压差异常": return 6;
    case "温湿度偏移": return 7;
    case "待处理数量": return 8;
    default: return 7;
  }
}

function getAreaMultiplier(area: CleanArea | "全部"): number {
  switch (area) {
    case "ISO 5": return 0.6;
    case "ISO 6": return 1.0;
    case "ISO 7": return 1.4;
    case "黄光区": return 0.8;
    case "全部": return 1.0;
    default: return 1.0;
  }
}

export function generateAnomalyTrendData(
  area: CleanArea | "全部",
  type: TrendAnomalyType,
  days: number = 7
): AnomalyTrendData {
  const seedKey = `${area}-${type}-${days}`;
  const seed = hashStringToSeed(seedKey);
  const random = seededRandom(seed);

  const dates = getDateRange(days);
  const baseValue = getBaseValueForType(type);
  const variance = getVarianceForType(type);
  const areaMultiplier = getAreaMultiplier(area);

  const trendSeed = seededRandom(seed + 1000);
  const trendDirection = trendSeed() > 0.5 ? 1 : -1;
  const trendStrength = trendSeed() * 0.4;

  const data: TrendDataPoint[] = dates.map((date, index) => {
    const trendComponent = (index / (days - 1) - 0.5) * trendStrength * baseValue * 2;
    const randomComponent = (random() - 0.5) * variance;
    const waveComponent = Math.sin((index / days) * Math.PI * 2) * variance * 0.3;
    let value = Math.round(
      (baseValue + trendComponent + randomComponent + waveComponent) * areaMultiplier
    );
    value = Math.max(0, value);
    return { date, value };
  });

  const values = data.map(d => d.value);
  const current = values[values.length - 1];
  const previous = values[values.length - 2] ?? current;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

  let changePercent = 0;
  if (previous > 0) {
    changePercent = Math.round(((current - previous) / previous) * 100);
  }

  let trend: "up" | "down" | "stable";
  if (Math.abs(changePercent) < 5) {
    trend = "stable";
  } else if (changePercent > 0) {
    trend = "up";
  } else {
    trend = "down";
  }

  return {
    data,
    summary: {
      current,
      previous,
      changePercent,
      trend,
      max,
      min,
      avg,
    },
  };
}

export const anomalyTypes: TrendAnomalyType[] = [
  "粒子异常",
  "压差异常",
  "温湿度偏移",
  "待处理数量",
];

export const areaFilters: (CleanArea | "全部")[] = [
  "全部",
  "ISO 5",
  "ISO 6",
  "ISO 7",
  "黄光区",
];

export const anomalyTypeColors: Record<TrendAnomalyType, string> = {
  "粒子异常": "#7c3aed",
  "压差异常": "#2563eb",
  "温湿度偏移": "#e11d48",
  "待处理数量": "#0f766e",
};

const pendingRoomsData: PendingRoom[] = [
  { id: 1, roomId: "CR-1203", area: "ISO 5", lastInspection: "2026-06-16", deadline: "2026-06-18 14:00", priority: "高" },
  { id: 2, roomId: "CR-2105", area: "ISO 6", lastInspection: "2026-06-17", deadline: "2026-06-18 16:00", priority: "中" },
  { id: 3, roomId: "Y-0304", area: "黄光区", lastInspection: "2026-06-15", deadline: "2026-06-18 12:00", priority: "高" },
  { id: 4, roomId: "CR-3308", area: "ISO 7", lastInspection: "2026-06-17", deadline: "2026-06-19 10:00", priority: "低" },
  { id: 5, roomId: "CR-1106", area: "ISO 5", lastInspection: "2026-06-16", deadline: "2026-06-18 18:00", priority: "中" },
];

const todayTasksData: TodayTask[] = [
  { id: 1, title: "日常巡检", roomId: "CR-1201", area: "ISO 5", type: "粒子检测", deadline: "10:00", status: "已完成", priority: "高" },
  { id: 2, title: "设备状态核查", roomId: "CR-2107", area: "ISO 6", type: "设备检查", deadline: "14:00", status: "进行中", priority: "中" },
  { id: 3, title: "异常复核", roomId: "Y-0302", area: "黄光区", type: "温湿度", deadline: "11:30", status: "待处理", priority: "高" },
  { id: 4, title: "压差校准", roomId: "CR-3305", area: "ISO 7", type: "压差检测", deadline: "15:30", status: "待处理", priority: "中" },
  { id: 5, title: "周检计划", roomId: "CR-1108", area: "ISO 5", type: "全面检测", deadline: "17:00", status: "已逾期", priority: "高" },
];

const devicesData: DeviceStatus[] = [
  { id: 1, name: "FFU-A12", roomId: "CR-1201", area: "ISO 5", status: "运行中", lastCheck: "2026-06-18 08:30", anomalyCount: 0 },
  { id: 2, name: "空调机组-03", roomId: "CR-2107", area: "ISO 6", status: "运行中", lastCheck: "2026-06-18 07:00", anomalyCount: 1 },
  { id: 3, name: "粒子计数器-PC05", roomId: "Y-0302", area: "黄光区", status: "故障", lastCheck: "2026-06-17 16:00", anomalyCount: 3 },
  { id: 4, name: "压差传感器-DP12", roomId: "CR-3305", area: "ISO 7", status: "维护中", lastCheck: "2026-06-18 09:00", anomalyCount: 2 },
  { id: 5, name: "温湿度变送器-TH08", roomId: "CR-1108", area: "ISO 5", status: "待机", lastCheck: "2026-06-18 06:00", anomalyCount: 0 },
  { id: 6, name: "FFU-B07", roomId: "CR-1203", area: "ISO 5", status: "运行中", lastCheck: "2026-06-18 08:00", anomalyCount: 0 },
];

const anomalyHandlesData: AnomalyHandle[] = [
  { id: 1, ticketId: 1001, roomId: "CR-1201", area: "ISO 5", anomalyType: "粒子异常", assignee: "张伟", status: "待处理", createdAt: "2026-06-18 09:30", priority: "高" },
  { id: 2, ticketId: 1002, roomId: "CR-3305", area: "ISO 7", anomalyType: "压差异常", assignee: "李娜", status: "进行中", createdAt: "2026-06-18 10:15", priority: "高" },
  { id: 3, ticketId: 1003, roomId: "Y-0302", area: "黄光区", anomalyType: "温湿度偏移", assignee: "王强", status: "待处理", createdAt: "2026-06-18 08:45", priority: "中" },
  { id: 4, ticketId: 998, roomId: "CR-2105", area: "ISO 6", anomalyType: "粒子异常", assignee: "赵敏", status: "已逾期", createdAt: "2026-06-17 14:20", priority: "高" },
  { id: 5, ticketId: 1000, roomId: "CR-1106", area: "ISO 5", anomalyType: "设备故障", assignee: "陈磊", status: "进行中", createdAt: "2026-06-18 07:30", priority: "中" },
];

const summaryMetricsData: SummaryMetric[] = [
  { label: "今日巡检完成率", value: 78, unit: "%", trend: "up", changePercent: 12, color: "#0f766e" },
  { label: "异常工单处理率", value: 65, unit: "%", trend: "down", changePercent: -5, color: "#2563eb" },
  { label: "设备在线率", value: 92, unit: "%", trend: "stable", changePercent: 1, color: "#7c3aed" },
  { label: "逾期项数量", value: 3, unit: "项", trend: "down", changePercent: -25, color: "#e11d48" },
];

const overdueItemsData: OverdueItem[] = [
  { id: 1, type: "plan", title: "周检计划", roomId: "CR-1108", area: "ISO 5", overdueDays: 1, assignee: "张伟", priority: "高" },
  { id: 2, type: "ticket", title: "粒子异常处理", roomId: "CR-2105", area: "ISO 6", overdueDays: 2, assignee: "赵敏", priority: "高" },
  { id: 3, type: "inspection", title: "月度校准", roomId: "Y-0304", area: "黄光区", overdueDays: 3, assignee: "李娜", priority: "中" },
  { id: 4, type: "plan", title: "季度审核", roomId: "CR-3308", area: "ISO 7", overdueDays: 1, assignee: "王强", priority: "中" },
];

export function generateRoleDashboardData(role: RoleType): RoleDashboardData {
  const now = new Date();
  const hour = now.getHours();
  let greeting = "您好";
  if (hour < 12) greeting = "早上好";
  else if (hour < 18) greeting = "下午好";
  else greeting = "晚上好";

  const baseData: RoleDashboardData = {
    role,
    greeting,
    metrics: [],
    quickActions: [],
  };

  switch (role) {
    case "巡检员":
      return {
        ...baseData,
        metrics: [
          { label: "待录入房间", value: String(pendingRoomsData.length), status: "warn" },
          { label: "今日任务", value: String(todayTasksData.length), status: "ok" },
          { label: "已完成", value: String(todayTasksData.filter(t => t.status === "已完成").length), status: "ok" },
          { label: "已逾期", value: String(todayTasksData.filter(t => t.status === "已逾期").length), status: "danger" },
        ],
        quickActions: [
          { label: "录入巡检记录", icon: "📝", action: "createRecord" },
          { label: "查看今日排班", icon: "📋", action: "viewSchedule" },
          { label: "扫描房间二维码", icon: "📱", action: "scanQR" },
        ],
        pendingRooms: pendingRoomsData,
        todayTasks: todayTasksData,
      };

    case "厂务工程师":
      return {
        ...baseData,
        metrics: [
          { label: "运行中设备", value: String(devicesData.filter(d => d.status === "运行中").length), status: "ok" },
          { label: "故障设备", value: String(devicesData.filter(d => d.status === "故障").length), status: "danger" },
          { label: "待处理异常", value: String(anomalyHandlesData.filter(a => a.status === "待处理").length), status: "warn" },
          { label: "处理中", value: String(anomalyHandlesData.filter(a => a.status === "进行中").length), status: "ok" },
        ],
        quickActions: [
          { label: "创建设备工单", icon: "🔧", action: "createDeviceTicket" },
          { label: "阈值配置", icon: "⚙️", action: "configureThreshold" },
          { label: "查看设备列表", icon: "🖥️", action: "viewDevices" },
        ],
        devices: devicesData,
        anomalyHandles: anomalyHandlesData,
      };

    case "班组长":
      return {
        ...baseData,
        metrics: [
          { label: "巡检完成率", value: "78%", status: "ok" },
          { label: "异常处理率", value: "65%", status: "warn" },
          { label: "逾期项", value: String(overdueItemsData.length), status: "danger" },
          { label: "团队成员", value: "5人", status: "ok" },
        ],
        quickActions: [
          { label: "分配巡检任务", icon: "📋", action: "assignTask" },
          { label: "查看排班表", icon: "📅", action: "viewSchedule" },
          { label: "导出日报表", icon: "📊", action: "exportReport" },
        ],
        summaryMetrics: summaryMetricsData,
        overdueItems: overdueItemsData,
      };

    default:
      return baseData;
  }
}

export const roleColors: Record<RoleType, string> = {
  "巡检员": "#0f766e",
  "厂务工程师": "#2563eb",
  "班组长": "#7c3aed",
};

export const priorityColors: Record<TaskPriority, string> = {
  "高": "#e11d48",
  "中": "#d97706",
  "低": "#0f766e",
};

export const taskStatusColors: Record<TaskStatus, string> = {
  "待处理": "#d97706",
  "进行中": "#2563eb",
  "已完成": "#16a34a",
  "已逾期": "#e11d48",
};

export const deviceStatusColors: Record<DeviceStatusType, string> = {
  "运行中": "#16a34a",
  "待机": "#64748b",
  "故障": "#e11d48",
  "维护中": "#d97706",
};
