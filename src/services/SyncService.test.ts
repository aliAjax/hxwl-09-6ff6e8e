import { describe, it, expect, vi, beforeEach } from "vitest";
import { SyncService, bumpSyncVersion, buildSyncFingerprint } from "../services/SyncService";
import type { AppRepository, RemoteSyncRepository } from "../repositories";
import type {
  InspectionRecord,
  AnomalyTicket,
  InspectionPlan,
  AnomalyTrace,
  AreaThreshold,
  SyncQueueItem,
  SyncConflict,
} from "../domain/models";
import { DEFAULT_THRESHOLDS } from "../domain/constants";

function makeMockRepo(): AppRepository & {
  _queue: SyncQueueItem[];
  _conflicts: SyncConflict[];
  _records: InspectionRecord[];
  _tickets: AnomalyTicket[];
  _plans: InspectionPlan[];
  _traces: AnomalyTrace[];
  _thresholds: AreaThreshold[];
  _nextQueueId: number;
  _nextConflictId: number;
} {
  const state = {
    _queue: [] as SyncQueueItem[],
    _conflicts: [] as SyncConflict[],
    _records: [] as InspectionRecord[],
    _tickets: [] as AnomalyTicket[],
    _plans: [] as InspectionPlan[],
    _traces: [] as AnomalyTrace[],
    _thresholds: [...DEFAULT_THRESHOLDS],
    _nextQueueId: 1,
    _nextConflictId: 1,
  };

  return {
    ...state,
    getThresholds: () => Promise.resolve(state._thresholds),
    saveThresholds: (t) => { state._thresholds = t; return Promise.resolve(); },
    getInspectionRecords: () => Promise.resolve(state._records),
    saveInspectionRecord: () => Promise.resolve(),
    saveAllInspectionRecords: (r) => { state._records = r; return Promise.resolve(); },
    getAnomalyTickets: () => Promise.resolve(state._tickets),
    saveAnomalyTicket: () => Promise.resolve(),
    saveAllAnomalyTickets: (t) => { state._tickets = t; return Promise.resolve(); },
    updateTicketStatus: () => Promise.resolve(),
    getAnomalyTraces: () => Promise.resolve(state._traces),
    saveAnomalyTrace: () => Promise.resolve(),
    saveAllAnomalyTraces: (t) => { state._traces = t; return Promise.resolve(); },
    getInspectionPlans: () => Promise.resolve(state._plans),
    saveInspectionPlan: () => Promise.resolve(),
    saveAllInspectionPlans: (p) => { state._plans = p; return Promise.resolve(); },
    updatePlanStatus: () => Promise.resolve(),
    addLinkedRecordToPlan: () => Promise.resolve(),
    getFilters: () => Promise.resolve({} as any),
    saveFilters: () => Promise.resolve(),
    getSyncQueue: () => Promise.resolve(state._queue),
    saveSyncQueueItem: (item) => { state._queue.push(item); return Promise.resolve(); },
    saveAllSyncQueueItems: (items) => { state._queue = items; return Promise.resolve(); },
    updateSyncQueueItem: (item) => {
      const idx = state._queue.findIndex((i) => i.id === item.id);
      if (idx !== -1) state._queue[idx] = item;
      return Promise.resolve();
    },
    removeSyncQueueItem: (id) => {
      state._queue = state._queue.filter((i) => i.id !== id);
      return Promise.resolve();
    },
    clearSyncedQueueItems: () => {
      state._queue = state._queue.filter((i) => i.status !== "synced");
      return Promise.resolve();
    },
    getNextSyncQueueId: () => Promise.resolve(state._nextQueueId++),
    getSyncConflicts: () => Promise.resolve(state._conflicts),
    saveSyncConflict: (c) => { state._conflicts.push(c); return Promise.resolve(); },
    saveAllSyncConflicts: (c) => { state._conflicts = c; return Promise.resolve(); },
    updateSyncConflict: (c) => {
      const idx = state._conflicts.findIndex((x) => x.id === c.id);
      if (idx !== -1) state._conflicts[idx] = c;
      return Promise.resolve();
    },
    removeSyncConflict: (id: number) => {
      state._conflicts = state._conflicts.filter((c) => c.id !== id);
      return Promise.resolve();
    },
    clearResolvedConflicts: () => {
      state._conflicts = state._conflicts.filter((c) => !c.resolvedAt);
      return Promise.resolve();
    },
    getNextSyncConflictId: () => Promise.resolve(state._nextConflictId++),
    isEmpty: () => Promise.resolve(false),
    seedDefaults: () => Promise.resolve(),
    clearAll: () => Promise.resolve(),
    loadAll: () => Promise.resolve({} as any),
  };
}

