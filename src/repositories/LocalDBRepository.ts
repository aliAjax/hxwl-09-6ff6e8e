import {
  DB_NAME,
  DB_VERSION,
  DB_STORE_NAMES,
  DEFAULT_FILTERS,
  DEFAULT_PLANS,
  DEFAULT_THRESHOLDS,
  DEFAULT_TICKETS,
  DEFAULT_TRACES,
} from "../domain/constants";
import type {
  AnomalyTicket,
  AnomalyTrace,
  AreaThreshold,
  DBSchema,
  FilterConditions,
  InspectionPlan,
  InspectionRecord,
  SyncQueueItem,
  TicketStatus,
} from "../domain/models";
import type { AppRepository } from "./types";

type DBStoreName = keyof DBSchema;

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion || 0;

      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(DB_STORE_NAMES.thresholds)) {
          const store = db.createObjectStore(DB_STORE_NAMES.thresholds, {
            keyPath: "area",
          });
          store.createIndex("area", "area", { unique: true });
        }

        if (!db.objectStoreNames.contains(DB_STORE_NAMES.inspectionRecords)) {
          const store = db.createObjectStore(DB_STORE_NAMES.inspectionRecords, {
            keyPath: "id",
          });
          store.createIndex("id", "id", { unique: true });
          store.createIndex("roomId", "roomId", { unique: false });
          store.createIndex("area", "area", { unique: false });
          store.createIndex("createdAt", "createdAt", { unique: false });
        }

        if (!db.objectStoreNames.contains(DB_STORE_NAMES.anomalyTickets)) {
          const store = db.createObjectStore(DB_STORE_NAMES.anomalyTickets, {
            keyPath: "id",
          });
          store.createIndex("id", "id", { unique: true });
          store.createIndex("roomId", "roomId", { unique: false });
          store.createIndex("area", "area", { unique: false });
          store.createIndex("status", "status", { unique: false });
          store.createIndex("sourceRecordId", "sourceRecordId", {
            unique: false,
          });
        }

        if (!db.objectStoreNames.contains(DB_STORE_NAMES.filters)) {
          db.createObjectStore(DB_STORE_NAMES.filters, { keyPath: "key" });
        }
      }

      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(DB_STORE_NAMES.inspectionPlans)) {
          const store = db.createObjectStore(DB_STORE_NAMES.inspectionPlans, {
            keyPath: "id",
          });
          store.createIndex("id", "id", { unique: true });
          store.createIndex("area", "area", { unique: false });
          store.createIndex("date", "date", { unique: false });
          store.createIndex("status", "status", { unique: false });
          store.createIndex("inspector", "inspector", { unique: false });
        }
      }

      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains(DB_STORE_NAMES.anomalyTraces)) {
          const store = db.createObjectStore(DB_STORE_NAMES.anomalyTraces, {
            keyPath: "id",
          });
          store.createIndex("id", "id", { unique: true });
          store.createIndex("roomId", "roomId", { unique: false });
          store.createIndex("area", "area", { unique: false });
          store.createIndex("status", "status", { unique: false });
          store.createIndex("anomalyType", "anomalyType", { unique: false });
          store.createIndex("firstOccurredAt", "firstOccurredAt", { unique: false });
        }
      }

      if (oldVersion < 4) {
        if (!db.objectStoreNames.contains(DB_STORE_NAMES.syncQueue)) {
          const store = db.createObjectStore(DB_STORE_NAMES.syncQueue, {
            keyPath: "id",
          });
          store.createIndex("id", "id", { unique: true });
          store.createIndex("entityType", "entityType", { unique: false });
          store.createIndex("entityId", "entityId", { unique: false });
          store.createIndex("status", "status", { unique: false });
          store.createIndex("createdAt", "createdAt", { unique: false });
          store.createIndex("syncFingerprint", "syncFingerprint", { unique: false });
        }
      }
    };
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => Promise<T> | T
): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);

    transaction.oncomplete = () => {
      db.close();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error);
    };

    Promise.resolve(callback(store)).then(resolve).catch(reject);
  });
}

