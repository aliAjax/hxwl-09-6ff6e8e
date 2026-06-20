import { describe, it, expect } from "vitest";
import {
  backfillThreshold,
  backfillInspectionRecord,
  backfillAnomalyTicket,
  backfillInspectionPlan,
  backfillAnomalyTrace,
  backfillFilterConditions,
  backfillFilterRecord,
  migrationService,
} from "../services/MigrationService";
import { DEFAULT_THRESHOLDS, DEFAULT_FILTERS, DB_VERSION, APP_VERSION } from "../domain/constants";
import type {
  AreaThreshold,
  InspectionRecord,
  AnomalyTicket,
  InspectionPlan,
  AnomalyTrace,
  BackupData,
} from "../domain/models";

describe("backfillThreshold", () => {
  it("完整数据原样保留", () => {
    const input: AreaThreshold = DEFAULT_THRESHOLDS[0];
    const result = backfillThreshold(input);
    expect(result).toEqual(input);
  });

  it("缺失 particle05um 时使用默认值", () => {
    const input: any = { area: "ISO 5", particle5um: 29, pressure: { min: 12, max: 20 }, temperature: { min: 20, max: 24 }, humidity: { min: 40, max: 50 } };
    const result = backfillThreshold(input);
    expect(result.particle05um).toBe(DEFAULT_THRESHOLDS[0].particle05um);
  });

  it("缺失 pressure 时使用默认值", () => {
    const input: any = { area: "ISO 5", particle05um: 100, particle5um: 5, temperature: { min: 20, max: 24 }, humidity: { min: 40, max: 50 } };
    const result = backfillThreshold(input);
    expect(result.pressure.min).toBe(DEFAULT_THRESHOLDS[0].pressure.min);
    expect(result.pressure.max).toBe(DEFAULT_THRESHOLDS[0].pressure.max);
  });

  it("未知区域使用 fallback 默认值（0）", () => {
    const input: any = { area: "未知区域" as any };
    const result = backfillThreshold(input);
    expect(result.particle05um).toBe(0);
    expect(result.pressure.min).toBe(0);
  });

  it("缺失 version 时补齐为 1", () => {
    const input: any = { area: "ISO 5", particle05um: 100, particle5um: 5, pressure: { min: 12, max: 20 }, temperature: { min: 20, max: 24 }, humidity: { min: 40, max: 50 } };
    const result = backfillThreshold(input);
    expect(result.version).toBe(1);
  });

  it("缺失 updatedAt 时自动生成", () => {
    const input: any = { area: "ISO 5", particle05um: 100, particle5um: 5, pressure: { min: 12, max: 20 }, temperature: { min: 20, max: 24 }, humidity: { min: 40, max: 50 }, version: 1 };
    const result = backfillThreshold(input);
    expect(result.updatedAt).toBeTruthy();
  });
});

describe("backfillInspectionRecord", () => {
  it("完整数据保留核心字段", () => {
    const input: InspectionRecord = {
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
      version: 2,
      updatedAt: "2026-06-20 09:00",
    };
    const result = backfillInspectionRecord(input);
    expect(result).toEqual(input);
  });

  it("缺失 roomId 时填充空字符串", () => {
    const input: any = { id: 1, area: "ISO 5", particle05um: 100, particle5um: 5, pressure: 15, temperature: 22, humidity: 45 };
    const result = backfillInspectionRecord(input);
    expect(result.roomId).toBe("");
  });

  it("缺失 area 时默认 ISO 6", () => {
    const input: any = { id: 1, particle05um: 100, particle5um: 5, pressure: 15, temperature: 22, humidity: 45 };
    const result = backfillInspectionRecord(input);
    expect(result.area).toBe("ISO 6");
  });

  it("缺失数值字段时填充 0", () => {
    const input: any = { id: 1 };
    const result = backfillInspectionRecord(input);
    expect(result.particle05um).toBe(0);
    expect(result.particle5um).toBe(0);
    expect(result.pressure).toBe(0);
    expect(result.temperature).toBe(0);
    expect(result.humidity).toBe(0);
  });

  it("缺失 deviceStatus 时默认运行中", () => {
    const input: any = { id: 1 };
    const result = backfillInspectionRecord(input);
    expect(result.deviceStatus).toBe("运行中");
  });

  it("缺失 synced 时默认 false", () => {
    const input: any = { id: 1 };
    const result = backfillInspectionRecord(input);
    expect(result.synced).toBe(false);
  });

  it("缺失 version 时默认 1", () => {
    const input: any = { id: 1 };
    const result = backfillInspectionRecord(input);
    expect(result.version).toBe(1);
  });

  it("缺失 status 时默认稳定", () => {
    const input: any = { id: 1 };
    const result = backfillInspectionRecord(input);
    expect(result.status).toBe("稳定");
  });
});