function makeMockRemote(online: boolean = true): RemoteSyncRepository {
  return {
    pushRecord: () => Promise.resolve({ success: true, status: "success" as const }),
    pushTicket: () => Promise.resolve({ success: true, status: "success" as const }),
    pushPlan: () => Promise.resolve({ success: true, status: "success" as const }),
    pushTrace: () => Promise.resolve({ success: true, status: "success" as const }),
    pushThreshold: () => Promise.resolve({ success: true, status: "success" as const }),
    pullThresholds: () => Promise.resolve(null),
    pullPlans: () => Promise.resolve(null),
    syncAll: () => Promise.resolve({} as any),
    isOnline: () => online,
    onOnlineChange: () => () => {},
    setSimulateConflicts: () => {},
  };
}

describe("bumpSyncVersion", () => {
  it("无 version 时 version 变为 1", () => {
    const result = bumpSyncVersion({ id: 1 } as any);
    expect(result.version).toBe(1);
    expect(result.updatedAt).toBeTruthy();
  });

  it("有 version 时 version 递增", () => {
    const result = bumpSyncVersion({ id: 1, version: 3 } as any);
    expect(result.version).toBe(4);
  });

  it("updatedAt 总是刷新", () => {
    const old = "2020-01-01 00:00";
    const result = bumpSyncVersion({ id: 1, version: 1, updatedAt: old } as any);
    expect(result.updatedAt).not.toBe(old);
  });

  it("其他字段原样保留", () => {
    const result = bumpSyncVersion({ id: 1, foo: "bar" } as any);
    expect(result.foo).toBe("bar");
  });
});

