import type {
  AnomalyCheckResult,
  AreaThreshold,
  CleanArea,
  InspectionRecord,
  InspectionRecordInput,
  RecordStatus,
  RecordStatusResult,
  TicketAnomalyType,
} from "./models";

export interface Readings {
  area: CleanArea;
  particle05um: number;
  particle5um: number;
  pressure: number;
  temperature: number;
  humidity: number;
}

export function checkAnomalies(
  readings: Readings,
  thresholds: AreaThreshold[]
): AnomalyCheckResult {
  const th = thresholds.find((t) => t.area === readings.area);
  if (!th) {
    return { particle: false, pressure: false, temp: false, humidity: false, none: true };
  }
  const particleBad =
    readings.particle05um > th.particle05um ||
    readings.particle5um > th.particle5um;
  const pressureBad =
    readings.pressure < th.pressure.min ||
    readings.pressure > th.pressure.max;
  const tempBad =
    readings.temperature < th.temperature.min ||
    readings.temperature > th.temperature.max;
  const humidityBad =
    readings.humidity < th.humidity.min ||
    readings.humidity > th.humidity.max;

  return {
    particle: particleBad,
    pressure: pressureBad,
    temp: tempBad,
    humidity: humidityBad,
    none: !particleBad && !pressureBad && !tempBad && !humidityBad,
  };
}

export function getRecordStatus(
  anomalies: AnomalyCheckResult
): RecordStatusResult {
  const count = (["particle", "pressure", "temp", "humidity"] as const).filter(
    (k) => anomalies[k]
  ).length;
  if (count === 0) return { label: "稳定", cls: "record-status-ok" };
  if (count === 1) return { label: "关注", cls: "record-status-watch" };
  return { label: "异常", cls: "record-status-danger" };
}

export function getAnomalyTypes(
  anomalies: AnomalyCheckResult
): TicketAnomalyType[] {
  const types: TicketAnomalyType[] = [];
  if (anomalies.particle) types.push("粒子异常");
  if (anomalies.pressure) types.push("压差异常");
  if (anomalies.temp || anomalies.humidity) types.push("温湿度偏移");
  return types;
}

export function buildTicketRemark(
  readings: Readings,
  anomalyType: TicketAnomalyType,
  thresholds: AreaThreshold[]
): string {
  const th = thresholds.find((t) => t.area === readings.area);
  if (!th) return "";
  switch (anomalyType) {
    case "粒子异常": {
      const p05 =
        readings.particle05um > th.particle05um
          ? `0.5μm(${readings.particle05um.toLocaleString()})`
          : "";
      const p5 =
        readings.particle5um > th.particle5um
          ? `5.0μm(${readings.particle5um.toLocaleString()})`
          : "";
      return `粒子计数超限：${[p05, p5].filter(Boolean).join("、")}`;
    }
    case "压差异常":
      return `压差${
        readings.pressure < th.pressure.min ? "低于下限" : "高于上限"}：${
        readings.pressure
      }Pa（范围${th.pressure.min}-${th.pressure.max}Pa）`;
    case "温湿度偏移": {
      const t =
        readings.temperature < th.temperature.min
          ? "温度偏低"
          : readings.temperature > th.temperature.max
          ? "温度偏高"
          : "";
      const h =
        readings.humidity < th.humidity.min
          ? "湿度偏低"
          : readings.humidity > th.humidity.max
          ? "湿度偏高"
          : "";
      return `温湿度偏移：${[t, h].filter(Boolean).join("、")}`;
    }
    default:
      return "";
  }
}

export function buildInspectionRecord(
  input: InspectionRecordInput,
  thresholds: AreaThreshold[]
): InspectionRecord {
  const anomalies = checkAnomalies(input, thresholds);
  const status = getRecordStatus(anomalies);
  return {
    ...input,
    id: Date.now(),
    createdAt: formatNow(),
    status: status.label,
    synced: false,
  };
}

export function validateInspectionInput(
  input: InspectionRecordInput,
  existingRoomIds: string[]
): Partial<Record<keyof InspectionRecordInput, string>> {
  const errors: Partial<Record<string, string>> = {};

  if (!input.roomId.trim()) {
    errors.roomId = "房间编号不能为空";
  } else if (existingRoomIds.includes(input.roomId.trim())) {
    errors.roomId = "该房间编号已存在巡检记录";
  }

  if (isNaN(input.particle05um) || input.particle05um < 0) {
    errors.particle05um = "请输入有效的非负数";
  }
  if (isNaN(input.particle5um) || input.particle5um < 0) {
    errors.particle5um = "请输入有效的非负数";
  }
  if (isNaN(input.pressure)) {
    errors.pressure = "请输入有效的数值";
  }
  if (isNaN(input.temperature)) {
    errors.temperature = "请输入有效的数值";
  }
  if (isNaN(input.humidity) || input.humidity < 0 || input.humidity > 100) {
    errors.humidity = "请输入0-100之间的有效数值";
  }

  return errors;
}

export function formatNow(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function nextTicketStatus(
  current: TicketAnomalyType extends never ? never : import("./models").TicketStatus
): import("./models").TicketStatus | null {
  if (current === "待处理") return "处理中";
  if (current === "处理中") return "已关闭";
  return null;
}

export function prevTicketStatus(
  current: import("./models").TicketStatus
): import("./models").TicketStatus | null {
  if (current === "处理中") return "待处理";
  if (current === "已关闭") return "处理中";
  return null;
}

export function escapeCsvField(value: string | number): string {
  const str = String(value ?? "");
  if (
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildExportCsv(
  records: InspectionRecord[],
  exportTime: string
): string {
  const headers = [
    "房间编号",
    "洁净等级",
    "异常状态",
    "0.5μm粒子",
    "5.0μm粒子",
    "压差(Pa)",
    "温度(°C)",
    "湿度(%)",
    "设备状态",
    "处理备注",
    "创建时间",
    "导出时间",
  ];

  const rows = records.map((r) => [
    r.roomId,
    r.area,
    r.status,
    r.particle05um.toLocaleString(),
    r.particle5um.toLocaleString(),
    String(r.pressure),
    String(r.temperature),
    String(r.humidity),
    r.deviceStatus,
    r.remark || "",
    r.createdAt,
    exportTime,
  ]);

  const csvLines = [
    headers.map(escapeCsvField).join(","),
    ...rows.map((row) => row.map(escapeCsvField).join(",")),
  ];

  return csvLines.join("\r\n");
}

export function generateFileName(prefix: string, areaFilter: string): string {
  const now = new Date();
  return `${prefix}_${areaFilter}_${now.getFullYear()}${String(
    now.getMonth() + 1
  ).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(
    now.getHours()
  ).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}.csv`;
}
