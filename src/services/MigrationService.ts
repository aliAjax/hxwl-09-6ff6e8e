import type {
  AnomalyTicket,
  AnomalyTrace,
  AreaThreshold,
  BackupData,
  FilterConditions,
  InspectionPlan,
  InspectionRecord,
  MigrationContext,
  MigrationFailedRecord,
  MigrationLog,
  MigrationStatus,
  SyncQueueItem,
} from "../domain/models";
import {
  APP_VERSION,
  DB_NAME,
  DB_STORE_NAMES,
  DB_VERSION,
  DEFAULT_FILTERS,
  DEFAULT_PLANS,
  DEFAULT_THRESHOLDS,
  DEFAULT_TICKETS,
  DEFAULT_TRACES,
} from "../domain/constants";
import { formatNow } from "../domain/rules";
import { localDBRepository } from "../repositories/LocalDBRepository";
import { exportService } from "./ExportService";

interface MigrationScript {
  version: number;
  name: string;
  description: string;
  up: (db: IDBDatabase, tx: IDBTransaction, context: MigrationRunContext) => Promise<void>;
}

interface MigrationRunContext {
  logs: MigrationLog[];
  failedRecords: MigrationFailedRecord[];
  nextLogId: number;
  nextFailedRecordId: number;
  fromVersion: number;
  toVersion: number;
}

const versionScripts: MigrationScript[] = [
  {
    version: 1,
    name: "v1_initial_schema",
    description: "初始化基础表结构：阈值、巡检记录、异常工单、筛选条件",
    up: async (db, tx, context) => {
      const stores = [
        DB_STORE_NAMES.thresholds,
        DB_STORE_NAMES.inspectionRecords,
        DB_STORE_NAMES.anomalyTickets,
        DB_STORE_NAMES.filters,
      ];
      for (const storeName of stores) {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, {
            keyPath: storeName === DB_STORE_NAMES.filters ? "key" : "id",
          });
          store.createIndex("id", "id", { unique: true });
          if (storeName === DB_STORE_NAMES.inspectionRecords) {
            store.createIndex("roomId", "roomId", { unique: false });
            store.createIndex("area", "area", { unique: false });
            store.createIndex("createdAt", "createdAt", { unique: false });
          }
          if (storeName === DB_STORE_NAMES.anomalyTickets) {
            store.createIndex("roomId", "roomId", { unique: false });
            store.createIndex("area", "area", { unique: false });
            store.createIndex("status", "status", { unique: false });
            store.createIndex("sourceRecordId", "sourceRecordId", { unique: false });
          }
        }
      }
      await logMigrationSuccess(context, 1, stores.length);
    },
  },
  {
    version: 2,
    name: "v2_add_inspection_plans",
    description: "新增巡检计划表",
    up: async (db, tx, context) => {
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
      await migrateStoreData(
        db,
        tx,
        context,
        DB_STORE_NAMES.inspectionPlans,
        backfillInspectionPlan
      );
      await logMigrationSuccess(context, 2, 0);
    },
  },
  {
    version: 3,
    name: "v3_add_anomaly_traces",
    description: "新增异常追踪表",
    up: async (db, tx, context) => {
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
      await migrateStoreData(
        db,
        tx,
        context,
        DB_STORE_NAMES.anomalyTraces,
        backfillAnomalyTrace
      );
      await logMigrationSuccess(context, 3, 0);
    },
  },
  {
    version: 4,
    name: "v4_add_sync_queue",
    description: "新增同步队列表，支持离线数据同步",
    up: async (db, tx, context) => {
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
      await logMigrationSuccess(context, 4, 0);
    },
  },
  {
    version: 5,
    name: "v5_add_migration_system",
    description: "新增迁移日志和失败记录表，建立完整的数据版本化迁移机制",
    up: async (db, tx, context) => {
      if (!db.objectStoreNames.contains(DB_STORE_NAMES.migrationLogs)) {
        const store = db.createObjectStore(DB_STORE_NAMES.migrationLogs, {
          keyPath: "id",
        });
        store.createIndex("id", "id", { unique: true });
        store.createIndex("version", "version", { unique: false });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("startTime", "startTime", { unique: false });
      }
      if (!db.objectStoreNames.contains(DB_STORE_NAMES.migrationFailedRecords)) {
        const store = db.createObjectStore(DB_STORE_NAMES.migrationFailedRecords, {
          keyPath: "id",
        });
        store.createIndex("id", "id", { unique: true });
        store.createIndex("migrationVersion", "migrationVersion", { unique: false });
        store.createIndex("storeName", "storeName", { unique: false });
        store.createIndex("failedAt", "failedAt", { unique: false });
      }

      await Promise.all([
        migrateStoreData(
          db,
          tx,
          context,
          DB_STORE_NAMES.thresholds,
          backfillThreshold
        ),
        migrateStoreData(
          db,
          tx,
          context,
          DB_STORE_NAMES.inspectionRecords,
          backfillInspectionRecord
        ),
        migrateStoreData(
          db,
          tx,
          context,
          DB_STORE_NAMES.anomalyTickets,
          backfillAnomalyTicket
        ),
        migrateStoreData(
          db,
          tx,
          context,
          DB_STORE_NAMES.inspectionPlans,
          backfillInspectionPlan
        ),
        migrateStoreData(
          db,
          tx,
          context,
          DB_STORE_NAMES.filters,
          backfillFilterConditions
        ),
        migrateStoreData(
          db,
          tx,
          context,
          DB_STORE_NAMES.anomalyTraces,
          backfillAnomalyTrace
        ),
      ]);

      await logMigrationSuccess(context, 5, 0);
    },
  },
];

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
    createdAt:
      data.createdAt ??
      new Date().toISOString().slice(0, 16).replace("T", " "),
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
    firstOccurredAt:
      data.firstOccurredAt ??
      new Date().toISOString().slice(0, 16).replace("T", " "),
    lastOccurredAt:
      data.lastOccurredAt ??
      new Date().toISOString().slice(0, 16).replace("T", " "),
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

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function logMigrationStart(
  context: MigrationRunContext,
  version: number,
  name: string
): Promise<void> {
  const log: MigrationLog = {
    id: context.nextLogId++,
    version,
    name,
    status: "running",
    startTime: formatNow(),
  };
  context.logs.push(log);
  console.log(`[Migration] 开始执行 v${version} - ${name}`);
}

