import { describe, it, expect } from "vitest";
import {
  checkAnomalies,
  getRecordStatus,
  getAnomalyTypes,
  buildTicketRemark,
  validateInspectionInput,
  buildInspectionRecord,
  calculateThresholdImpact,
  formatNow,
  buildExportCsv,
  nextTicketStatus,
  prevTicketStatus,
  escapeCsvField,
} from "./rules";
import { DEFAULT_THRESHOLDS } from "./constants";
import type { CleanArea, InspectionRecord, InspectionRecordInput } from "./models";

function makeReadings(
  area: CleanArea,
  overrides: Partial<{
    particle05um: number;
    particle5um: number;
    pressure: number;
    temperature: number;
    humidity: number;
  }>
) {
  return {
    area,
    particle05um: overrides.particle05um ?? 100,
    particle5um: overrides.particle5um ?? 5,
    pressure: overrides.pressure ?? 15,
    temperature: overrides.temperature ?? 22,
    humidity: overrides.humidity ?? 45,
  };
}

describe("checkAnomalies", () => {
  it("全部指标正常时返回 none=true", () => {
    const r = makeReadings("ISO 5", {
      particle05um: 100,
      particle5um: 5,
      pressure: 15,
      temperature: 22,
      humidity: 45,
    });
    const result = checkAnomalies(r, DEFAULT_THRESHOLDS);
    expect(result.none).toBe(true);
    expect(result.particle).toBe(false);
    expect(result.pressure).toBe(false);
    expect(result.temp).toBe(false);
    expect(result.humidity).toBe(false);
  });

  it("particle05um 超限时 particle=true", () => {
    const r = makeReadings("ISO 5", { particle05um: 99999 });
    const result = checkAnomalies(r, DEFAULT_THRESHOLDS);
    expect(result.particle).toBe(true);
    expect(result.none).toBe(false);
  });

  it("particle5um 超限时 particle=true", () => {
    const r = makeReadings("ISO 5", { particle5um: 9999 });
    const result = checkAnomalies(r, DEFAULT_THRESHOLDS);
    expect(result.particle).toBe(true);
  });

  it("压差低于下限 pressure=true", () => {
    const r = makeReadings("ISO 5", { pressure: 5 });
    const result = checkAnomalies(r, DEFAULT_THRESHOLDS);
    expect(result.pressure).toBe(true);
  });

  it("压差高于上限 pressure=true", () => {
    const r = makeReadings("ISO 5", { pressure: 99 });
    const result = checkAnomalies(r, DEFAULT_THRESHOLDS);
    expect(result.pressure).toBe(true);
  });

  it("温度低于下限 temp=true", () => {
    const r = makeReadings("ISO 5", { temperature: 10 });
    const result = checkAnomalies(r, DEFAULT_THRESHOLDS);
    expect(result.temp).toBe(true);
  });

  it("温度高于上限 temp=true", () => {
    const r = makeReadings("ISO 5", { temperature: 99 });
    const result = checkAnomalies(r, DEFAULT_THRESHOLDS);
    expect(result.temp).toBe(true);
  });

  it("湿度低于下限 humidity=true", () => {
    const r = makeReadings("ISO 5", { humidity: 10 });
    const result = checkAnomalies(r, DEFAULT_THRESHOLDS);
    expect(result.humidity).toBe(true);
  });

  it("湿度高于上限 humidity=true", () => {
    const r = makeReadings("ISO 5", { humidity: 99 });
    const result = checkAnomalies(r, DEFAULT_THRESHOLDS);
    expect(result.humidity).toBe(true);
  });

  it("未配置阈值的区域返回全部 false、none=true", () => {
    const r = makeReadings("ISO 5", { particle05um: 99999 });
    const result = checkAnomalies(r, []);
    expect(result.none).toBe(true);
    expect(result.particle).toBe(false);
  });
});

describe("getRecordStatus", () => {
  it("0 项异常为稳定", () => {
    const s = getRecordStatus({ particle: false, pressure: false, temp: false, humidity: false, none: true });
    expect(s.label).toBe("稳定");
  });

  it("1 项异常为关注", () => {
    const s = getRecordStatus({ particle: true, pressure: false, temp: false, humidity: false, none: false });
    expect(s.label).toBe("关注");
  });

  it("2 项及以上异常为异常", () => {
    const s = getRecordStatus({ particle: true, pressure: true, temp: false, humidity: false, none: false });
    expect(s.label).toBe("异常");
  });
});