function backfillThreshold(
  data: Partial<AreaThreshold> & { area: AreaThreshold["area"] }
): AreaThreshold {
  const defaults = DEFAULT_THRESHOLDS.find((t) => t.area === data.area);
  const fallback: AreaThreshold = {
    area: data.area,
    particle05um: 0,
    particle5um: 0,
    pressure: { min: 0, max: 0 },
    temperature: { min: 0, max: 0 },
    humidity: { min: 0, max: 0 },
  };
  const base = defaults ?? fallback;

  return {
    area: data.area,
    particle05um:
      typeof data.particle05um === "number" ? data.particle05um : base.particle05um,
    particle5um:
      typeof data.particle5um === "number" ? data.particle5um : base.particle5um,
    pressure: {
      min:
        typeof data.pressure?.min === "number"
          ? data.pressure.min
          : base.pressure.min,
      max:
        typeof data.pressure?.max === "number"
          ? data.pressure.max
          : base.pressure.max,
    },
    temperature: {
      min:
        typeof data.temperature?.min === "number"
          ? data.temperature.min
          : base.temperature.min,
      max:
        typeof data.temperature?.max === "number"
          ? data.temperature.max
          : base.temperature.max,
    },
    humidity: {
      min:
        typeof data.humidity?.min === "number"
          ? data.humidity.min
          : base.humidity.min,
      max:
        typeof data.humidity?.max === "number"
          ? data.humidity.max
          : base.humidity.max,
    },
  };
}

function backfillInspectionRecord(
  data: Partial<InspectionRecord> & { id: number }
): InspectionRecord {
  return {
    id: data.id,
    roomId: data.roomId ?? "",
    area: data.area ?? "ISO 6",
    particle05um:
      typeof data.particle05um === "number" ? data.particle05um : 0,
    particle5um:
      typeof data.particle5um === "number" ? data.particle5um : 0,
    pressure: typeof data.pressure === "number" ? data.pressure : 0,
    temperature:
      typeof data.temperature === "number" ? data.temperature : 0,
    humidity: typeof data.humidity === "number" ? data.humidity : 0,
    deviceStatus: data.deviceStatus ?? "运行中",
    remark: data.remark ?? "",
    createdAt: data.createdAt ?? new Date().toISOString().slice(0, 16).replace("T", " "),
    status: data.status ?? "稳定",
    planId: data.planId,
    synced: data.synced ?? false,
  };
}

function backfillAnomalyTicket(
  data: Partial<AnomalyTicket> & { id: number }
): AnomalyTicket {
  return {
    id: data.id,
    roomId: data.roomId ?? "",
    area: data.area ?? "ISO 6",
    anomalyType: data.anomalyType ?? "粒子异常",
    assignee: data.assignee ?? "",
    status: data.status ?? "待处理",
    remark: data.remark ?? "",
    createdAt:
      data.createdAt ??
      new Date().toISOString().slice(0, 16).replace("T", " "),
    sourceRecordId: data.sourceRecordId,
    processNotes: data.processNotes ?? [],
    synced: data.synced ?? false,
  };
}

function backfillInspectionPlan(
  data: Partial<InspectionPlan> & { id: number }
): InspectionPlan {
  return {
    id: data.id,
    date: data.date ?? new Date().toISOString().slice(0, 10),
    area: data.area ?? "ISO 6",
    role: data.role ?? "巡检员",
    inspector: data.inspector ?? "",
    status: data.status ?? "未开始",
    linkedRecordIds: data.linkedRecordIds ?? [],
    synced: data.synced ?? false,
  };
}

