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
  AnomalyTrace,
  RootCauseCategory,
  TraceStatus,
  ProcessingActionType,
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

export const DEFAULT_THRESHOLDS: AreaThreshold[] = [
  {
    area: "ISO 5",
    particle05um: 3520,
    particle5um: 29,
    pressure: { min: 12, max: 20 },
    temperature: { min: 20, max: 24 },
    humidity: { min: 40, max: 50 },
    version: 1,
    updatedAt: "2026-06-01 00:00",
  },
  {
    area: "ISO 6",
    particle05um: 35200,
    particle5um: 293,
    pressure: { min: 10, max: 18 },
    temperature: { min: 20, max: 25 },
    humidity: { min: 35, max: 55 },
    version: 1,
    updatedAt: "2026-06-01 00:00",
  },
  {
    area: "ISO 7",
    particle05um: 352000,
    particle5um: 2930,
    pressure: { min: 8, max: 15 },
    temperature: { min: 18, max: 26 },
    humidity: { min: 30, max: 60 },
    version: 1,
    updatedAt: "2026-06-01 00:00",
  },
  {
    area: "黄光区",
    particle05um: 35200,
    particle5um: 293,
    pressure: { min: 10, max: 18 },
    temperature: { min: 21, max: 25 },
    humidity: { min: 40, max: 55 },
    version: 1,
    updatedAt: "2026-06-01 00:00",
  },
];

export const DEFAULT_PLANS: InspectionPlan[] = [
  { id: 1, date: "2026-06-19", area: "ISO 5", role: "巡检员", inspector: "张伟", status: "进行中", linkedRecordIds: [], synced: true, version: 1, updatedAt: "2026-06-19 08:00" },
  { id: 2, date: "2026-06-19", area: "ISO 6", role: "厂务工程师", inspector: "李娜", status: "未开始", linkedRecordIds: [], synced: true, version: 1, updatedAt: "2026-06-19 08:00" },
  { id: 3, date: "2026-06-19", area: "黄光区", role: "班组长", inspector: "王强", status: "已完成", linkedRecordIds: [1], synced: true, version: 1, updatedAt: "2026-06-19 08:00" },
  { id: 4, date: "2026-06-19", area: "ISO 7", role: "巡检员", inspector: "赵敏", status: "未开始", linkedRecordIds: [], synced: true, version: 1, updatedAt: "2026-06-19 08:00" },
  { id: 5, date: "2026-06-19", area: "ISO 5", role: "厂务工程师", inspector: "陈磊", status: "已完成", linkedRecordIds: [2], synced: true, version: 1, updatedAt: "2026-06-19 08:00" },
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
    processNotes: [],
    synced: true,
    version: 1,
    updatedAt: "2026-06-18 09:30",
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
    processNotes: [
      {
        note: "已安排工程师排查压差调节阀，预计今日完成",
        timestamp: "2026-06-18 11:00",
        fromStatus: "待处理",
        toStatus: "处理中",
      },
    ],
    synced: true,
    version: 2,
    updatedAt: "2026-06-18 11:00",
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
    processNotes: [
      {
        note: "空调系统检修完成，温湿度恢复至正常范围",
        timestamp: "2026-06-18 09:00",
        fromStatus: "处理中",
        toStatus: "已关闭",
      },
    ],
    synced: true,
    version: 2,
    updatedAt: "2026-06-18 09:00",
  },
];

export const DEFAULT_FILTERS: FilterConditions = {
  planStatusFilter: "全部",
  ticketStatusFilter: "全部",
  trendAreaFilter: "全部",
  trendTypeFilter: "粒子异常",
  activeRole: "巡检员",
  activeInspector: "张伟",
};

export const ROOT_CAUSE_CATEGORIES: RootCauseCategory[] = [
  "过滤器堵塞",
  "空调系统故障",
  "人员操作不当",
  "设备维护缺失",
  "阀门故障",
  "密封性问题",
  "物料带入污染",
  "未知原因",
];

export const TRACE_STATUSES: TraceStatus[] = [
  "异常发生",
  "调查中",
  "处理中",
  "待验证",
  "已恢复",
  "复发",
  "需关注",
];

