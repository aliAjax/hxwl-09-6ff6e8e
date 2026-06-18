import type {
  CleanArea,
  DeviceStatus,
  PlanStatus,
  RoleType,
  TicketAnomalyType,
  TicketStatus,
  TrendAnomalyType,
  AreaThreshold,
  InspectionPlan,
  AnomalyTicket,
  FilterConditions,
} from "./models";

export const CLEAN_AREAS: CleanArea[] = ["ISO 5", "ISO 6", "ISO 7", "黄光区"];
export const PLAN_ROLES: RoleType[] = ["巡检员", "厂务工程师", "班组长"];
export const DEVICE_STATUSES: DeviceStatus[] = ["运行中", "待机", "故障"];
export const PLAN_STATUSES: PlanStatus[] = ["未开始", "进行中", "已完成"];
export const TICKET_STATUSES: TicketStatus[] = ["待处理", "处理中", "已关闭"];
export const TICKET_ANOMALY_TYPES: TicketAnomalyType[] = [
  "粒子异常",
  "压差异常",
  "温湿度偏移",
];
export const TREND_ANOMALY_TYPES: TrendAnomalyType[] = [
  "粒子异常",
  "压差异常",
  "温湿度偏移",
  "待处理数量",
];
export const PLAN_STATUS_FILTERS: ("全部" | PlanStatus)[] = [
  "全部",
  "未开始",
  "进行中",
  "已完成",
];
export const TICKET_STATUS_FILTERS: ("全部" | TicketStatus)[] = [
  "全部",
  "待处理",
  "处理中",
  "已关闭",
];
export const TREND_AREA_FILTERS: (CleanArea | "全部")[] = [
  "全部",
  "ISO 5",
  "ISO 6",
  "ISO 7",
  "黄光区",
];
export const TICKET_ASSIGNEES: string[] = [
  "张伟",
  "李娜",
  "王强",
  "赵敏",
  "陈磊",
];

export const PLAN_STATUS_TAG_CLASS: Record<PlanStatus, string> = {
  "未开始": "plan-tag-pending",
  "进行中": "plan-tag-active",
  "已完成": "plan-tag-done",
};

export const TICKET_STATUS_TAG_CLASS: Record<TicketStatus, string> = {
  "待处理": "ticket-tag-pending",
  "处理中": "ticket-tag-active",
  "已关闭": "ticket-tag-closed",
};

export const TICKET_ANOMALY_TYPE_CLASS: Record<TicketAnomalyType, string> = {
  "粒子异常": "ticket-type-particle",
  "压差异常": "ticket-type-pressure",
  "温湿度偏移": "ticket-type-temphum",
};

export const RECORD_STATUS_CLASS: Record<"ok" | "watch" | "danger", string> = {
  ok: "record-status-ok",
  watch: "record-status-watch",
  danger: "record-status-danger",
};

export const DB_NAME = "hxwl09_cleanroom_db";
export const DB_VERSION = 2;

export const DB_STORE_NAMES: Record<keyof import("./models").DBSchema, string> = {
  thresholds: "thresholds",
  inspectionRecords: "inspectionRecords",
  anomalyTickets: "anomalyTickets",
  inspectionPlans: "inspectionPlans",
  filters: "filters",
};

export const DEFAULT_THRESHOLDS: AreaThreshold[] = [
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

export const DEFAULT_PLANS: InspectionPlan[] = [
  { id: 1, date: "2026-06-18", area: "ISO 5", role: "巡检员", inspector: "张伟", status: "进行中", synced: true },
  { id: 2, date: "2026-06-18", area: "ISO 6", role: "厂务工程师", inspector: "李娜", status: "未开始", synced: true },
  { id: 3, date: "2026-06-18", area: "黄光区", role: "班组长", inspector: "王强", status: "已完成", synced: true },
  { id: 4, date: "2026-06-18", area: "ISO 7", role: "巡检员", inspector: "赵敏", status: "未开始", synced: true },
  { id: 5, date: "2026-06-18", area: "ISO 5", role: "厂务工程师", inspector: "陈磊", status: "已完成", synced: true },
];

export const DEFAULT_TICKETS: AnomalyTicket[] = [
  {
    id: 1,
    roomId: "CR-1201",
    area: "ISO 5",
    anomalyType: "粒子异常",
    assignee: "张伟",
    status: "待处理",
    remark: "0.5μm和5.0μm粒子均超限",
    createdAt: "2026-06-18 09:30",
    sourceRecordId: 1,
    synced: true,
  },
  {
    id: 2,
    roomId: "CR-3305",
    area: "ISO 7",
    anomalyType: "压差异常",
    assignee: "李娜",
    status: "处理中",
    remark: "压差低于下限，正在排查阀门",
    createdAt: "2026-06-18 10:15",
    sourceRecordId: 4,
    synced: true,
  },
  {
    id: 3,
    roomId: "CR-3305",
    area: "ISO 7",
    anomalyType: "温湿度偏移",
    assignee: "王强",
    status: "已关闭",
    remark: "空调系统已修复，温湿度恢复正常",
    createdAt: "2026-06-17 14:20",
    sourceRecordId: 4,
    synced: true,
  },
];

export const DEFAULT_FILTERS: FilterConditions = {
  planStatusFilter: "全部",
  ticketStatusFilter: "全部",
  trendAreaFilter: "全部",
  trendTypeFilter: "粒子异常",
  activeRole: "巡检员",
};