function backfillFilterConditions(
  data: Partial<FilterConditions> | null | undefined
): FilterConditions {
  return {
    planStatusFilter:
      data?.planStatusFilter ?? DEFAULT_FILTERS.planStatusFilter,
    ticketStatusFilter:
      data?.ticketStatusFilter ?? DEFAULT_FILTERS.ticketStatusFilter,
    trendAreaFilter: data?.trendAreaFilter ?? DEFAULT_FILTERS.trendAreaFilter,
    trendTypeFilter:
      data?.trendTypeFilter ?? DEFAULT_FILTERS.trendTypeFilter,
    activeRole: data?.activeRole ?? DEFAULT_FILTERS.activeRole,
    activeInspector: data?.activeInspector ?? DEFAULT_FILTERS.activeInspector,
  };
}

function backfillAnomalyTrace(
  data: Partial<AnomalyTrace> & { id: number }
): AnomalyTrace {
  return {
    id: data.id,
    roomId: data.roomId ?? "",
    area: data.area ?? "ISO 6",
    anomalyType: data.anomalyType ?? "粒子异常",
    status: data.status ?? "异常发生",
    rootCause: data.rootCause,
    rootCauseDetail: data.rootCauseDetail,
    confidence: data.confidence,
    firstOccurredAt: data.firstOccurredAt ?? new Date().toISOString().slice(0, 16).replace("T", " "),
    lastOccurredAt: data.lastOccurredAt ?? new Date().toISOString().slice(0, 16).replace("T", " "),
    anomalyCount: data.anomalyCount ?? 1,
    recoveryCount: data.recoveryCount ?? 0,
    initialRecordId: data.initialRecordId,
    triggerTicketId: data.triggerTicketId,
    linkedRecordIds: data.linkedRecordIds ?? [],
    linkedTicketIds: data.linkedTicketIds ?? [],
    processingSteps: data.processingSteps ?? [],
    closeCondition: data.closeCondition ?? {
      particleStable: false,
      pressureStable: false,
      tempHumidityStable: false,
      deviceNormal: false,
      consecutiveNormalRecords: 0,
      ticketsClosed: false,
    },
    canClose: data.canClose ?? false,
    synced: data.synced ?? false,
  };
}

function backfillSyncQueueItem(
  data: Partial<SyncQueueItem> & { id: number }
): SyncQueueItem {
  return {
    id: data.id,
    entityType: (data.entityType as SyncQueueItem["entityType"]) ?? "inspectionRecord",
    entityId: data.entityId ?? 0,
    action: (data.action as SyncQueueItem["action"]) ?? "create",
    status: (data.status as SyncQueueItem["status"]) ?? "pending",
    errorMessage: data.errorMessage,
    retryCount: data.retryCount ?? 0,
    createdAt: data.createdAt ?? new Date().toISOString().slice(0, 16).replace("T", " "),
    lastAttemptAt: data.lastAttemptAt,
    syncedAt: data.syncedAt,
    dataSnapshot: data.dataSnapshot as any,
    syncFingerprint: data.syncFingerprint ?? "",
  };
}

export class LocalDBRepository implements AppRepository {
  async getThresholds(): Promise<AreaThreshold[]> {
    return withStore(DB_STORE_NAMES.thresholds, "readonly", async (store) => {
      const results = await promisifyRequest<AreaThreshold[]>(
        store.getAll() as IDBRequest<AreaThreshold[]>
      );
      if (results.length === 0) return [];
      return results.map((r) =>
        backfillThreshold(
          r as Partial<AreaThreshold> & { area: AreaThreshold["area"] }
        )
      );
    });
  }

  async saveThresholds(thresholds: AreaThreshold[]): Promise<void> {
    return withStore(DB_STORE_NAMES.thresholds, "readwrite", async (store) => {
      await promisifyRequest(store.clear());
      for (const th of thresholds) {
        await promisifyRequest(store.put(th));
      }
    });
  }

  async getInspectionRecords(): Promise<InspectionRecord[]> {
    return withStore(
      DB_STORE_NAMES.inspectionRecords,
      "readonly",
      async (store) => {
        const results = await promisifyRequest<InspectionRecord[]>(
          store.getAll() as IDBRequest<InspectionRecord[]>
        );
        return results
          .map((r) =>
            backfillInspectionRecord(
              r as Partial<InspectionRecord> & { id: number }
            )
          )
          .sort((a, b) => {
            if (!a.createdAt && !b.createdAt) return 0;
            if (!a.createdAt) return 1;
            if (!b.createdAt) return -1;
            return b.createdAt.localeCompare(a.createdAt);
          });
      }
    );
  }

