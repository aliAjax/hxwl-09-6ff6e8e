import { describe, it, expect } from "vitest";
import {
  calculateTrendData,
  calculateAllTrendData,
} from "../services/TrendAnalysisService";
import type {
  AnomalyTicket,
  AreaThreshold,
  CleanArea,
  InspectionRecord,
} from "../domain/models";
import { DEFAULT_THRESHOLDS } from "../domain/constants";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function makeRecord(
  id: number,
  area: CleanArea,
  overrides: Partial<InspectionRecord> & {
    particle05um: number;
    particle5um: number;
    pressure: number;
    temperature: number;
    humidity: number;
  },
  daysOffset: number
): InspectionRecord {
  const dateStr = `${daysAgo(daysOffset)} 09:00`;
  return {
    id,
    roomId: `CR-${1000 + id}`,
    area,
    particle05um: overrides.particle05um,
    particle5um: overrides.particle5um,
    pressure: overrides.pressure,
    temperature: overrides.temperature,
    humidity: overrides.humidity,
    deviceStatus: "运行中",
    remark: "",
    createdAt: dateStr,
    status: "稳定",
    synced: true,
    ...overrides,
  };
}

function makeTicket(
  id: number,
  area: CleanArea,
  anomalyType: "粒子异常" | "压差异常" | "温湿度偏移",
  status: "待处理" | "处理中" | "已关闭",
  daysOffset: number
): AnomalyTicket {
  const dateStr = `${daysAgo(daysOffset)} 10:00`;
  return {
    id,
    roomId: `CR-${2000 + id}`,
    area,
    anomalyType,
    assignee: "张伟",
    remark: "",
    status,
    createdAt: dateStr,
    processNotes: [],
    synced: true,
  };
}

const thresholds: AreaThreshold[] = DEFAULT_THRESHOLDS;