describe("getAnomalyTypes", () => {
  it("粒子异常返回粒子异常", () => {
    const types = getAnomalyTypes({ particle: true, pressure: false, temp: false, humidity: false, none: false });
    expect(types).toEqual(["粒子异常"]);
  });

  it("压差异常返回压差异常", () => {
    const types = getAnomalyTypes({ particle: false, pressure: true, temp: false, humidity: false, none: false });
    expect(types).toEqual(["压差异常"]);
  });

  it("温度异常返回温湿度偏移", () => {
    const types = getAnomalyTypes({ particle: false, pressure: false, temp: true, humidity: false, none: false });
    expect(types).toEqual(["温湿度偏移"]);
  });

  it("湿度异常返回温湿度偏移（不重复）", () => {
    const types = getAnomalyTypes({ particle: false, pressure: false, temp: false, humidity: true, none: false });
    expect(types).toEqual(["温湿度偏移"]);
  });

  it("温湿度同时异常只返回一个温湿度偏移", () => {
    const types = getAnomalyTypes({ particle: false, pressure: false, temp: true, humidity: true, none: false });
    expect(types).toEqual(["温湿度偏移"]);
  });
});

describe("buildTicketRemark", () => {
  it("粒子异常：仅 0.5μm 超限", () => {
    const r = makeReadings("ISO 5", { particle05um: 99999, particle5um: 5 });
    const remark = buildTicketRemark(r, "粒子异常", DEFAULT_THRESHOLDS);
    expect(remark).toContain("0.5μm");
    expect(remark).not.toContain("5.0μm");
  });

  it("粒子异常：0.5μm 和 5.0μm 同时超限", () => {
    const r = makeReadings("ISO 5", { particle05um: 99999, particle5um: 9999 });
    const remark = buildTicketRemark(r, "粒子异常", DEFAULT_THRESHOLDS);
    expect(remark).toContain("0.5μm");
    expect(remark).toContain("5.0μm");
  });

  it("压差异常：低于下限", () => {
    const r = makeReadings("ISO 5", { pressure: 5 });
    const remark = buildTicketRemark(r, "压差异常", DEFAULT_THRESHOLDS);
    expect(remark).toContain("低于下限");
  });

  it("压差异常：高于上限", () => {
    const r = makeReadings("ISO 5", { pressure: 99 });
    const remark = buildTicketRemark(r, "压差异常", DEFAULT_THRESHOLDS);
    expect(remark).toContain("高于上限");
  });

  it("温湿度偏移：温度偏高", () => {
    const r = makeReadings("ISO 5", { temperature: 99 });
    const remark = buildTicketRemark(r, "温湿度偏移", DEFAULT_THRESHOLDS);
    expect(remark).toContain("温度偏高");
  });

  it("温湿度偏移：湿度偏低", () => {
    const r = makeReadings("ISO 5", { humidity: 10 });
    const remark = buildTicketRemark(r, "温湿度偏移", DEFAULT_THRESHOLDS);
    expect(remark).toContain("湿度偏低");
  });
});

describe("validateInspectionInput", () => {
  const base: InspectionRecordInput = {
    roomId: "CR-001",
    area: "ISO 5",
    particle05um: 100,
    particle5um: 5,
    pressure: 15,
    temperature: 22,
    humidity: 45,
    deviceStatus: "运行中",
    remark: "",
  };

  it("合法输入无错误", () => {
    const errors = validateInspectionInput(base, []);
    expect(Object.keys(errors).length).toBe(0);
  });

  it("roomId 为空时报错", () => {
    const errors = validateInspectionInput({ ...base, roomId: "   " }, []);
    expect(errors.roomId).toBeDefined();
  });

  it("roomId 重复时报错", () => {
    const errors = validateInspectionInput(base, ["CR-001"]);
    expect(errors.roomId).toBeDefined();
  });

  it("particle05um 为负数时报错", () => {
    const errors = validateInspectionInput({ ...base, particle05um: -1 }, []);
    expect(errors.particle05um).toBeDefined();
  });

  it("particle5um 为负数时报错", () => {
    const errors = validateInspectionInput({ ...base, particle5um: -1 }, []);
    expect(errors.particle5um).toBeDefined();
  });

  it("humidity 超过 100 报错", () => {
    const errors = validateInspectionInput({ ...base, humidity: 101 }, []);
    expect(errors.humidity).toBeDefined();
  });

  it("humidity 为负数报错", () => {
    const errors = validateInspectionInput({ ...base, humidity: -1 }, []);
    expect(errors.humidity).toBeDefined();
  });
});

describe("buildInspectionRecord", () => {
  it("构建巡检记录包含 id、createdAt、synced=false", () => {
    const input: InspectionRecordInput = {
      roomId: "CR-001",
      area: "ISO 5",
      particle05um: 100,
      particle5um: 5,
      pressure: 15,
      temperature: 22,
      humidity: 45,
      deviceStatus: "运行中",
      remark: "",
    };
    const record = buildInspectionRecord(input, DEFAULT_THRESHOLDS);
    expect(record.id).toBeGreaterThan(0);
    expect(record.createdAt).toBeTruthy();
    expect(record.synced).toBe(false);
    expect(record.status).toBe("稳定");
  });

  it("异常数据状态为异常", () => {
    const input: InspectionRecordInput = {
      roomId: "CR-001",
      area: "ISO 5",
      particle05um: 99999,
      particle5um: 9999,
      pressure: 15,
      temperature: 22,
      humidity: 45,
      deviceStatus: "运行中",
      remark: "",
    };
    const record = buildInspectionRecord(input, DEFAULT_THRESHOLDS);
    expect(record.status).toBe("关注");
  });
});