async function logMigrationSuccess(
  context: MigrationRunContext,
  version: number,
  recordsProcessed: number
): Promise<void> {
  const log = context.logs.find((l) => l.version === version && l.status === "running");
  if (log) {
    log.status = "success";
    log.endTime = formatNow();
    log.durationMs =
      new Date(log.endTime).getTime() - new Date(log.startTime).getTime();
    log.recordsProcessed = recordsProcessed;
    log.recordsFailed = 0;
    console.log(
      `[Migration] v${version} 执行成功，耗时 ${log.durationMs}ms，处理 ${recordsProcessed} 条记录`
    );
  }
}

async function logMigrationFailure(
  context: MigrationRunContext,
  version: number,
  error: unknown,
  recordsFailed: number = 0
): Promise<void> {
  const log = context.logs.find((l) => l.version === version && l.status === "running");
  if (log) {
    log.status = "failed";
    log.endTime = formatNow();
    log.durationMs =
      new Date(log.endTime).getTime() - new Date(log.startTime).getTime();
    log.recordsFailed = recordsFailed;
    log.errorMessage = error instanceof Error ? error.message : String(error);
    log.errorStack = error instanceof Error ? error.stack : undefined;
    console.error(
      `[Migration] v${version} 执行失败: ${log.errorMessage}`,
      error
    );
  }
}

async function migrateStoreData(
  db: IDBDatabase,
  tx: IDBTransaction,
  context: MigrationRunContext,
  storeName: string,
  backfillFn: (data: any) => any
): Promise<void> {
  if (!db.objectStoreNames.contains(storeName)) {
    return;
  }

  const store = tx.objectStore(storeName);
  const records = await promisifyRequest<any[]>(store.getAll() as IDBRequest<any[]>);
  let processed = 0;
  let failed = 0;

  for (const record of records) {
    try {
      const backfilled = backfillFn(record);
      const keyPath = store.keyPath as string;
      const recordId = keyPath ? record[keyPath] : record.id ?? record.area ?? "main";
      await promisifyRequest(store.put(backfilled));
      processed++;
    } catch (error) {
      failed++;
      const keyPath = store.keyPath as string;
      const recordId = keyPath ? record[keyPath] : record.id ?? record.area ?? "main";
      const failedRecord: MigrationFailedRecord = {
        id: context.nextFailedRecordId++,
        migrationVersion: context.toVersion,
        storeName,
        recordId,
        originalData: JSON.parse(JSON.stringify(record)),
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        failedAt: formatNow(),
      };
      context.failedRecords.push(failedRecord);
      console.error(
        `[Migration] 迁移失败: store=${storeName}, id=${recordId}`,
        error
      );
    }
  }

  const lastLog = context.logs[context.logs.length - 1];
  if (lastLog && lastLog.status === "running") {
    lastLog.recordsProcessed = (lastLog.recordsProcessed || 0) + processed;
    lastLog.recordsFailed = (lastLog.recordsFailed || 0) + failed;
  }
}

