import type {
  AreaThreshold,
  AnomalyTicket,
  FilterConditions,
  InspectionRecord,
} from "./types";

const defaultThresholds: AreaThreshold[] = [
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

const initialInspectionRecords: InspectionRecord[] = [];

const initialTickets: AnomalyTicket[] = [
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
  },
];

const defaultFilters: FilterConditions = {
  planStatusFilter: "全部",
  ticketStatusFilter: "全部",
  trendAreaFilter: "全部",
  trendTypeFilter: "粒子异常",
  activeRole: "巡检员",
};

export {
  defaultThresholds,
  initialInspectionRecords,
  initialTickets,
  defaultFilters,
};
