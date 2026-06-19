export type PlanStatus = "未开始" | "进行中" | "已完成";
export type CleanArea = "ISO 5" | "ISO 6" | "ISO 7" | "黄光区";
export type TicketStatus = "待处理" | "处理中" | "已关闭";
export type TicketAnomalyType = "粒子异常" | "压差异常" | "温湿度偏移";
export type DeviceStatus = "运行中" | "待机" | "故障";
export type RecordStatus = "稳定" | "关注" | "异常";
export type TrendAnomalyType = "粒子异常" | "压差异常" | "温湿度偏移" | "待处理数量";
export type RoleType = "巡检员" | "厂务工程师" | "班组长";
export type AnomalyType = "particle" | "pressure" | "temp" | "humidity" | "none";

export type RootCauseCategory =
  | "过滤器堵塞"
  | "空调系统故障"
  | "人员操作不当"
  | "设备维护缺失"
  | "阀门故障"
  | "密封性问题"
  | "物料带入污染"
  | "未知原因";

export type TraceStatus =
  | "异常发生"
  | "调查中"
  | "处理中"
  | "待验证"
  | "已恢复"
  | "复发"
  | "需关注";

export type ProcessingActionType =
  | "启动调查"
  | "更换过滤器"
  | "检修空调"
  | "校准压差阀"
  | "清洁消毒"
  | "排查设备"
  | "调整参数"
  | "其他操作";

export interface CloseCondition {
  particleStable: boolean;
  pressureStable: boolean;
  tempHumidityStable: boolean;
  deviceNormal: boolean;
  consecutiveNormalRecords: number;
  ticketsClosed: boolean;
}

export interface ProcessingStep {
  id: number;
  timestamp: string;
  operator: string;
  action: ProcessingActionType;
  description: string;
  beforeStatus?: string;
  afterStatus?: string;
}

export interface AnomalyTraceInput {
  roomId: string;
  area: CleanArea;
  anomalyType: TicketAnomalyType;
  initialRecordId?: number;
  triggerTicketId?: number;
}

export interface AnomalyTrace extends AnomalyTraceInput {
  id: number;
  status: TraceStatus;
  rootCause?: RootCauseCategory;
  rootCauseDetail?: string;
  confidence?: number;
  firstOccurredAt: string;
  lastOccurredAt: string;
  anomalyCount: number;
  recoveryCount: number;
  processingSteps: ProcessingStep[];
  closeCondition: CloseCondition;
  canClose: boolean;
  synced?: boolean;
  linkedRecordIds: number[];
  linkedTicketIds: number[];
}

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
  linkedRecordIds: number[];
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

export interface ProcessNote {
  note: string;
  timestamp: string;
  fromStatus: TicketStatus;
  toStatus: TicketStatus;
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
  processNotes: ProcessNote[];
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
  anomalyTraces: AnomalyTrace[];
}

export type DBStoreName = keyof DBSchema;