  async saveInspectionRecord(record: InspectionRecord): Promise<void> {
    await withStore(DB_STORE_NAMES.inspectionRecords, "readwrite", (store) => {
      return promisifyRequest(store.put(record));
    });
  }

  async saveAllInspectionRecords(records: InspectionRecord[]): Promise<void> {
    return withStore(
      DB_STORE_NAMES.inspectionRecords,
      "readwrite",
      async (store) => {
        await promisifyRequest(store.clear());
        for (const r of records) {
          await promisifyRequest(store.put(r));
        }
      }
    );
  }

  async getAnomalyTickets(): Promise<AnomalyTicket[]> {
    return withStore(
      DB_STORE_NAMES.anomalyTickets,
      "readonly",
      async (store) => {
        const results = await promisifyRequest<AnomalyTicket[]>(
          store.getAll() as IDBRequest<AnomalyTicket[]>
        );
        return results
          .map((r) =>
            backfillAnomalyTicket(
              r as Partial<AnomalyTicket> & { id: number }
            )
          )
          .sort((a, b) => {
            if (!a.createdAt && !b.createdAt) return 0;
            if (!a.createdAt) return 1;
            if (!b.createdAt) return -1;
            return b.createdAt.localeCompare(a.createdAt);
          });
      }
    );
  }

  async saveAnomalyTicket(ticket: AnomalyTicket): Promise<void> {
    await withStore(DB_STORE_NAMES.anomalyTickets, "readwrite", (store) => {
      return promisifyRequest(store.put(ticket));
    });
  }

  async saveAllAnomalyTickets(tickets: AnomalyTicket[]): Promise<void> {
    return withStore(
      DB_STORE_NAMES.anomalyTickets,
      "readwrite",
      async (store) => {
        await promisifyRequest(store.clear());
        for (const t of tickets) {
          await promisifyRequest(store.put(t));
        }
      }
    );
  }

  async updateTicketStatus(
    ticketId: number,
    status: TicketStatus
  ): Promise<void> {
    return withStore(
      DB_STORE_NAMES.anomalyTickets,
      "readwrite",
      async (store) => {
        const existing = await promisifyRequest(
          store.get(ticketId) as IDBRequest<AnomalyTicket>
        );
        if (existing) {
          await promisifyRequest(
            store.put({ ...existing, status, synced: false })
          );
        }
      }
    );
  }

  async getAnomalyTraces(): Promise<AnomalyTrace[]> {
    return withStore(
      DB_STORE_NAMES.anomalyTraces,
      "readonly",
      async (store) => {
        const results = await promisifyRequest<AnomalyTrace[]>(
          store.getAll() as IDBRequest<AnomalyTrace[]>
        );
        return results
          .map((r) =>
            backfillAnomalyTrace(
              r as Partial<AnomalyTrace> & { id: number }
            )
          )
          .sort((a, b) => {
            if (!a.lastOccurredAt && !b.lastOccurredAt) return 0;
            if (!a.lastOccurredAt) return 1;
            if (!b.lastOccurredAt) return -1;
            return b.lastOccurredAt.localeCompare(a.lastOccurredAt);
          });
      }
    );
  }

  async saveAnomalyTrace(trace: AnomalyTrace): Promise<void> {
    await withStore(DB_STORE_NAMES.anomalyTraces, "readwrite", (store) => {
      return promisifyRequest(store.put(trace));
    });
  }

  async saveAllAnomalyTraces(traces: AnomalyTrace[]): Promise<void> {
    return withStore(
      DB_STORE_NAMES.anomalyTraces,
      "readwrite",
      async (store) => {
        await promisifyRequest(store.clear());
        for (const t of traces) {
          await promisifyRequest(store.put(t));
        }
      }
    );
  }