describe("buildSyncFingerprint", () => {
  it("inspectionRecord 指纹包含 roomId、createdAt、particle05um、status、version", () => {
    const record: InspectionRecord = {
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
      synced: false,
      version: 2,
    };
    const fp = buildSyncFingerprint("inspectionRecord", 1, "update", record);
    expect(fp).toContain("inspectionRecord");
    expect(fp).toContain("CR-001");
    expect(fp).toContain("2026-06-20 09:00");
    expect(fp).toContain("100");
    expect(fp).toContain("稳定");
    expect(fp).toContain("2");
  });

  it("anomalyTicket 指纹包含 anomalyType、status、version", () => {
    const ticket: AnomalyTicket = {
      id: 1,
      roomId: "CR-001",
      area: "ISO 5",
      anomalyType: "粒子异常",
      assignee: "张伟",
      status: "待处理",
      remark: "",
      createdAt: "2026-06-20 09:00",
      processNotes: [],
      synced: false,
      version: 3,
    };
    const fp = buildSyncFingerprint("anomalyTicket", 1, "update", ticket);
    expect(fp).toContain("anomalyTicket");
    expect(fp).toContain("粒子异常");
    expect(fp).toContain("待处理");
    expect(fp).toContain("3");
  });

  it("inspectionPlan 指纹包含 linkedRecordIds（排序后）", () => {
    const plan: InspectionPlan = {
      id: 1,
      date: "2026-06-20",
      area: "ISO 5",
      role: "巡检员",
      inspector: "张伟",
      status: "进行中",
      linkedRecordIds: [3, 1, 2],
      synced: false,
      version: 1,
    };
    const fp = buildSyncFingerprint("inspectionPlan", 1, "update", plan);
    expect(fp).toContain("1,2,3");
    expect(fp).toContain("ISO 5");
    expect(fp).toContain("进行中");
  });

  it("anomalyTrace 指纹包含 lastOccurredAt、anomalyType", () => {
    const trace: AnomalyTrace = {
      id: 1,
      roomId: "CR-001",
      area: "ISO 5",
      anomalyType: "压差异常",
      status: "处理中",
      firstOccurredAt: "2026-06-18 10:00",
      lastOccurredAt: "2026-06-20 08:00",
      anomalyCount: 3,
      recoveryCount: 1,
      linkedRecordIds: [],
      linkedTicketIds: [],
      processingSteps: [],
      closeCondition: { particleStable: true, pressureStable: false, tempHumidityStable: true, deviceNormal: true, consecutiveNormalRecords: 0, ticketsClosed: false },
      canClose: false,
      synced: false,
      version: 2,
    };
    const fp = buildSyncFingerprint("anomalyTrace", 1, "update", trace);
    expect(fp).toContain("压差异常");
    expect(fp).toContain("2026-06-20 08:00");
    expect(fp).toContain("2");
  });

  it("threshold 指纹包含 area、version", () => {
    const th = DEFAULT_THRESHOLDS[0];
    const fp = buildSyncFingerprint("threshold", th.area, "update", th);
    expect(fp).toContain("threshold");
    expect(fp).toContain("ISO 5");
    expect(fp).toContain("1");
  });

  it("相同输入产生相同指纹", () => {
    const record: InspectionRecord = {
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
      synced: false,
      version: 1,
    };
    const fp1 = buildSyncFingerprint("inspectionRecord", 1, "update", record);
    const fp2 = buildSyncFingerprint("inspectionRecord", 1, "update", { ...record });
    expect(fp1).toBe(fp2);
  });

  it("不同 version 产生不同指纹", () => {
    const base: InspectionRecord = {
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
      synced: false,
      version: 1,
    };
    const fp1 = buildSyncFingerprint("inspectionRecord", 1, "update", base);
    const fp2 = buildSyncFingerprint("inspectionRecord", 1, "update", { ...base, version: 2 });
    expect(fp1).not.toBe(fp2);
  });

  it("不同 action 产生不同指纹", () => {
    const base: InspectionRecord = {
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
      synced: false,
      version: 1,
    };
    const fp1 = buildSyncFingerprint("inspectionRecord", 1, "create", base);
    const fp2 = buildSyncFingerprint("inspectionRecord", 1, "update", base);
    expect(fp1).not.toBe(fp2);
  });
});

describe("SyncService.enqueueEntity", () => {
  let repo: ReturnType<typeof makeMockRepo>;
  let remote: RemoteSyncRepository;
  let service: SyncService;

  beforeEach(() => {
    repo = makeMockRepo();
    remote = makeMockRemote(true);
    service = new SyncService(repo, remote);
  });

  it("首次入队创建 pending 条目并生成 id", async () => {
    const record: InspectionRecord = {
      id: 42,
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
      synced: false,
      version: 1,
    };
    const item = await service.enqueueEntity("inspectionRecord", record, "update");
    expect(item).not.toBeNull();
    expect(item!.entityType).toBe("inspectionRecord");
    expect(item!.entityId).toBe(42);
    expect(item!.action).toBe("update");
    expect(item!.status).toBe("pending");
    expect(item!.retryCount).toBe(0);
    expect(repo._queue.length).toBe(1);
  });

  it("相同指纹且非 synced/conflict 时返回已有条目（去重）", async () => {
    const record: InspectionRecord = {
      id: 42,
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
      synced: false,
      version: 1,
    };
    const first = await service.enqueueEntity("inspectionRecord", record, "update");
    const second = await service.enqueueEntity("inspectionRecord", record, "update");
    expect(first!.id).toBe(second!.id);
    expect(repo._queue.length).toBe(1);
  });

  it("相同 entity 但内容/version 变化时更新为 pending 并刷新指纹", async () => {
    const record1: InspectionRecord = {
      id: 42,
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
      synced: false,
      version: 1,
    };
    const first = await service.enqueueEntity("inspectionRecord", record1, "update");
    const firstFp = first!.syncFingerprint;

    const record2 = { ...record1, version: 2, particle05um: 5000 };
    const second = await service.enqueueEntity("inspectionRecord", record2, "update");

    expect(second!.id).toBe(first!.id);
    expect(second!.syncFingerprint).not.toBe(firstFp);
    expect(second!.status).toBe("pending");
    expect(second!.errorMessage).toBeUndefined();
    expect(repo._queue.length).toBe(1);
  });

  it("threshold 使用 area 作为 entityId", async () => {
    const th = DEFAULT_THRESHOLDS[0];
    const item = await service.enqueueEntity("threshold", th, "update");
    expect(item).not.toBeNull();
    expect(item!.entityId as unknown as string).toBe("ISO 5");
  });

  it("空 entityId 返回 null", async () => {
    const result = await service.enqueueEntity("inspectionRecord", {} as any, "update");
    expect(result).toBeNull();
  });
});

