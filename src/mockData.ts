type CleanArea = "ISO 5" | "ISO 6" | "ISO 7" | "黄光区";
type TrendAnomalyType = "粒子异常" | "压差异常" | "温湿度偏移" | "待处理数量";

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