export class MigrationService {
  private currentDbVersion: number = 0;

  async getCurrentDbVersion(): Promise<number> {
    return new Promise((resolve) => {
      const req = indexedDB.open(DB_NAME);
      req.onsuccess = () => {
        const db = req.result;
        this.currentDbVersion = db.version;
        db.close();
        resolve(db.version);
      };
      req.onerror = () => {
        resolve(0);
      };
    });
  }

  async needsMigration(): Promise<boolean> {
    const currentVersion = await this.getCurrentDbVersion();
    return currentVersion < DB_VERSION;
  }

  async runMigrations(): Promise<MigrationContext> {
    const fromVersion = await this.getCurrentDbVersion();
    const toVersion = DB_VERSION;

    const context: MigrationRunContext = {
      logs: [],
      failedRecords: [],
      nextLogId: 1,
      nextFailedRecordId: 1,
      fromVersion,
      toVersion,
    };

    console.log(
      `[Migration] 开始数据迁移: v${fromVersion} -> v${toVersion}`
    );

    if (fromVersion >= toVersion) {
      console.log(`[Migration] 数据库已是最新版本 v${toVersion}，无需迁移`);
      return {
        fromVersion,
        toVersion,
        logs: [],
        failedRecords: [],
      };
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, toVersion);

      request.onerror = () => {
        console.error("[Migration] 数据库打开失败:", request.error);
        reject(request.error);
      };

      request.onblocked = () => {
        console.warn("[Migration] 数据库迁移被阻塞，请关闭其他标签页");
      };

      request.onupgradeneeded = async (event) => {
        const db = request.result;
        const tx = request.transaction;
        if (!tx) {
          reject(new Error("无法获取升级事务"));
          return;
        }

        try {
          const oldVersion = event.oldVersion || 0;
          const scriptsToRun = versionScripts.filter(
            (s) => s.version > oldVersion && s.version <= toVersion
          );

          for (const script of scriptsToRun) {
            await logMigrationStart(context, script.version, script.name);
            try {
              await script.up(db, tx, context);
            } catch (error) {
              await logMigrationFailure(context, script.version, error);
            }
          }
        } catch (error) {
          console.error("[Migration] 迁移过程发生错误:", error);
          reject(error);
        }
      };

      request.onsuccess = async () => {
        const db = request.result;
        try {
          await this.saveMigrationResults(context, db);
          db.close();
          this.currentDbVersion = toVersion;

          const successCount = context.logs.filter(
            (l) => l.status === "success"
          ).length;
          const failedCount = context.logs.filter(
            (l) => l.status === "failed"
          ).length;

          console.log(
            `[Migration] 迁移完成: ${successCount} 成功, ${failedCount} 失败, ${context.failedRecords.length} 条记录迁移失败`
          );

          resolve({
            fromVersion,
            toVersion,
            logs: context.logs,
            failedRecords: context.failedRecords,
          });
        } catch (error) {
          db.close();
          reject(error);
        }
      };
    });
  }

  private async saveMigrationResults(
    context: MigrationRunContext,
    db: IDBDatabase
  ): Promise<void> {
    if (
      !db.objectStoreNames.contains(DB_STORE_NAMES.migrationLogs) ||
      !db.objectStoreNames.contains(DB_STORE_NAMES.migrationFailedRecords)
    ) {
      return;
    }

    const tx = db.transaction(
      [DB_STORE_NAMES.migrationLogs, DB_STORE_NAMES.migrationFailedRecords],
      "readwrite"
    );
    const logStore = tx.objectStore(DB_STORE_NAMES.migrationLogs);
    const failedStore = tx.objectStore(DB_STORE_NAMES.migrationFailedRecords);

    for (const log of context.logs) {
      await promisifyRequest(logStore.put(log));
    }

    for (const failed of context.failedRecords) {
      await promisifyRequest(failedStore.put(failed));
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getMigrationLogs(): Promise<MigrationLog[]> {
    try {
      return await localDBRepository.getMigrationLogs();
    } catch {
      return [];
    }
  }

  async getFailedRecords(): Promise<MigrationFailedRecord[]> {
    try {
      return await localDBRepository.getMigrationFailedRecords();
    } catch {
      return [];
    }
  }

  async backupAllData(): Promise<BackupData> {
    const [
      thresholds,
      inspectionRecords,
      anomalyTickets,
      inspectionPlans,
      anomalyTraces,
      filters,
      syncQueue,
    ] = await Promise.all([
      localDBRepository.getThresholds(),
      localDBRepository.getInspectionRecords(),
      localDBRepository.getAnomalyTickets(),
      localDBRepository.getInspectionPlans(),
      localDBRepository.getAnomalyTraces(),
      localDBRepository.getFilters(),
      localDBRepository.getSyncQueue(),
    ]);

    const backup: BackupData = {
      exportedAt: formatNow(),
      dbVersion: this.currentDbVersion || (await this.getCurrentDbVersion()),
      appVersion: APP_VERSION,
      data: {
        thresholds,
        inspectionRecords,
        anomalyTickets,
        inspectionPlans,
        filters,
        anomalyTraces,
        syncQueue,
      },
    };

    return backup;
  }

  downloadBackup(backup: BackupData): void {
    const fileName = `数据备份_v${backup.dbVersion}_${backup.exportedAt
      .slice(0, 16)
      .replace(/[-: ]/g, "")}.json`;
    exportService.downloadJson(backup, fileName);
  }

  async backupAndDownload(): Promise<BackupData> {
    const backup = await this.backupAllData();
    this.downloadBackup(backup);
    return backup;
  }

  async restoreBackup(backup: BackupData): Promise<boolean> {
    try {
      await localDBRepository.clearAll();

      const { data } = backup;
      await Promise.all([
        localDBRepository.saveThresholds(data.thresholds),
        localDBRepository.saveAllInspectionRecords(data.inspectionRecords),
        localDBRepository.saveAllAnomalyTickets(data.anomalyTickets),
        localDBRepository.saveAllInspectionPlans(data.inspectionPlans),
        localDBRepository.saveAllAnomalyTraces(data.anomalyTraces),
        localDBRepository.saveFilters(data.filters),
        localDBRepository.saveAllSyncQueueItems(data.syncQueue),
      ]);

      console.log(`[Migration] 数据恢复成功，来自备份 v${backup.dbVersion}`);
      return true;
    } catch (error) {
      console.error("[Migration] 数据恢复失败:", error);
      return false;
    }
  }

  async validateBackup(backup: BackupData): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!backup || typeof backup !== "object") {
      errors.push("备份文件格式无效");
      return { valid: false, errors, warnings };
    }

    if (!backup.data || typeof backup.data !== "object") {
      errors.push("备份文件缺少 data 字段");
      return { valid: false, errors, warnings };
    }

    const requiredStores: (keyof BackupData["data"])[] = [
      "thresholds",
      "inspectionRecords",
      "anomalyTickets",
      "inspectionPlans",
      "filters",
      "anomalyTraces",
      "syncQueue",
    ];

    for (const store of requiredStores) {
      if (!(store in backup.data)) {
        errors.push(`备份文件缺少 ${store} 数据`);
      }
    }

    if (backup.dbVersion && backup.dbVersion > DB_VERSION) {
      warnings.push(
        `备份数据版本 v${backup.dbVersion} 高于当前数据库版本 v${DB_VERSION}，部分字段可能不兼容`
      );
    }

    if (backup.appVersion && backup.appVersion !== APP_VERSION) {
      warnings.push(
        `备份应用版本 ${backup.appVersion} 与当前版本 ${APP_VERSION} 不一致`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async resetToSampleData(): Promise<void> {
    await localDBRepository.clearAll();
    await localDBRepository.seedDefaults();
    console.log("[Migration] 已重置为示例数据");
  }

  async getMigrationSummary(): Promise<{
    currentVersion: number;
    latestVersion: number;
    needsMigration: boolean;
    lastMigration?: MigrationLog;
    totalFailedRecords: number;
  }> {
    const currentVersion = await this.getCurrentDbVersion();
    const logs = await this.getMigrationLogs();
    const failedRecords = await this.getFailedRecords();

    const lastMigration = logs
      .filter((l) => l.status === "success" || l.status === "failed")
      .sort((a, b) => (b.endTime ?? "").localeCompare(a.endTime ?? ""))[0];

    return {
      currentVersion,
      latestVersion: DB_VERSION,
      needsMigration: currentVersion < DB_VERSION,
      lastMigration,
      totalFailedRecords: failedRecords.length,
    };
  }
}

export const migrationService = new MigrationService();