  async getInspectionPlans(): Promise<InspectionPlan[]> {
    return withStore(
      DB_STORE_NAMES.inspectionPlans,
      "readonly",
      async (store) => {
        const results = await promisifyRequest<InspectionPlan[]>(
          store.getAll() as IDBRequest<InspectionPlan[]>
        );
        return results
          .map((r) =>
            backfillInspectionPlan(
              r as Partial<InspectionPlan> & { id: number }
            )
          )
          .sort((a, b) => {
            if (!a.date && !b.date) return 0;
            return (b.date ?? "").localeCompare(a.date ?? "");
          });
      }
    );
  }

  async saveInspectionPlan(plan: InspectionPlan): Promise<void> {
    await withStore(DB_STORE_NAMES.inspectionPlans, "readwrite", (store) => {
      return promisifyRequest(store.put(plan));
    });
  }

  async saveAllInspectionPlans(plans: InspectionPlan[]): Promise<void> {
    return withStore(
      DB_STORE_NAMES.inspectionPlans,
      "readwrite",
      async (store) => {
        await promisifyRequest(store.clear());
        for (const p of plans) {
          await promisifyRequest(store.put(p));
        }
      }
    );
  }

  async updatePlanStatus(
    planId: number,
    status: InspectionPlan["status"]
  ): Promise<void> {
    return withStore(
      DB_STORE_NAMES.inspectionPlans,
      "readwrite",
      async (store) => {
        const existing = await promisifyRequest(
          store.get(planId) as IDBRequest<InspectionPlan>
        );
        if (existing) {
          await promisifyRequest(
            store.put({ ...existing, status, synced: false })
          );
        }
      }
    );
  }

  async addLinkedRecordToPlan(
    planId: number,
    recordId: number
  ): Promise<void> {
    return withStore(
      DB_STORE_NAMES.inspectionPlans,
      "readwrite",
      async (store) => {
        const existing = await promisifyRequest(
          store.get(planId) as IDBRequest<InspectionPlan>
        );
        if (existing) {
          const linkedRecordIds = existing.linkedRecordIds ?? [];
          if (!linkedRecordIds.includes(recordId)) {
            await promisifyRequest(
              store.put({
                ...existing,
                linkedRecordIds: [...linkedRecordIds, recordId],
                synced: false,
              })
            );
          }
        }
      }
    );
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    return withStore(DB_STORE_NAMES.syncQueue, "readonly", async (store) => {
      const results = await promisifyRequest<SyncQueueItem[]>(
        store.getAll() as IDBRequest<SyncQueueItem[]>
      );
      return results
        .map((r) =>
          backfillSyncQueueItem(
            r as Partial<SyncQueueItem> & { id: number }
          )
        )
        .sort((a, b) => {
          if (!a.createdAt && !b.createdAt) return 0;
          if (!a.createdAt) return 1;
          if (!b.createdAt) return -1;
          return a.createdAt.localeCompare(b.createdAt);
        });
    });
  }

  async saveSyncQueueItem(item: SyncQueueItem): Promise<void> {
    await withStore(DB_STORE_NAMES.syncQueue, "readwrite", (store) => {
      return promisifyRequest(store.put(item));
    });
  }

  async saveAllSyncQueueItems(items: SyncQueueItem[]): Promise<void> {
    return withStore(DB_STORE_NAMES.syncQueue, "readwrite", async (store) => {
      await promisifyRequest(store.clear());
      for (const item of items) {
        await promisifyRequest(store.put(item));
      }
    });
  }

  async updateSyncQueueItem(item: SyncQueueItem): Promise<void> {
    await withStore(DB_STORE_NAMES.syncQueue, "readwrite", async (store) => {
      const existing = await promisifyRequest(
        store.get(item.id) as IDBRequest<SyncQueueItem>
      );
      if (existing) {
        await promisifyRequest(store.put(item));
      }
    });
  }

  async removeSyncQueueItem(id: number): Promise<void> {
    await withStore(DB_STORE_NAMES.syncQueue, "readwrite", (store) => {
      return promisifyRequest(store.delete(id));
    });
  }

