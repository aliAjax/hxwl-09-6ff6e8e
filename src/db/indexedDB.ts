import {
  DB_NAME,
  DB_VERSION,
  STORE_NAMES,
  type DBStoreName,
  type DBSchema,
  type AreaThreshold,
  type InspectionRecord,
  type AnomalyTicket,
  type FilterConditions,
} from "./types";
import {
  defaultThresholds,
  initialInspectionRecords,
  initialTickets,
  defaultFilters,
} from "./sampleData";

type IDBRequestResult<T> = T;

function promisifyRequest<T>(request: IDBRequest<T>): Promise<IDBRequestResult<T>> {
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
        if (!db.objectStoreNames.contains(STORE_NAMES.thresholds)) {
          const store = db.createObjectStore(STORE_NAMES.thresholds, {
            keyPath: "area",
          });
          store.createIndex("area", "area", { unique: true });
        }

        if (!db.objectStoreNames.contains(STORE_NAMES.inspectionRecords)) {
          const store = db.createObjectStore(STORE_NAMES.inspectionRecords, {
            keyPath: "id",
          });
          store.createIndex("id", "id", { unique: true });
          store.createIndex("roomId", "roomId", { unique: false });
          store.createIndex("area", "area", { unique: false });
          store.createIndex("createdAt", "createdAt", { unique: false });
        }

        if (!db.objectStoreNames.contains(STORE_NAMES.anomalyTickets)) {
          const store = db.createObjectStore(STORE_NAMES.anomalyTickets, {
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

        if (!db.objectStoreNames.contains(STORE_NAMES.filters)) {
          db.createObjectStore(STORE_NAMES.filters, { keyPath: "key" });
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

    Promise.resolve(callback(store))
      .then(resolve)
      .catch(reject);
  });
}

function backfillThreshold(
  data: Partial<AreaThreshold> & { area: AreaThreshold["area"] }
): AreaThreshold {
  const defaults = defaultThresholds.find((t) => t.area === data.area);
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
  };
}

function backfillFilterConditions(
  data: Partial<FilterConditions> | null | undefined
): FilterConditions {
  return {
    planStatusFilter:
      data?.planStatusFilter ?? defaultFilters.planStatusFilter,
    ticketStatusFilter:
      data?.ticketStatusFilter ?? defaultFilters.ticketStatusFilter,
    trendAreaFilter: data?.trendAreaFilter ?? defaultFilters.trendAreaFilter,
    trendTypeFilter:
      data?.trendTypeFilter ?? defaultFilters.trendTypeFilter,
    activeRole: data?.activeRole ?? defaultFilters.activeRole,
  };
}

async function getAllThresholds(): Promise<AreaThreshold[]> {
  return withStore(STORE_NAMES.thresholds, "readonly", async (store) => {
    const results = await promisifyRequest<AreaThreshold[]>(store.getAll() as IDBRequest<AreaThreshold[]>);
    if (results.length === 0) {
      return [];
    }
    return results.map((r) =>
      backfillThreshold(r as Partial<AreaThreshold> & { area: AreaThreshold["area"] })
    );
  });
}

async function saveAllThresholds(thresholds: AreaThreshold[]): Promise<void> {
  return withStore(STORE_NAMES.thresholds, "readwrite", async (store) => {
    await promisifyRequest(store.clear());
    for (const th of thresholds) {
      await promisifyRequest(store.put(th));
    }
  });
}

async function getAllInspectionRecords(): Promise<InspectionRecord[]> {
  return withStore(STORE_NAMES.inspectionRecords, "readonly", async (store) => {
    const results = await promisifyRequest<InspectionRecord[]>(store.getAll() as IDBRequest<InspectionRecord[]>);
    return results
      .map((r) => backfillInspectionRecord(r as Partial<InspectionRecord> & { id: number }))
      .sort((a, b) => {
        if (!a.createdAt && !b.createdAt) return 0;
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return b.createdAt.localeCompare(a.createdAt);
      });
  });
}

async function saveInspectionRecord(record: InspectionRecord): Promise<void> {
  await withStore(STORE_NAMES.inspectionRecords, "readwrite", (store) => {
    return promisifyRequest(store.put(record));
  });
}

async function saveAllInspectionRecords(records: InspectionRecord[]): Promise<void> {
  return withStore(STORE_NAMES.inspectionRecords, "readwrite", async (store) => {
    await promisifyRequest(store.clear());
    for (const r of records) {
      await promisifyRequest(store.put(r));
    }
  });
}

async function getAllAnomalyTickets(): Promise<AnomalyTicket[]> {
  return withStore(STORE_NAMES.anomalyTickets, "readonly", async (store) => {
    const results = await promisifyRequest<AnomalyTicket[]>(store.getAll() as IDBRequest<AnomalyTicket[]>);
    return results
      .map((r) => backfillAnomalyTicket(r as Partial<AnomalyTicket> & { id: number }))
      .sort((a, b) => {
        if (!a.createdAt && !b.createdAt) return 0;
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return b.createdAt.localeCompare(a.createdAt);
      });
  });
}

async function saveAnomalyTicket(ticket: AnomalyTicket): Promise<void> {
  await withStore(STORE_NAMES.anomalyTickets, "readwrite", (store) => {
    return promisifyRequest(store.put(ticket));
  });
}

async function saveAllAnomalyTickets(tickets: AnomalyTicket[]): Promise<void> {
  return withStore(STORE_NAMES.anomalyTickets, "readwrite", async (store) => {
    await promisifyRequest(store.clear());
    for (const t of tickets) {
      await promisifyRequest(store.put(t));
    }
  });
}

async function getFilterConditions(): Promise<FilterConditions> {
  return withStore(STORE_NAMES.filters, "readonly", async (store) => {
    const result = await promisifyRequest(store.get("main") as IDBRequest<Partial<FilterConditions> | undefined>);
    return backfillFilterConditions(result);
  });
}

async function saveFilterConditions(filters: FilterConditions): Promise<void> {
  await withStore(STORE_NAMES.filters, "readwrite", (store) => {
    return promisifyRequest(store.put({ key: "main", ...filters }));
  });
}

async function isDatabaseEmpty(): Promise<boolean> {
  const [thresholds, records, tickets] = await Promise.all([
    getAllThresholds(),
    getAllInspectionRecords(),
    getAllAnomalyTickets(),
  ]);
  return thresholds.length === 0 && records.length === 0 && tickets.length === 0;
}

async function seedSampleData(): Promise<void> {
  await Promise.all([
    saveAllThresholds(defaultThresholds),
    saveAllInspectionRecords(initialInspectionRecords),
    saveAllAnomalyTickets(initialTickets),
    saveFilterConditions(defaultFilters),
  ]);
}

async function clearAllData(): Promise<void> {
  const stores = [
    STORE_NAMES.thresholds,
    STORE_NAMES.inspectionRecords,
    STORE_NAMES.anomalyTickets,
    STORE_NAMES.filters,
  ];

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

async function loadAllData(): Promise<{
  thresholds: AreaThreshold[];
  inspectionRecords: InspectionRecord[];
  anomalyTickets: AnomalyTicket[];
  filters: FilterConditions;
  wasEmpty: boolean;
}> {
  const empty = await isDatabaseEmpty();
  if (empty) {
    await seedSampleData();
  }

  const [thresholds, inspectionRecords, anomalyTickets, filters] =
    await Promise.all([
      getAllThresholds(),
      getAllInspectionRecords(),
      getAllAnomalyTickets(),
      getFilterConditions(),
    ]);

  const orderedThresholds = defaultThresholds
    .map((def) => thresholds.find((t) => t.area === def.area))
    .filter((t): t is AreaThreshold => !!t);

  return {
    thresholds: orderedThresholds.length > 0 ? orderedThresholds : defaultThresholds,
    inspectionRecords,
    anomalyTickets,
    filters,
    wasEmpty: empty,
  };
}

export {
  openDB,
  getAllThresholds,
  saveAllThresholds,
  getAllInspectionRecords,
  saveInspectionRecord,
  saveAllInspectionRecords,
  getAllAnomalyTickets,
  saveAnomalyTicket,
  saveAllAnomalyTickets,
  getFilterConditions,
  saveFilterConditions,
  isDatabaseEmpty,
  seedSampleData,
  clearAllData,
  loadAllData,
  backfillThreshold,
  backfillInspectionRecord,
  backfillAnomalyTicket,
  backfillFilterConditions,
};

export type { DBSchema, DBStoreName };