describe("SyncService.getDetailedQueueStatus", () => {
  it("正确统计各状态数量", async () => {
    const repo = makeMockRepo();
    const remote = makeMockRemote(true);
    const service = new SyncService(repo, remote);

    await repo.saveAllSyncQueueItems([
      { id: 1, entityType: "inspectionRecord", entityId: 1, action: "update", status: "pending", retryCount: 0, createdAt: "2026-06-20 09:00", dataSnapshot: {} as any, syncFingerprint: "a" },
      { id: 2, entityType: "inspectionRecord", entityId: 2, action: "update", status: "syncing", retryCount: 0, createdAt: "2026-06-20 09:01", dataSnapshot: {} as any, syncFingerprint: "b" },
      { id: 3, entityType: "anomalyTicket", entityId: 3, action: "update", status: "failed", retryCount: 1, createdAt: "2026-06-20 09:02", dataSnapshot: {} as any, syncFingerprint: "c" },
      { id: 4, entityType: "anomalyTicket", entityId: 4, action: "update", status: "synced", retryCount: 0, createdAt: "2026-06-20 09:03", dataSnapshot: {} as any, syncFingerprint: "d" },
      { id: 5, entityType: "inspectionPlan", entityId: 5, action: "update", status: "conflict", retryCount: 2, createdAt: "2026-06-20 09:04", dataSnapshot: {} as any, syncFingerprint: "e" },
    ]);

    const status = await service.getDetailedQueueStatus();
    expect(status.pending).toBe(1);
    expect(status.syncing).toBe(1);
    expect(status.failed).toBe(1);
    expect(status.synced).toBe(1);
    expect((status as any).conflict).toBe(1);
    expect(status.queue.length).toBe(5);
  });
});

describe("SyncService.markSynced", () => {
  it("按 id 集合标记 synced=true", () => {
    const repo = makeMockRepo();
    const remote = makeMockRemote(true);
    const service = new SyncService(repo, remote);

    const items: Array<{ id: number; synced?: boolean }> = [
      { id: 1, synced: false },
      { id: 2, synced: false },
      { id: 3, synced: false },
    ];
    const syncedIds = new Set([1, 3]);
    const result = service.markSynced(items, syncedIds);
    expect(result[0].synced).toBe(true);
    expect(result[1].synced).toBe(false);
    expect(result[2].synced).toBe(true);
  });
});

describe("SyncService.processQueue 离线情况", () => {
  it("离线时直接返回错误，不处理队列", async () => {
    const repo = makeMockRepo();
    const remote = makeMockRemote(false);
    const service = new SyncService(repo, remote);

    repo._queue = [
      { id: 1, entityType: "inspectionRecord", entityId: 1, action: "update", status: "pending", retryCount: 0, createdAt: "2026-06-20 09:00", dataSnapshot: {} as any, syncFingerprint: "a" },
    ];

    const result = await service.processQueue("all");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.syncedRecords).toBe(0);
    expect(repo._queue[0].status).toBe("pending");
  });
});

describe("SyncService.bumpVersion", () => {
  it("实例方法与导出的纯函数行为一致", () => {
    const repo = makeMockRepo();
    const remote = makeMockRemote(true);
    const service = new SyncService(repo, remote);

    const entity = { id: 1, version: 2, updatedAt: "old" };
    const fromInstance = service.bumpVersion(entity);
    const fromExported = bumpSyncVersion(entity);
    expect(fromInstance.version).toBe(fromExported.version);
    expect(fromInstance.version).toBe(3);
  });
});