  async clearSyncedQueueItems(): Promise<void> {
    return withStore(DB_STORE_NAMES.syncQueue, "readwrite", async (store) => {
      const items = await promisifyRequest<SyncQueueItem[]>(
        store.getAll() as IDBRequest<SyncQueueItem[]>
      );
      for (const item of items) {
        if (item.status === "synced") {
          await promisifyRequest(store.delete(item.id));
        }
      }
    });
  }

  async getNextSyncQueueId(): Promise<number> {
    const queue = await this.getSyncQueue();
    if (queue.length === 0) return 1;
    return Math.max(...queue.map((i) => i.id)) + 1;
  }

  async getFilters(): Promise<FilterConditions> {
    return withStore(DB_STORE_NAMES.filters, "readonly", async (store) => {
      const result = await promisifyRequest(
        store.get("main") as IDBRequest<Partial<FilterConditions> | undefined>
      );
      return backfillFilterConditions(result);
    });
  }

  async saveFilters(filters: FilterConditions): Promise<void> {
    await withStore(DB_STORE_NAMES.filters, "readwrite", (store) => {
      return promisifyRequest(store.put({ key: "main", ...filters }));
    });
  }

  async isEmpty(): Promise<boolean> {
    const [thresholds, records, tickets, plans, traces, queue] = await Promise.all([
      this.getThresholds(),
      this.getInspectionRecords(),
      this.getAnomalyTickets(),
      this.getInspectionPlans(),
      this.getAnomalyTraces(),
      this.getSyncQueue(),
    ]);
    return (
      thresholds.length === 0 &&
      records.length === 0 &&
      tickets.length === 0 &&
      plans.length === 0 &&
      traces.length === 0 &&
      queue.length === 0
    );
  }

  async seedDefaults(): Promise<void> {
    await Promise.all([
      this.saveThresholds(DEFAULT_THRESHOLDS),
      this.saveAllInspectionRecords([]),
      this.saveAllAnomalyTickets(DEFAULT_TICKETS),
      this.saveAllAnomalyTraces(DEFAULT_TRACES),
      this.saveAllInspectionPlans(DEFAULT_PLANS),
      this.saveFilters(DEFAULT_FILTERS),
      this.saveAllSyncQueueItems([]),
    ]);
  }

  async clearAll(): Promise<void> {
    const stores = Object.values(DB_STORE_NAMES) as string[];
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(stores, "readwrite");
      let completed = 0;
      let hasError = false;

      stores.forEach((name) => {
        const store = transaction.objectStore(name);
        const req = store.clear();
        req.onsuccess = () => {
          completed++;
          if (completed === stores.length) {
            db.close();
            resolve();
          }
        };
        req.onerror = () => {
          if (!hasError) {
            hasError = true;
            db.close();
            reject(req.error);
          }
        };
      });

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  }

  async loadAll() {
    const empty = await this.isEmpty();
    if (empty) {
      await this.seedDefaults();
    }

    const [thresholds, inspectionRecords, anomalyTickets, anomalyTraces, inspectionPlans, filters, syncQueue] =
      await Promise.all([
        this.getThresholds(),
        this.getInspectionRecords(),
        this.getAnomalyTickets(),
        this.getAnomalyTraces(),
        this.getInspectionPlans(),
        this.getFilters(),
        this.getSyncQueue(),
      ]);

    const orderedThresholds = DEFAULT_THRESHOLDS.map(
      (def) => thresholds.find((t) => t.area === def.area)!
    ).filter((t): t is AreaThreshold => !!t);

    return {
      thresholds:
        orderedThresholds.length > 0
          ? orderedThresholds
          : DEFAULT_THRESHOLDS,
      inspectionRecords,
      anomalyTickets,
      anomalyTraces,
      inspectionPlans,
      filters,
      syncQueue,
      wasEmpty: empty,
    };
  }
}

export const localDBRepository = new LocalDBRepository();
