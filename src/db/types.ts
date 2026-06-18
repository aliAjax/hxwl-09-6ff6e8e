type PlanStatus = "未开始" | "进行中" | "已完成";
type CleanArea = "ISO 5" | "ISO 6" | "ISO 7" | "黄光区";
type TicketStatus = "待处理" | "处理中" | "已关闭";
type TicketAnomalyType = "粒子异常" | "压差异常" | "温湿度偏移";
type DeviceStatus = "运行中" | "待机" | "故障";
type RecordStatus = "稳定" | "关注" | "异常";
type TrendAnomalyType = "粒子异常" | "压差异常" | "温湿度偏移" | "待处理数量";
type RoleType = "巡检员" | "厂务工程师" | "班组长";
type AnomalyType = "particle" | "pressure" | "temp" | "humidity" | "none";

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

interface InspectionRecord {
  id: number;
  roomId: string;
  area: CleanArea;
  particle05um: number;
  particle5um: number;
  pressure: number;
  temperature: number;
  humidity: number;
  deviceStatus: DeviceStatus;
  remark: string;
  createdAt: string;
  status: RecordStatus;
}

interface AnomalyTicket {
  id: number;
  roomId: string;
  area: CleanArea;
  anomalyType: TicketAnomalyType;
  assignee: string;
  status: TicketStatus;
  remark: string;
  createdAt: string;
  sourceRecordId?: number;
}

interface FilterConditions {
  planStatusFilter: "全部" | PlanStatus;
  ticketStatusFilter: "全部" | TicketStatus;
  trendAreaFilter: CleanArea | "全部";
  trendTypeFilter: TrendAnomalyType;
  activeRole: RoleType;
}

interface DBSchema {
  thresholds: AreaThreshold[];
  inspectionRecords: InspectionRecord[];
  anomalyTickets: AnomalyTicket[];
  filters: FilterConditions;
}

type DBStoreName = keyof DBSchema;

const DB_NAME = "hxwl09_cleanroom_db";
const DB_VERSION = 1;
const STORE_NAMES: Record<DBStoreName, string> = {
  thresholds: "thresholds",
  inspectionRecords: "inspectionRecords",
  anomalyTickets: "anomalyTickets",
  filters: "filters",
};

export type {
  PlanStatus,
  CleanArea,
  TicketStatus,
  TicketAnomalyType,
  DeviceStatus,
  RecordStatus,
  TrendAnomalyType,
  RoleType,
  AnomalyType,
  ThresholdRange,
  AreaThreshold,
  InspectionRecord,
  AnomalyTicket,
  FilterConditions,
  DBSchema,
  DBStoreName,
  InspectionPlan,
};

export { DB_NAME, DB_VERSION, STORE_NAMES };