describe("TrendAnalysisService", () => {
  describe("按洁净等级筛选", () => {
    const records: InspectionRecord[] = [
      makeRecord(1, "ISO 5", { particle05um: 4000, particle5um: 10, pressure: 15, temperature: 22, humidity: 45 }, 0),
      makeRecord(2, "ISO 6", { particle05um: 100, particle5um: 5, pressure: 12, temperature: 22, humidity: 45 }, 0),
      makeRecord(3, "ISO 5", { particle05um: 5000, particle5um: 40, pressure: 15, temperature: 22, humidity: 45 }, 1),
      makeRecord(4, "ISO 7", { particle05um: 1000, particle5um: 10, pressure: 12, temperature: 22, humidity: 45 }, 2),
    ];
    const tickets: AnomalyTicket[] = [];

    it("筛选ISO 5时只计入ISO 5区域的记录", () => {
      const result = calculateTrendData(records, tickets, thresholds, "ISO 5", "粒子异常", 7);
      const totalAnomalies = result.data.reduce((s, d) => s + d.value, 0);
      expect(totalAnomalies).toBe(2);
    });

    it("筛选ISO 6时只计入ISO 6区域的记录", () => {
      const result = calculateTrendData(records, tickets, thresholds, "ISO 6", "粒子异常", 7);
      const totalAnomalies = result.data.reduce((s, d) => s + d.value, 0);
      expect(totalAnomalies).toBe(0);
    });

    it('筛选"全部"时计入所有区域记录', () => {
      const result = calculateTrendData(records, tickets, thresholds, "全部", "粒子异常", 7);
      const totalAnomalies = result.data.reduce((s, d) => s + d.value, 0);
      expect(totalAnomalies).toBe(2);
    });

    it("工单也按区域筛选", () => {
      const areaTickets: AnomalyTicket[] = [
        makeTicket(10, "ISO 5", "粒子异常", "待处理", 0),
        makeTicket(11, "ISO 6", "压差异常", "待处理", 0),
      ];
      const result = calculateTrendData([], areaTickets, thresholds, "ISO 5", "待处理数量", 7);
      const totalPending = result.data.reduce((s, d) => s + d.value, 0);
      expect(totalPending).toBe(1);
    });
  });

  describe("粒子异常计数", () => {
    it("particle05um超限计为粒子异常", () => {
      const records: InspectionRecord[] = [
        makeRecord(1, "ISO 5", { particle05um: 4000, particle5um: 10, pressure: 15, temperature: 22, humidity: 45 }, 0),
      ];
      const result = calculateTrendData(records, [], thresholds, "ISO 5", "粒子异常", 7);
      expect(result.data[result.data.length - 1].value).toBe(1);
    });

    it("particle5um超限计为粒子异常", () => {
      const records: InspectionRecord[] = [
        makeRecord(1, "ISO 5", { particle05um: 100, particle5um: 50, pressure: 15, temperature: 22, humidity: 45 }, 0),
      ];
      const result = calculateTrendData(records, [], thresholds, "ISO 5", "粒子异常", 7);
      expect(result.data[result.data.length - 1].value).toBe(1);
    });

    it("粒子数均在阈值内不计异常", () => {
      const records: InspectionRecord[] = [
        makeRecord(1, "ISO 5", { particle05um: 100, particle5um: 10, pressure: 15, temperature: 22, humidity: 45 }, 0),
      ];
      const result = calculateTrendData(records, [], thresholds, "ISO 5", "粒子异常", 7);
      expect(result.data[result.data.length - 1].value).toBe(0);
    });

    it("同一天多条异常记录累加", () => {
      const records: InspectionRecord[] = [
        makeRecord(1, "ISO 5", { particle05um: 4000, particle5um: 10, pressure: 15, temperature: 22, humidity: 45 }, 0),
        makeRecord(2, "ISO 5", { particle05um: 5000, particle5um: 10, pressure: 15, temperature: 22, humidity: 45 }, 0),
      ];
      const result = calculateTrendData(records, [], thresholds, "ISO 5", "粒子异常", 7);
      expect(result.data[result.data.length - 1].value).toBe(2);
    });
  });

  describe("压差异常计数", () => {
    it("压差低于下限计为压差异常", () => {
      const records: InspectionRecord[] = [
        makeRecord(1, "ISO 5", { particle05um: 100, particle5um: 10, pressure: 8, temperature: 22, humidity: 45 }, 0),
      ];
      const result = calculateTrendData(records, [], thresholds, "ISO 5", "压差异常", 7);
      expect(result.data[result.data.length - 1].value).toBe(1);
    });

    it("压差高于上限计为压差异常", () => {
      const records: InspectionRecord[] = [
        makeRecord(1, "ISO 5", { particle05um: 100, particle5um: 10, pressure: 25, temperature: 22, humidity: 45 }, 0),
      ];
      const result = calculateTrendData(records, [], thresholds, "ISO 5", "压差异常", 7);
      expect(result.data[result.data.length - 1].value).toBe(1);
    });

    it("压差在正常范围不计异常", () => {
      const records: InspectionRecord[] = [
        makeRecord(1, "ISO 5", { particle05um: 100, particle5um: 10, pressure: 16, temperature: 22, humidity: 45 }, 0),
      ];
      const result = calculateTrendData(records, [], thresholds, "ISO 5", "压差异常", 7);
      expect(result.data[result.data.length - 1].value).toBe(0);
    });
  });

  describe("温湿度偏移计数", () => {
    it("温度低于下限计为温湿度偏移", () => {
      const records: InspectionRecord[] = [
        makeRecord(1, "ISO 5", { particle05um: 100, particle5um: 10, pressure: 15, temperature: 18, humidity: 45 }, 0),
      ];
      const result = calculateTrendData(records, [], thresholds, "ISO 5", "温湿度偏移", 7);
      expect(result.data[result.data.length - 1].value).toBe(1);
    });

    it("温度高于上限计为温湿度偏移", () => {
      const records: InspectionRecord[] = [
        makeRecord(1, "ISO 5", { particle05um: 100, particle5um: 10, pressure: 15, temperature: 26, humidity: 45 }, 0),
      ];
      const result = calculateTrendData(records, [], thresholds, "ISO 5", "温湿度偏移", 7);
      expect(result.data[result.data.length - 1].value).toBe(1);
    });

    it("湿度低于下限计为温湿度偏移", () => {
      const records: InspectionRecord[] = [
        makeRecord(1, "ISO 5", { particle05um: 100, particle5um: 10, pressure: 15, temperature: 22, humidity: 30 }, 0),
      ];
      const result = calculateTrendData(records, [], thresholds, "ISO 5", "温湿度偏移", 7);
      expect(result.data[result.data.length - 1].value).toBe(1);
    });

    it("湿度高于上限计为温湿度偏移", () => {
      const records: InspectionRecord[] = [
        makeRecord(1, "ISO 5", { particle05um: 100, particle5um: 10, pressure: 15, temperature: 22, humidity: 55 }, 0),
      ];
      const result = calculateTrendData(records, [], thresholds, "ISO 5", "温湿度偏移", 7);
      expect(result.data[result.data.length - 1].value).toBe(1);
    });

    it("温湿度均正常不计偏移", () => {
      const records: InspectionRecord[] = [
        makeRecord(1, "ISO 5", { particle05um: 100, particle5um: 10, pressure: 15, temperature: 22, humidity: 45 }, 0),
      ];
      const result = calculateTrendData(records, [], thresholds, "ISO 5", "温湿度偏移", 7);
      expect(result.data[result.data.length - 1].value).toBe(0);
    });
  });

  describe("待处理工单计数", () => {
    it("只计非已关闭状态的工单", () => {
      const tickets: AnomalyTicket[] = [
        makeTicket(1, "ISO 5", "粒子异常", "待处理", 0),
        makeTicket(2, "ISO 5", "压差异常", "处理中", 0),
        makeTicket(3, "ISO 5", "温湿度偏移", "已关闭", 0),
      ];
      const result = calculateTrendData([], tickets, thresholds, "ISO 5", "待处理数量", 7);
      expect(result.data[result.data.length - 1].value).toBe(2);
    });

    it("已关闭工单不计入", () => {
      const tickets: AnomalyTicket[] = [
        makeTicket(1, "ISO 5", "温湿度偏移", "已关闭", 0),
        makeTicket(2, "ISO 5", "温湿度偏移", "已关闭", 1),
      ];
      const result = calculateTrendData([], tickets, thresholds, "ISO 5", "待处理数量", 7);
      const totalPending = result.data.reduce((s, d) => s + d.value, 0);
      expect(totalPending).toBe(0);
    });

    it("不同日期的待处理工单分别计入对应天", () => {
      const tickets: AnomalyTicket[] = [
        makeTicket(1, "ISO 5", "粒子异常", "待处理", 0),
        makeTicket(2, "ISO 5", "压差异常", "处理中", 1),
        makeTicket(3, "ISO 5", "温湿度偏移", "待处理", 2),
      ];
      const result = calculateTrendData([], tickets, thresholds, "全部", "待处理数量", 7);
      expect(result.data[result.data.length - 1].value).toBe(1);
      expect(result.data[result.data.length - 2].value).toBe(1);
      expect(result.data[result.data.length - 3].value).toBe(1);
    });
  });

  describe("空数据 hasData=false", () => {
    it("无巡检记录时粒子异常hasData为false", () => {
      const result = calculateTrendData([], [], thresholds, "ISO 5", "粒子异常", 7);
      expect(result.hasData).toBe(false);
    });

    it("无工单时待处理数量hasData为false", () => {
      const result = calculateTrendData([], [], thresholds, "全部", "待处理数量", 7);
      expect(result.hasData).toBe(false);
    });

    it("有记录但不在最近7天内hasData为false", () => {
      const records: InspectionRecord[] = [
        makeRecord(1, "ISO 5", { particle05um: 4000, particle5um: 10, pressure: 15, temperature: 22, humidity: 45 }, 10),
      ];
      const result = calculateTrendData(records, [], thresholds, "ISO 5", "粒子异常", 7);
      expect(result.hasData).toBe(false);
    });

    it("有记录在最近7天内hasData为true", () => {
      const records: InspectionRecord[] = [
        makeRecord(1, "ISO 5", { particle05um: 100, particle5um: 10, pressure: 15, temperature: 22, humidity: 45 }, 0),
      ];
      const result = calculateTrendData(records, [], thresholds, "ISO 5", "粒子异常", 7);
      expect(result.hasData).toBe(true);
    });

    it("筛选区域无匹配记录时hasData为false", () => {
      const records: InspectionRecord[] = [
        makeRecord(1, "ISO 5", { particle05um: 100, particle5um: 10, pressure: 15, temperature: 22, humidity: 45 }, 0),
      ];
      const result = calculateTrendData(records, [], thresholds, "ISO 7", "粒子异常", 7);
      expect(result.hasData).toBe(false);
    });
  });

  describe("环比趋势计算", () => {
    it("上升趋势：最后一天比前一天多", () => {
      const records: InspectionRecord[] = [
        makeRecord(1, "ISO 5", { particle05um: 4000, particle5um: 10, pressure: 15, temperature: 22, humidity: 45 }, 0),
      ];
      const result = calculateTrendData(records, [], thresholds, "ISO 5", "粒子异常", 7);
      expect(result.summary.current).toBe(1);
      expect(result.summary.previous).toBe(0);
      expect(result.summary.changePercent).toBe(100);
      expect(result.summary.trend).toBe("up");
    });

    it("下降趋势：最后一天比前一天少", () => {
      const records: InspectionRecord[] = [
        makeRecord(1, "ISO 5", { particle05um: 4000, particle5um: 10, pressure: 15, temperature: 22, humidity: 45 }, 1),
        makeRecord(2, "ISO 5", { particle05um: 4000, particle5um: 10, pressure: 15, temperature: 22, humidity: 45 }, 1),
      ];
      const result = calculateTrendData(records, [], thresholds, "ISO 5", "粒子异常", 7);
      expect(result.summary.current).toBe(0);
      expect(result.summary.previous).toBe(2);
      expect(result.summary.changePercent).toBe(-100);
      expect(result.summary.trend).toBe("down");
    });

    it("稳定趋势：最后两天数值相同", () => {
      const records: InspectionRecord[] = [
        makeRecord(1, "ISO 5", { particle05um: 4000, particle5um: 10, pressure: 15, temperature: 22, humidity: 45 }, 0),
        makeRecord(2, "ISO 5", { particle05um: 4000, particle5um: 10, pressure: 15, temperature: 22, humidity: 45 }, 1),
      ];
      const result = calculateTrendData(records, [], thresholds, "ISO 5", "粒子异常", 7);
      expect(result.summary.current).toBe(1);
      expect(result.summary.previous).toBe(1);
      expect(result.summary.changePercent).toBe(0);
      expect(result.summary.trend).toBe("stable");
    });

    it("changePercent按公式(current-previous)/previous*100四舍五入", () => {
      const records: InspectionRecord[] = [
        makeRecord(1, "ISO 5", { particle05um: 4000, particle5um: 10, pressure: 15, temperature: 22, humidity: 45 }, 0),
        makeRecord(2, "ISO 5", { particle05um: 4000, particle5um: 10, pressure: 15, temperature: 22, humidity: 45 }, 0),
        makeRecord(3, "ISO 5", { particle05um: 4000, particle5um: 10, pressure: 15, temperature: 22, humidity: 45 }, 1),
        makeRecord(4, "ISO 5", { particle05um: 4000, particle5um: 10, pressure: 15, temperature: 22, humidity: 45 }, 1),
        makeRecord(5, "ISO 5", { particle05um: 4000, particle5um: 10, pressure: 15, temperature: 22, humidity: 45 }, 1),
      ];
      const result = calculateTrendData(records, [], thresholds, "ISO 5", "粒子异常", 7);
      expect(result.summary.current).toBe(2);
      expect(result.summary.previous).toBe(3);
      expect(result.summary.changePercent).toBe(-33);
    });

    it("全为0时trend为stable", () => {
      const records: InspectionRecord[] = [
        makeRecord(1, "ISO 5", { particle05um: 100, particle5um: 10, pressure: 15, temperature: 22, humidity: 45 }, 0),
        makeRecord(2, "ISO 5", { particle05um: 100, particle5um: 10, pressure: 15, temperature: 22, humidity: 45 }, 1),
      ];
      const result = calculateTrendData(records, [], thresholds, "ISO 5", "粒子异常", 7);
      expect(result.summary.current).toBe(0);
      expect(result.summary.previous).toBe(0);
      expect(result.summary.trend).toBe("stable");
    });
  });

  describe("calculateAllTrendData", () => {
    it("返回所有4种异常类型的趋势数据", () => {
      const result = calculateAllTrendData([], [], thresholds, "全部", 7);
      expect(result["粒子异常"]).toBeDefined();
      expect(result["压差异常"]).toBeDefined();
      expect(result["温湿度偏移"]).toBeDefined();
      expect(result["待处理数量"]).toBeDefined();
    });

    it("空数据时所有类型hasData为false", () => {
      const result = calculateAllTrendData([], [], thresholds, "全部", 7);
      expect(result["粒子异常"].hasData).toBe(false);
      expect(result["压差异常"].hasData).toBe(false);
      expect(result["温湿度偏移"].hasData).toBe(false);
      expect(result["待处理数量"].hasData).toBe(false);
    });

    it("有混合异常数据时各类型独立计算", () => {
      const records: InspectionRecord[] = [
        makeRecord(1, "ISO 5", { particle05um: 4000, particle5um: 10, pressure: 8, temperature: 30, humidity: 45 }, 0),
        makeRecord(2, "ISO 5", { particle05um: 100, particle5um: 10, pressure: 15, temperature: 22, humidity: 45 }, 1),
      ];
      const tickets: AnomalyTicket[] = [
        makeTicket(1, "ISO 5", "粒子异常", "待处理", 0),
      ];
      const result = calculateAllTrendData(records, tickets, thresholds, "ISO 5", 7);

      expect(result["粒子异常"].data[result["粒子异常"].data.length - 1].value).toBe(1);
      expect(result["压差异常"].data[result["压差异常"].data.length - 1].value).toBe(1);
      expect(result["温湿度偏移"].data[result["温湿度偏移"].data.length - 1].value).toBe(1);
      expect(result["待处理数量"].data[result["待处理数量"].data.length - 1].value).toBe(1);
    });
  });
});