describe("backfillAnomalyTicket", () => {
  it("完整数据保留核心字段", () => {
    const input: AnomalyTicket = {
      id: 1,
      roomId: "CR-001",
      area: "ISO 5",
      anomalyType: "粒子异常",
      assignee: "张伟",
      status: "待处理",
      remark: "",
      createdAt: "2026-06-20 09:00",
      processNotes: [],
      synced: true,
      version: 1,
      updatedAt: "2026-06-20 09:00",
    };
    const result = backfillAnomalyTicket(input);
    expect(result).toEqual(input);
  });

  it("缺失 anomalyType 时默认粒子异常", () => {
    const input: any = { id: 1 };
    const result = backfillAnomalyTicket(input);
    expect(result.anomalyType).toBe("粒子异常");
  });

  it("缺失 status 时默认待处理", () => {
    const input: any = { id: 1 };
    const result = backfillAnomalyTicket(input);
    expect(result.status).toBe("待处理");
  });

  it("缺失 area 时默认 ISO 6", () => {
    const input: any = { id: 1 };
    const result = backfillAnomalyTicket(input);
    expect(result.area).toBe("ISO 6");
  });

  it("缺失 processNotes 时默认为空数组", () => {
    const input: any = { id: 1 };
    const result = backfillAnomalyTicket(input);
    expect(result.processNotes).toEqual([]);
  });
});

