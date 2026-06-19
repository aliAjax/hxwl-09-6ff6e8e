import type {
  AnomalyTicket,
  AreaThreshold,
  CleanArea,
  InspectionRecord,
  TrendAnomalyType,
} from "../domain/models";
import { checkAnomalies } from "../domain/rules";
import { TREND_ANOMALY_TYPES } from "../domain/constants";

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
  hasData: boolean;
}

function getDateKey(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split(" ")[0];
  return parts;
}

function formatDateLabel(dateKey: string): string {
  const parts = dateKey.split("-");
  if (parts.length >= 3) {
    return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
  }
  return dateKey;
}

function getRecentDateKeys(days: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    dates.push(dateStr);
  }
  return dates;
}

function computeSummary(values: number[]): TrendSummary {
  const current = values[values.length - 1] ?? 0;
  const previous = values[values.length - 2] ?? current;
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const avg = values.length > 0
    ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    : 0;

  let changePercent = 0;
  if (previous > 0) {
    changePercent = Math.round(((current - previous) / previous) * 100);
  } else if (current > 0) {
    changePercent = 100;
  }

  let trend: "up" | "down" | "stable";
  if (Math.abs(changePercent) < 5 || (current === 0 && previous === 0)) {
    trend = "stable";
  } else if (changePercent > 0) {
    trend = "up";
  } else {
    trend = "down";
  }

  return { current, previous, changePercent, trend, max, min, avg };
}

function filterRecordsByArea(
  records: InspectionRecord[],
  area: CleanArea | "全部"
): InspectionRecord[] {
  if (area === "全部") return records;
  return records.filter((r) => r.area === area);
}

function filterTicketsByArea(
  tickets: AnomalyTicket[],
  area: CleanArea | "全部"
): AnomalyTicket[] {
  if (area === "全部") return tickets;
  return tickets.filter((t) => t.area === area);
}

function countAnomaliesByDate(
  records: InspectionRecord[],
  thresholds: AreaThreshold[],
  type: Exclude<TrendAnomalyType, "待处理数量">,
  days: number
): Record<string, number> {
  const dateKeys = getRecentDateKeys(days);
  const counts: Record<string, number> = {};
  dateKeys.forEach((d) => (counts[d] = 0));

  records.forEach((record) => {
    const dateKey = getDateKey(record.createdAt);
    if (!(dateKey in counts)) return;

    const anomalies = checkAnomalies(record, thresholds);
    let isAnomaly = false;
    switch (type) {
      case "粒子异常":
        isAnomaly = anomalies.particle;
        break;
      case "压差异常":
        isAnomaly = anomalies.pressure;
        break;
      case "温湿度偏移":
        isAnomaly = anomalies.temp || anomalies.humidity;
        break;
    }
    if (isAnomaly) {
      counts[dateKey]++;
    }
  });

  return counts;
}

function countPendingTicketsByDate(
  tickets: AnomalyTicket[],
  days: number
): Record<string, number> {
  const dateKeys = getRecentDateKeys(days);
  const counts: Record<string, number> = {};
  dateKeys.forEach((d) => (counts[d] = 0));

  tickets.forEach((ticket) => {
    if (ticket.status === "已关闭") return;
    const dateKey = getDateKey(ticket.createdAt);
    if (!(dateKey in counts)) return;
    counts[dateKey]++;
  });

  return counts;
}

export function calculateTrendData(
  records: InspectionRecord[],
  tickets: AnomalyTicket[],
  thresholds: AreaThreshold[],
  area: CleanArea | "全部",
  type: TrendAnomalyType,
  days: number = 7
): AnomalyTrendData {
  const dateKeys = getRecentDateKeys(days);
  const filteredRecords = filterRecordsByArea(records, area);
  const filteredTickets = filterTicketsByArea(tickets, area);

  let countsByDate: Record<string, number>;

  if (type === "待处理数量") {
    countsByDate = countPendingTicketsByDate(filteredTickets, days);
  } else {
    countsByDate = countAnomaliesByDate(filteredRecords, thresholds, type, days);
  }

  const data: TrendDataPoint[] = dateKeys.map((dateKey) => ({
    date: formatDateLabel(dateKey),
    value: countsByDate[dateKey] ?? 0,
  }));

  const values = data.map((d) => d.value);
  const summary = computeSummary(values);
  const hasData = values.some((v) => v > 0);

  return { data, summary, hasData };
}

export function calculateAllTrendData(
  records: InspectionRecord[],
  tickets: AnomalyTicket[],
  thresholds: AreaThreshold[],
  area: CleanArea | "全部",
  days: number = 7
): Record<TrendAnomalyType, AnomalyTrendData> {
  const result = {} as Record<TrendAnomalyType, AnomalyTrendData>;
  TREND_ANOMALY_TYPES.forEach((type) => {
    result[type] = calculateTrendData(records, tickets, thresholds, area, type, days);
  });
  return result;
}

export const anomalyTypeColors: Record<TrendAnomalyType, string> = {
  "粒子异常": "#7c3aed",
  "压差异常": "#2563eb",
  "温湿度偏移": "#e11d48",
  "待处理数量": "#0f766e",
};

export const areaFilters: (CleanArea | "全部")[] = [
  "全部",
  "ISO 5",
  "ISO 6",
  "ISO 7",
  "黄光区",
];

export const trendAnomalyTypes: TrendAnomalyType[] = [
  "粒子异常",
  "压差异常",
  "温湿度偏移",
  "待处理数量",
];