export const PROCESSING_ACTIONS: ProcessingActionType[] = [
  "启动调查",
  "更换过滤器",
  "检修空调",
  "校准压差阀",
  "清洁消毒",
  "排查设备",
  "调整参数",
  "其他操作",
];

export const TRACE_STATUS_TAG_CLASS: Record<TraceStatus, string> = {
  "异常发生": "trace-status-occurred",
  "调查中": "trace-status-investigating",
  "处理中": "trace-status-processing",
  "待验证": "trace-status-verifying",
  "已恢复": "trace-status-recovered",
  "复发": "trace-status-relapse",
  "需关注": "trace-status-watch",
};

export const DB_NAME = "hxwl09_cleanroom_db";
export const DB_VERSION = 7;
export const APP_VERSION = "1.2.0";

export const DB_STORE_NAMES: Record<keyof import("./models").DBSchema, string> = {
  thresholds: "thresholds",
  inspectionRecords: "inspectionRecords",
  anomalyTickets: "anomalyTickets",
  inspectionPlans: "inspectionPlans",
  filters: "filters",
  anomalyTraces: "anomalyTraces",
  syncQueue: "syncQueue",
  syncConflicts: "syncConflicts",
  migrationLogs: "migrationLogs",
  migrationFailedRecords: "migrationFailedRecords",
};

export const MIGRATION_LOG_KEY = "db_migration_version";

export const DEFAULT_TRACES: AnomalyTrace[] = [
  {
    id: 1,
    roomId: "CR-1201",
    area: "ISO 5",
    anomalyType: "粒子异常",
    status: "处理中",
    rootCause: "过滤器堵塞",
    rootCauseDetail: "高效过滤器使用周期已超过18个月，压差增大导致过滤效率下降，粒子持续超标",
    confidence: 85,
    firstOccurredAt: "2026-06-17 14:30",
    lastOccurredAt: "2026-06-19 08:15",
    anomalyCount: 5,
    recoveryCount: 2,
    initialRecordId: 1,
    triggerTicketId: 1,
    linkedRecordIds: [1],
    linkedTicketIds: [1],
    processingSteps: [
      {
        id: 1,
        timestamp: "2026-06-17 14:45",
        operator: "张伟",
        action: "启动调查",
        description: "发现粒子计数持续超限，启动根因调查流程",
      },
      {
        id: 2,
        timestamp: "2026-06-18 09:20",
        operator: "李娜",
        action: "排查设备",
        description: "检查风机、管道和过滤器，发现高效过滤器压差异常偏高",
        beforeStatus: "运行中",
        afterStatus: "待更换",
      },
    ],
    closeCondition: {
      particleStable: false,
      pressureStable: true,
      tempHumidityStable: true,
      deviceNormal: false,
      consecutiveNormalRecords: 0,
      ticketsClosed: false,
    },
    canClose: false,
    synced: true,
    version: 3,
    updatedAt: "2026-06-19 08:15",
  },
  {
    id: 2,
    roomId: "CR-3305",
    area: "ISO 7",
    anomalyType: "压差异常",
    status: "复发",
    rootCause: "阀门故障",
    rootCauseDetail: "压差调节阀定位器漂移，已修复但PID参数需要重新整定",
    confidence: 72,
    firstOccurredAt: "2026-06-16 10:00",
    lastOccurredAt: "2026-06-19 07:30",
    anomalyCount: 7,
    recoveryCount: 3,
    initialRecordId: 4,
    triggerTicketId: 2,
    linkedRecordIds: [4],
    linkedTicketIds: [2, 3],
    processingSteps: [
      {
        id: 1,
        timestamp: "2026-06-16 10:15",
        operator: "李娜",
        action: "启动调查",
        description: "压差低于下限报警，启动调查",
      },
      {
        id: 2,
        timestamp: "2026-06-17 15:30",
        operator: "王强",
        action: "校准压差阀",
        description: "更换阀门定位器并重新标定",
        beforeStatus: "8Pa",
        afterStatus: "12Pa",
      },
    ],
    closeCondition: {
      particleStable: true,
      pressureStable: false,
      tempHumidityStable: false,
      deviceNormal: true,
      consecutiveNormalRecords: 1,
      ticketsClosed: false,
    },
    canClose: false,
    synced: true,
    version: 4,
    updatedAt: "2026-06-19 07:30",
  },
];