describe("backfillInspectionPlan", () => {
  it("完整数据保留核心字段", () => {
    const input: InspectionPlan = {
      id: 1,
      date: "2026-06-20",
      area: "ISO 5",
      role: "巡检员",
      inspector: "张伟",
      status: "进行中",
      linkedRecordIds: [],
      synced: true,
      version: 1,
      updatedAt: "2026-06-20 08:00",
    };
    const result = backfillInspectionPlan(input);
    expect(result).toEqual(input);
  });

  it("缺失 date 时填充今天日期格式", () => {
    const input: any = { id: 1 };
    const result = backfillInspectionPlan(input);
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("缺失 status 时默认未开始", () => {
    const input: any = { id: 1 };
    const result = backfillInspectionPlan(input);
    expect(result.status).toBe("未开始");
  });

  it("缺失 linkedRecordIds 时默认为空数组", () => {
    const input: any = { id: 1 };
    const result = backfillInspectionPlan(input);
    expect(result.linkedRecordIds).toEqual([]);
  });
});

describe("backfillAnomalyTrace", () => {
  it("完整数据保留核心字段", () => {
    const input: AnomalyTrace = {
      id: 1,
      roomId: "CR-001",
      area: "ISO 5",
      anomalyType: "粒子异常",
      status: "处理中",
      firstOccurredAt: "2026-06-18 10:00",
      lastOccurredAt: "2026-06-20 08:00",
      anomalyCount: 3,
      recoveryCount: 1,
      linkedRecordIds: [],
      linkedTicketIds: [],
      processingSteps: [],
      closeCondition: { particleStable: false, pressureStable: true, tempHumidityStable: true, deviceNormal: true, consecutiveNormalRecords: 0, ticketsClosed: false },
      canClose: false,
      synced: true,
      version: 2,
      updatedAt: "2026-06-20 08:00",
    };
    const result = backfillAnomalyTrace(input);
    expect(result).toEqual(input);
  });

  it("缺失 anomalyType 时默认粒子异常", () => {
    const input: any = { id: 1 };
    const result = backfillAnomalyTrace(input);
    expect(result.anomalyType).toBe("粒子异常");
  });

  it("缺失 status 时默认异常发生", () => {
    const input: any = { id: 1 };
    const result = backfillAnomalyTrace(input);
    expect(result.status).toBe("异常发生");
  });

  it("缺失 anomalyCount 时默认 1", () => {
    const input: any = { id: 1 };
    const result = backfillAnomalyTrace(input);
    expect(result.anomalyCount).toBe(1);
  });

  it("缺失 recoveryCount 时默认 0", () => {
    const input: any = { id: 1 };
    const result = backfillAnomalyTrace(input);
    expect(result.recoveryCount).toBe(0);
  });

  it("缺失 closeCondition 时使用默认结构", () => {
    const input: any = { id: 1 };
    const result = backfillAnomalyTrace(input);
    expect(result.closeCondition.particleStable).toBe(false);
    expect(result.closeCondition.pressureStable).toBe(false);
    expect(result.closeCondition.tempHumidityStable).toBe(false);
    expect(result.closeCondition.deviceNormal).toBe(false);
    expect(result.closeCondition.consecutiveNormalRecords).toBe(0);
    expect(result.closeCondition.ticketsClosed).toBe(false);
  });

  it("缺失 linkedRecordIds/linkedTicketIds/processingSteps 时默认为空数组", () => {
    const input: any = { id: 1 };
    const result = backfillAnomalyTrace(input);
    expect(result.linkedRecordIds).toEqual([]);
    expect(result.linkedTicketIds).toEqual([]);
    expect(result.processingSteps).toEqual([]);
  });
});

describe("backfillFilterConditions / backfillFilterRecord", () => {
  it("完整数据保留", () => {
    const result = backfillFilterConditions(DEFAULT_FILTERS);
    expect(result).toEqual(DEFAULT_FILTERS);
  });

  it("null/undefined 输入使用默认值", () => {
    const r1 = backfillFilterConditions(null);
    const r2 = backfillFilterConditions(undefined);
    expect(r1).toEqual(DEFAULT_FILTERS);
    expect(r2).toEqual(DEFAULT_FILTERS);
  });

  it("部分字段缺失时其余使用默认值", () => {
    const result = backfillFilterConditions({ trendAreaFilter: "ISO 5" } as any);
    expect(result.trendAreaFilter).toBe("ISO 5");
    expect(result.planStatusFilter).toBe(DEFAULT_FILTERS.planStatusFilter);
  });

  it("backfillFilterRecord 补齐 key=main", () => {
    const result = backfillFilterRecord(DEFAULT_FILTERS);
    expect(result.key).toBe("main");
    expect(result.trendAreaFilter).toBe(DEFAULT_FILTERS.trendAreaFilter);
  });

  it("backfillFilterRecord 保留已有的 key", () => {
    const result = backfillFilterRecord({ key: "custom", ...DEFAULT_FILTERS });
    expect(result.key).toBe("custom");
  });

  it("backfillFilterRecord 对完全未知数据补齐", () => {
    const result = backfillFilterRecord({});
    expect(result.key).toBe("main");
    expect(result.trendAreaFilter).toBe(DEFAULT_FILTERS.trendAreaFilter);
  });
});

describe("migrationService.validateBackup", () => {
  function makeValidBackup(): BackupData {
    return {
      exportedAt: "2026-06-20 10:00",
      dbVersion: DB_VERSION,
      appVersion: APP_VERSION,
      data: {
        thresholds: [],
        inspectionRecords: [],
        anomalyTickets: [],
        inspectionPlans: [],
        filters: DEFAULT_FILTERS,
        anomalyTraces: [],
        syncQueue: [],
        syncConflicts: [],
      },
    };
  }

  it("合法备份 valid=true 且无错误无警告", async () => {
    const backup = makeValidBackup();
    const result = await migrationService.validateBackup(backup);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.warnings.length).toBe(0);
  });

  it("备份为 null/undefined 时报错", async () => {
    const r1 = await migrationService.validateBackup(null as any);
    const r2 = await migrationService.validateBackup(undefined as any);
    expect(r1.valid).toBe(false);
    expect(r1.errors.length).toBeGreaterThan(0);
    expect(r2.valid).toBe(false);
  });

  it("非对象格式时报错", async () => {
    const result = await migrationService.validateBackup("not-an-object" as any);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("缺失 data 字段时报错", async () => {
    const backup: any = { exportedAt: "2026-06-20 10:00", dbVersion: DB_VERSION };
    const result = await migrationService.validateBackup(backup);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("data"))).toBe(true);
  });

  it("缺失某个 store 数据时在 errors 中体现", async () => {
    const backup: any = makeValidBackup();
    delete backup.data.thresholds;
    const result = await migrationService.validateBackup(backup);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("thresholds"))).toBe(true);
  });

  it("备份版本高于当前版本产生 warning", async () => {
    const backup = makeValidBackup();
    backup.dbVersion = DB_VERSION + 10;
    const result = await migrationService.validateBackup(backup);
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("应用版本不一致产生 warning", async () => {
    const backup = makeValidBackup();
    backup.appVersion = "9.9.9";
    const result = await migrationService.validateBackup(backup);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes("应用版本"))).toBe(true);
  });
});