describe("calculateThresholdImpact", () => {
  const makeRecord = (area: CleanArea, particle05um: number): InspectionRecord => ({
    id: 1,
    roomId: "CR-001",
    area,
    particle05um,
    particle5um: 5,
    pressure: 15,
    temperature: 22,
    humidity: 45,
    deviceStatus: "运行中",
    remark: "",
    createdAt: "2026-06-20 09:00",
    status: "稳定",
    synced: true,
  });

  it("阈值收紧：稳定→关注", () => {
    const records = [makeRecord("ISO 5", 3200)];
    const original = DEFAULT_THRESHOLDS;
    const tightened = DEFAULT_THRESHOLDS.map((t) =>
      t.area === "ISO 5" ? { ...t, particle05um: 3000 } : t
    );
    const impact = calculateThresholdImpact(original, tightened, records);
    expect(impact.totalAffected).toBe(1);
    expect(impact.stableToWatch.length).toBe(1);
  });

  it("阈值放宽：关注→稳定", () => {
    const records = [makeRecord("ISO 5", 3200)];
    const tightened = DEFAULT_THRESHOLDS.map((t) =>
      t.area === "ISO 5" ? { ...t, particle05um: 3000 } : t
    );
    const impact = calculateThresholdImpact(tightened, DEFAULT_THRESHOLDS, records);
    expect(impact.totalAffected).toBe(1);
    expect(impact.watchToStable.length).toBe(1);
  });

  it("阈值不变时 totalAffected=0", () => {
    const records = [makeRecord("ISO 5", 100)];
    const impact = calculateThresholdImpact(DEFAULT_THRESHOLDS, DEFAULT_THRESHOLDS, records);
    expect(impact.totalAffected).toBe(0);
  });
});

describe("formatNow", () => {
  it("返回 YYYY-MM-DD HH:mm 格式", () => {
    const result = formatNow();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });
});

describe("nextTicketStatus / prevTicketStatus", () => {
  it("待处理 → 处理中", () => {
    expect(nextTicketStatus("待处理")).toBe("处理中");
  });

  it("处理中 → 已关闭", () => {
    expect(nextTicketStatus("处理中")).toBe("已关闭");
  });

  it("已关闭无可下一步", () => {
    expect(nextTicketStatus("已关闭")).toBeNull();
  });

  it("处理中 → 待处理", () => {
    expect(prevTicketStatus("处理中")).toBe("待处理");
  });

  it("已关闭 → 处理中", () => {
    expect(prevTicketStatus("已关闭")).toBe("处理中");
  });

  it("待处理无可回退", () => {
    expect(prevTicketStatus("待处理")).toBeNull();
  });
});

describe("escapeCsvField", () => {
  it("普通字段原样返回", () => {
    expect(escapeCsvField("hello")).toBe("hello");
  });

  it("含逗号时加双引号", () => {
    expect(escapeCsvField("a,b")).toBe('"a,b"');
  });

  it("含双引号时转义并包裹", () => {
    expect(escapeCsvField('a"b')).toBe('"a""b"');
  });
});

describe("buildExportCsv", () => {
  it("空记录仅输出表头", () => {
    const csv = buildExportCsv([], "2026-06-20 10:00");
    const lines = csv.split("\r\n");
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain("房间编号");
    expect(lines[0]).toContain("导出时间");
  });

  it("多条记录输出对应行数", () => {
    const records: InspectionRecord[] = [
      {
        id: 1,
        roomId: "CR-001",
        area: "ISO 5",
        particle05um: 100,
        particle5um: 5,
        pressure: 15,
        temperature: 22,
        humidity: 45,
        deviceStatus: "运行中",
        remark: "",
        createdAt: "2026-06-20 09:00",
        status: "稳定",
        synced: true,
      },
      {
        id: 2,
        roomId: "CR-002",
        area: "ISO 6",
        particle05um: 200,
        particle5um: 10,
        pressure: 12,
        temperature: 23,
        humidity: 50,
        deviceStatus: "待机",
        remark: "备注,含逗号",
        createdAt: "2026-06-20 09:10",
        status: "关注",
        synced: true,
      },
    ];
    const csv = buildExportCsv(records, "2026-06-20 10:00");
    const lines = csv.split("\r\n");
    expect(lines.length).toBe(3);
    expect(lines[2]).toContain('"备注,含逗号"');
  });
});
