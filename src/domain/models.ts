export type PlanStatus = "未开始" | "进行中" | "已完成";
export type CleanArea = "ISO 5" | "ISO 6" | "ISO 7" | "黄光区";
export type TicketStatus = "待处理" | "处理中" | "已关闭";
export type TicketAnomalyType = "粒子异常" | "压差异常" | "温湿度偏移";
export type DeviceStatus = "运行中" | "待机" | "故障";
export type RecordStatus = "稳定" | "关注" | "异常";
export type TrendAnomalyType = "粒子异常" | "压差异常" | "温湿度偏移" | "待处理数量";
export type RoleType = "巡检员" | "厂务工程师" | "班组长";
export type AnomalyType = "particle" | "pressure" | "temp" | "humidity" | "none";

export interface ThresholdRange {
  min: number;
  max: number;
}

export interface AreaThreshold {
  area: CleanArea;
  particle05um: number;
  particle5um: number;
  pressure: ThresholdRange;
  temperature: ThresholdRange;
  humidity: ThresholdRange;
}

export interface InspectionPlan {
  id: number;
  date: string;
  area: CleanArea;
  role: string;
  inspector: string;
  status: PlanStatus;
  synced?: boolean;
}

export interface InspectionRecordInput {
  roomId: string;
  area: CleanArea;
  particle05um: number;
  particle5um: number;
  pressure: number;
  temperature: number;
  humidity: number;
  deviceStatus: DeviceStatus;
  remark: string;
}

export interface InspectionRecord extends InspectionRecordInput {
  id: number;
  createdAt: string;
  status: RecordStatus;
  planId?: number;
  synced?: boolean;
}

export interface AnomalyTicketInput {
  roomId: string;
  area: CleanArea;
  anomalyType: TicketAnomalyType;
  assignee: string;
  remark: string;
  sourceRecordId?: number;
}

export interface AnomalyTicket extends AnomalyTicketInput {
  id: number;
  status: TicketStatus;
  createdAt: string;
  synced?: boolean;
}

export interface FilterConditions {
  planStatusFilter: "全部" | PlanStatus;
  ticketStatusFilter: "全部" | TicketStatus;
  trendAreaFilter: CleanArea | "全部";
  trendTypeFilter: TrendAnomalyType;
  activeRole: RoleType;
}

export interface AnomalyCheckResult {
  particle: boolean;
  pressure: boolean;
  temp: boolean;
  humidity: boolean;
  none: boolean;
}

export interface RecordStatusResult {
  label: RecordStatus;
  cls: string;
}

export interface SyncStatus {
  pendingRecords: number;
  pendingTickets: number;
  pendingPlans: number;
  isOnline: boolean;
  lastSyncAt?: string;
}

export interface DBSchema {
  thresholds: AreaThreshold[];
  inspectionRecords: InspectionRecord[];
  anomalyTickets: AnomalyTicket[];
  inspectionPlans: InspectionPlan[];
  filters: FilterConditions;
}

export type DBStoreName = keyof DBSchema;
