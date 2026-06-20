import type {
  AnomalyTicket,
  AnomalyTrace,
  AreaThreshold,
  InspectionPlan,
  InspectionRecord,
  SyncAction,
  SyncConflict,
  SyncEntityType,
  SyncItemResult,
  SyncItemStatus,
  SyncQueueDetailedStatus,
  SyncQueueItem,
  SyncStatus,
} from "../domain/models";
import type { AppRepository, RemoteSyncRepository, SyncResult } from "../repositories";
import { formatNow } from "../domain/rules";

type SyncableEntity =
  | InspectionRecord
  | AnomalyTicket
  | InspectionPlan
  | AnomalyTrace
  | AreaThreshold;
type SyncedMarkEntity =
  | InspectionRecord
  | AnomalyTicket
  | InspectionPlan
  | AnomalyTrace;

interface EntitySaveHandlerMap {
  inspectionRecord: (updated: InspectionRecord[]) => Promise<void>;
  anomalyTicket: (updated: AnomalyTicket[]) => Promise<void>;
  inspectionPlan: (updated: InspectionPlan[]) => Promise<void>;
  anomalyTrace: (updated: AnomalyTrace[]) => Promise<void>;
}

export class SyncService {
  private nextIdCache: number | null = null;
  private nextConflictIdCache: number | null = null;
  private isProcessing = false;
  private queueChangeListeners: Set<() => void> = new Set();
  private conflictChangeListeners: Set<() => void> = new Set();

  constructor(
    private repo: AppRepository,
    private remote: RemoteSyncRepository
  ) {}

  onQueueChange(callback: () => void): () => void {
    this.queueChangeListeners.add(callback);
    return () => this.queueChangeListeners.delete(callback);
  }

  onConflictChange(callback: () => void): () => void {
    this.conflictChangeListeners.add(callback);
    return () => this.conflictChangeListeners.delete(callback);
  }

  private notifyQueueChange() {
    this.queueChangeListeners.forEach((l) => l());
  }

  private notifyConflictChange() {
    this.conflictChangeListeners.forEach((l) => l());
  }

  isOnline(): boolean {
    return this.remote.isOnline();
  }

  onOnlineChange(callback: (online: boolean) => void): () => void {
    return this.remote.onOnlineChange(callback);
  }

  setSimulateConflicts(enabled: boolean) {
    if (this.remote.setSimulateConflicts) {
      this.remote.setSimulateConflicts(enabled);
    }
  }

  private async getNextId(): Promise<number> {
    if (this.nextIdCache === null) {
      this.nextIdCache = await this.repo.getNextSyncQueueId();
    }
    return this.nextIdCache++;
  }

  private async getNextConflictId(): Promise<number> {
    if (this.nextConflictIdCache === null) {
      this.nextConflictIdCache = await this.repo.getNextSyncConflictId();
    }
    return this.nextConflictIdCache++;
  }

  bumpVersion<T extends { version?: number; updatedAt?: string }>(
    entity: T
  ): T {
    return {
      ...entity,
      version: (entity.version ?? 0) + 1,
      updatedAt: formatNow(),
    };
  }

  private buildFingerprint(
    entityType: SyncEntityType,
    entityId: number | string,
    action: SyncAction,
    snapshot: SyncableEntity
  ): string {
    const keyParts: string[] = [entityType, String(entityId), action];
    const snap = snapshot as any;

    if (entityType === "inspectionRecord") {
      keyParts.push(
        String(snap.roomId ?? ""),
        String(snap.createdAt ?? ""),
        String(snap.particle05um ?? ""),
        String(snap.status ?? ""),
        String(snap.version ?? "")
      );
    } else if (entityType === "anomalyTicket") {
      keyParts.push(
        String(snap.roomId ?? ""),
        String(snap.createdAt ?? ""),
        String(snap.anomalyType ?? ""),
        String(snap.status ?? ""),
        String(snap.version ?? "")
      );
    } else if (entityType === "inspectionPlan") {
      keyParts.push(
        String(snap.date ?? ""),
        String(snap.area ?? ""),
        String(snap.inspector ?? ""),
        String(snap.status ?? ""),
        String(snap.version ?? ""),
        Array.isArray(snap.linkedRecordIds)
          ? snap.linkedRecordIds.sort((a: number, b: number) => a - b).join(",")
          : ""
      );
    } else if (entityType === "anomalyTrace") {
      keyParts.push(
        String(snap.roomId ?? ""),
        String(snap.anomalyType ?? ""),
        String(snap.status ?? ""),
        String(snap.lastOccurredAt ?? ""),
        String(snap.version ?? "")
      );
    } else if (entityType === "threshold") {
      keyParts.push(
        String(snap.area ?? ""),
        String(snap.version ?? "")
      );
    }

    return keyParts.join("|");
  }

  async enqueueEntity(
    entityType: SyncEntityType,
    entity: SyncableEntity,
    action: SyncAction = "update"
  ): Promise<SyncQueueItem | null> {
    const entityId =
      entityType === "threshold"
        ? ((entity as AreaThreshold).area as unknown as number)
        : ((entity as any).id as number);
    if (!entityId && entityId !== 0) return null;

    const fingerprint = this.buildFingerprint(
      entityType,
      entityId,
      action,
      entity
    );
    const existingQueue = await this.repo.getSyncQueue();

    const duplicate = existingQueue.find(
      (item) =>
        item.entityType === entityType &&
        item.entityId === entityId &&
        item.status !== "synced" &&
        item.status !== "conflict" &&
        item.syncFingerprint === fingerprint
    );
    if (duplicate) return duplicate;

    const sameEntityExisting = existingQueue.find(
      (item) =>
        item.entityType === entityType &&
        item.entityId === entityId &&
        (item.status === "pending" ||
          item.status === "failed" ||
          item.status === "conflict")
    );

    let targetItem: SyncQueueItem;
    if (sameEntityExisting) {
      targetItem = {
        ...sameEntityExisting,
        action,
        status: "pending" as SyncItemStatus,
        errorMessage: undefined,
        dataSnapshot: entity as any,
        syncFingerprint: fingerprint,
        lastAttemptAt: undefined,
      };
      await this.repo.updateSyncQueueItem(targetItem);
    } else {
      const id = await this.getNextId();
      targetItem = {
        id,
        entityType,
        entityId,
        action,
        status: "pending",
        retryCount: 0,
        createdAt: formatNow(),
        dataSnapshot: entity as any,
        syncFingerprint: fingerprint,
      };
      await this.repo.saveSyncQueueItem(targetItem);
    }

    this.notifyQueueChange();
    return targetItem;
  }

  async migrateUnsyncedToQueue(): Promise<number> {
    const [records, tickets, plans, traces] = await Promise.all([
      this.repo.getInspectionRecords(),
      this.repo.getAnomalyTickets(),
      this.repo.getInspectionPlans(),
      this.repo.getAnomalyTraces
        ? this.repo.getAnomalyTraces()
        : Promise.resolve([]),
    ]);

    const existingQueue = await this.repo.getSyncQueue();
    const existingFingerprints = new Set(
      existingQueue
        .filter((i) => i.status !== "synced" && i.status !== "conflict")
        .map((i) => `${i.entityType}:${i.entityId}`)
    );

    let created = 0;
    const tasks: Array<{
      type: SyncEntityType;
      list: SyncableEntity[];
      saveAll: (items: any[]) => Promise<void>;
    }> = [
      {
        type: "inspectionRecord",
        list: records.filter((r) => !r.synced),
        saveAll: this.repo.saveAllInspectionRecords.bind(this.repo),
      },
      {
        type: "anomalyTicket",
        list: tickets.filter((t) => !t.synced),
        saveAll: this.repo.saveAllAnomalyTickets.bind(this.repo),
      },
      {
        type: "inspectionPlan",
        list: plans.filter((p) => !p.synced),
        saveAll: this.repo.saveAllInspectionPlans.bind(this.repo),
      },
      {
        type: "anomalyTrace",
        list: traces.filter((t: any) => !t.synced),
        saveAll: this.repo.saveAllAnomalyTraces?.bind(this.repo) ?? (async () => {}),
      },
    ];

    for (const { type, list, saveAll } of tasks) {
      let currentAllItems = [...(
        type === "inspectionRecord" ? records :
        type === "anomalyTicket" ? tickets :
        type === "inspectionPlan" ? plans : traces
      ) as any[]];
      
      for (const entity of list) {
        const key = `${type}:${(entity as any).id}`;
        if (existingFingerprints.has(key)) continue;
        
        const versioned = this.bumpVersion(entity);
        
        currentAllItems = currentAllItems.map((item: any) =>
          item.id === (entity as any).id ? versioned : item
        );
        
        const result = await this.enqueueEntity(type, versioned, "create");
        if (result) created++;
      }
      
      await saveAll(currentAllItems);
    }

    return created;
  }

  private async markEntitySynced(
    entityType: SyncEntityType,
    entityId: number
  ): Promise<void> {
    switch (entityType) {
      case "inspectionRecord": {
        const all = await this.repo.getInspectionRecords();
        const updated = all.map((r) =>
          r.id === entityId ? { ...r, synced: true } : r
        );
        await this.repo.saveAllInspectionRecords(updated);
        break;
      }
      case "anomalyTicket": {
        const all = await this.repo.getAnomalyTickets();
        const updated = all.map((t) =>
          t.id === entityId ? { ...t, synced: true } : t
        );
        await this.repo.saveAllAnomalyTickets(updated);
        break;
      }
      case "inspectionPlan": {
        const all = await this.repo.getInspectionPlans();
        const updated = all.map((p) =>
          p.id === entityId ? { ...p, synced: true } : p
        );
        await this.repo.saveAllInspectionPlans(updated);
        break;
      }
      case "anomalyTrace": {
        if (this.repo.getAnomalyTraces && this.repo.saveAllAnomalyTraces) {
          const all = await this.repo.getAnomalyTraces();
          const updated = all.map((t) =>
            (t as any).id === entityId ? { ...(t as any), synced: true } : t
          );
          await this.repo.saveAllAnomalyTraces(updated);
        }
        break;
      }
      case "threshold": {
        break;
      }
    }
  }

  private async replaceEntityLocal(
    entityType: SyncEntityType,
    entity: any
  ): Promise<void> {
    switch (entityType) {
      case "inspectionRecord": {
        const all = await this.repo.getInspectionRecords();
        const updated = all.map((r) =>
          r.id === entity.id ? { ...entity, synced: false } : r
        );
        await this.repo.saveAllInspectionRecords(updated);
        break;
      }
      case "anomalyTicket": {
        const all = await this.repo.getAnomalyTickets();
        const updated = all.map((t) =>
          t.id === entity.id ? { ...entity, synced: false } : t
        );
        await this.repo.saveAllAnomalyTickets(updated);
        break;
      }
      case "inspectionPlan": {
        const all = await this.repo.getInspectionPlans();
        const updated = all.map((p) =>
          p.id === entity.id ? { ...entity, synced: false } : p
        );
        await this.repo.saveAllInspectionPlans(updated);
        break;
      }
      case "anomalyTrace": {
        if (this.repo.getAnomalyTraces && this.repo.saveAllAnomalyTraces) {
          const all = await this.repo.getAnomalyTraces();
          const updated = all.map((t) =>
            (t as any).id === entity.id ? { ...entity, synced: false } : t
          );
          await this.repo.saveAllAnomalyTraces(updated);
        }
        break;
      }
      case "threshold": {
        const all = await this.repo.getThresholds();
        const updated = all.map((t) =>
          t.area === entity.area ? { ...entity } : t
        );
        await this.repo.saveThresholds(updated);
        break;
      }
    }
  }

  private async pushSingle(item: SyncQueueItem): Promise<SyncItemResult> {
    const snap = item.dataSnapshot;
    switch (item.entityType) {
      case "inspectionRecord":
        return this.remote.pushRecord(snap as InspectionRecord);
      case "anomalyTicket":
        return this.remote.pushTicket(snap as AnomalyTicket);
      case "inspectionPlan":
        return this.remote.pushPlan(snap as InspectionPlan);
      case "anomalyTrace":
        return this.remote.pushTrace(snap as AnomalyTrace);
      case "threshold":
        return this.remote.pushThreshold(snap as unknown as AreaThreshold);
      default:
        return {
          success: false,
          status: "failed",
          errorMessage: "未知的实体类型",
        };
    }
  }

  private async createConflictRecord(
    item: SyncQueueItem,
    result: SyncItemResult
  ): Promise<SyncConflict> {
    const id = await this.getNextConflictId();
    const localSnap = item.dataSnapshot as any;
    const conflict: SyncConflict = {
      id,
      entityType: item.entityType,
      entityId: item.entityId,
      detectedAt: formatNow(),
      localSnapshot: item.dataSnapshot,
      remoteSnapshot: result.remoteSnapshot ?? {},
      localVersion: localSnap?.version,
      remoteVersion: result.remoteVersion,
      localUpdatedAt: localSnap?.updatedAt,
      remoteUpdatedAt: result.remoteUpdatedAt,
      errorMessage: result.errorMessage,
    };
    await this.repo.saveSyncConflict(conflict);
    this.notifyConflictChange();
    return conflict;
  }

  async processQueue(
    scope: "all" | "pending" | "failed" = "all",
    itemIds?: number[]
  ): Promise<SyncResult> {
    if (this.isProcessing) {
      return {
        syncedRecords: 0,
        syncedTickets: 0,
        syncedPlans: 0,
        syncedTraces: 0,
        conflictedRecords: 0,
        conflictedTickets: 0,
        conflictedPlans: 0,
        conflictedTraces: 0,
        errors: ["同步正在进行中，请稍后再试"],
        detailedResults: [],
      };
    }

    if (!this.isOnline()) {
      return {
        syncedRecords: 0,
        syncedTickets: 0,
        syncedPlans: 0,
        syncedTraces: 0,
        conflictedRecords: 0,
        conflictedTickets: 0,
        conflictedPlans: 0,
        conflictedTraces: 0,
        errors: ["当前离线，无法同步"],
        detailedResults: [],
      };
    }

    this.isProcessing = true;
    try {
      let queue = await this.repo.getSyncQueue();

      if (itemIds && itemIds.length > 0) {
        const idSet = new Set(itemIds);
        queue = queue.filter((i) => idSet.has(i.id));
      } else {
        queue = queue.filter((i) => {
          if (scope === "pending") return i.status === "pending";
          if (scope === "failed") return i.status === "failed";
          return (
            i.status === "pending" ||
            i.status === "failed" ||
            i.status === "conflict"
          );
        });
      }

      const detailedResults: SyncResult["detailedResults"] = [];
      const errors: string[] = [];
      let syncedRecords = 0;
      let syncedTickets = 0;
      let syncedPlans = 0;
      let syncedTraces = 0;
      let conflictedRecords = 0;
      let conflictedTickets = 0;
      let conflictedPlans = 0;
      let conflictedTraces = 0;

      for (const item of queue) {
        const updatedItem: SyncQueueItem = {
          ...item,
          status: "syncing",
          lastAttemptAt: formatNow(),
        };
        await this.repo.updateSyncQueueItem(updatedItem);
        this.notifyQueueChange();

        const result = await this.pushSingle(updatedItem);

        if (result.status === "success") {
          const finalItem: SyncQueueItem = {
            ...updatedItem,
            status: "synced",
            syncedAt: formatNow(),
            errorMessage: undefined,
            retryCount: updatedItem.retryCount,
          };
          await this.repo.updateSyncQueueItem(finalItem);
          await this.markEntitySynced(item.entityType, item.entityId);

          if (item.entityType === "inspectionRecord") syncedRecords++;
          else if (item.entityType === "anomalyTicket") syncedTickets++;
          else if (item.entityType === "inspectionPlan") syncedPlans++;
          else if (item.entityType === "anomalyTrace") syncedTraces++;

          detailedResults.push({
            entityType: item.entityType,
            entityId: item.entityId,
            success: true,
            status: "success",
          });
        } else if (result.status === "conflict") {
          const conflict = await this.createConflictRecord(item, result);

          const finalItem: SyncQueueItem = {
            ...updatedItem,
            status: "conflict",
            errorMessage: result.errorMessage,
            retryCount: updatedItem.retryCount + 1,
          };
          await this.repo.updateSyncQueueItem(finalItem);

          if (result.errorMessage) {
            errors.push(result.errorMessage);
          }
          if (item.entityType === "inspectionRecord") conflictedRecords++;
          else if (item.entityType === "anomalyTicket")
            conflictedTickets++;
          else if (item.entityType === "inspectionPlan") conflictedPlans++;
          else if (item.entityType === "anomalyTrace")
            conflictedTraces++;

          detailedResults.push({
            entityType: item.entityType,
            entityId: item.entityId,
            success: false,
            status: "conflict",
            errorMessage: result.errorMessage,
            conflictId: conflict.id,
          });
        } else {
          const finalItem: SyncQueueItem = {
            ...updatedItem,
            status: "failed",
            errorMessage: result.errorMessage,
            retryCount: updatedItem.retryCount + 1,
          };
          await this.repo.updateSyncQueueItem(finalItem);

          if (result.errorMessage) {
            errors.push(result.errorMessage);
          }
          detailedResults.push({
            entityType: item.entityType,
            entityId: item.entityId,
            success: false,
            status: "failed",
            errorMessage: result.errorMessage,
          });
        }
        this.notifyQueueChange();
      }

      return {
        syncedRecords,
        syncedTickets,
        syncedPlans,
        syncedTraces,
        conflictedRecords,
        conflictedTickets,
        conflictedPlans,
        conflictedTraces,
        errors,
        detailedResults,
      };
    } finally {
      this.isProcessing = false;
    }
  }

  async resolveConflict(
    conflictId: number,
    resolution: "keepLocal" | "useRemote"
  ): Promise<{ success: boolean; errorMessage?: string }> {
    const conflicts = await this.repo.getSyncConflicts();
    const conflict = conflicts.find((c) => c.id === conflictId);
    if (!conflict) {
      return { success: false, errorMessage: "冲突记录不存在" };
    }

    try {
      if (resolution === "keepLocal") {
        const queueItem: SyncQueueItem | null = (
          await this.repo.getSyncQueue()
        ).find(
          (q) =>
            q.entityType === conflict.entityType &&
            q.entityId === conflict.entityId
        ) ?? null;

        if (queueItem) {
          const bumped = this.bumpVersion(queueItem.dataSnapshot as any);
          const reQueued: SyncQueueItem = {
            ...queueItem,
            status: "pending",
            dataSnapshot: bumped,
            errorMessage: undefined,
            syncFingerprint: this.buildFingerprint(
              conflict.entityType,
              conflict.entityId,
              queueItem.action,
              bumped
            ),
          };
          await this.repo.updateSyncQueueItem(reQueued);
          await this.replaceEntityLocal(conflict.entityType, bumped);
        }
      } else if (resolution === "useRemote") {
        await this.replaceEntityLocal(
          conflict.entityType,
          conflict.remoteSnapshot
        );

        const queue = await this.repo.getSyncQueue();
        const queueItem = queue.find(
          (q) =>
            q.entityType === conflict.entityType &&
            q.entityId === conflict.entityId
        );
        if (queueItem) {
          await this.repo.removeSyncQueueItem(queueItem.id);
        }
      }

      const resolved: SyncConflict = {
        ...conflict,
        resolvedAt: formatNow(),
        resolution,
      };
      await this.repo.updateSyncConflict(resolved);

      this.notifyQueueChange();
      this.notifyConflictChange();

      return { success: true };
    } catch (e: any) {
      return { success: false, errorMessage: e?.message ?? "解决冲突失败" };
    }
  }

  async getConflicts(): Promise<SyncConflict[]> {
    return this.repo.getSyncConflicts();
  }

  async getUnresolvedConflicts(): Promise<SyncConflict[]> {
    const all = await this.repo.getSyncConflicts();
    return all.filter((c) => !c.resolvedAt);
  }

  async retryItem(itemId: number): Promise<SyncResult> {
    return this.processQueue("all", [itemId]);
  }

  async retryAllFailed(): Promise<SyncResult> {
    return this.processQueue("failed");
  }

  async removeQueueItem(itemId: number): Promise<void> {
    await this.repo.removeSyncQueueItem(itemId);
    this.notifyQueueChange();
  }

  async clearSyncedItems(): Promise<void> {
    await this.repo.clearSyncedQueueItems();
    this.notifyQueueChange();
  }

  async clearResolvedConflicts(): Promise<void> {
    await this.repo.clearResolvedConflicts();
    this.notifyConflictChange();
  }

  async removeConflict(conflictId: number): Promise<void> {
    await this.repo.removeSyncConflict(conflictId);
    this.notifyConflictChange();
  }

  async getQueue(): Promise<SyncQueueItem[]> {
    return this.repo.getSyncQueue();
  }

  async getDetailedQueueStatus(): Promise<SyncQueueDetailedStatus> {
    const queue = await this.repo.getSyncQueue();
    let pending = 0;
    let syncing = 0;
    let failed = 0;
    let synced = 0;
    let conflict = 0;
    for (const item of queue) {
      if (item.status === "pending") pending++;
      else if (item.status === "syncing") syncing++;
      else if (item.status === "failed") failed++;
      else if (item.status === "synced") synced++;
      else if (item.status === "conflict") conflict++;
    }
    return { pending, syncing, failed, synced, conflict, queue } as any;
  }

  async getSyncStatus(): Promise<SyncStatus> {
    const [records, tickets, plans, detailedStatus, conflicts] =
      await Promise.all([
        this.repo.getInspectionRecords(),
        this.repo.getAnomalyTickets(),
        this.repo.getInspectionPlans(),
        this.getDetailedQueueStatus(),
        this.getUnresolvedConflicts(),
      ]);

    const queueByEntityFailed: Record<SyncEntityType, number> = {
      inspectionRecord: 0,
      anomalyTicket: 0,
      inspectionPlan: 0,
      anomalyTrace: 0,
      threshold: 0,
    };
    for (const item of detailedStatus.queue) {
      if (item.status === "failed") {
        queueByEntityFailed[item.entityType]++;
      }
    }

    return {
      pendingRecords: records.filter((r) => !r.synced).length,
      pendingTickets: tickets.filter((t) => !t.synced).length,
      pendingPlans: plans.filter((p) => !p.synced).length,
      failedRecords: queueByEntityFailed.inspectionRecord,
      failedTickets: queueByEntityFailed.anomalyTicket,
      failedPlans: queueByEntityFailed.inspectionPlan,
      conflictCount: conflicts.length,
      isOnline: this.remote.isOnline(),
      lastSyncAt: undefined,
      queueTotal: detailedStatus.queue.length,
      queuePending: detailedStatus.pending,
      queueFailed: detailedStatus.failed,
      queueConflict: (detailedStatus as any).conflict ?? 0,
    };
  }

  async pushPending(): Promise<SyncResult> {
    return this.processQueue("pending");
  }

  async pullRemote(): Promise<{
    thresholds: import("../domain/models").AreaThreshold[] | null;
    plans: InspectionPlan[] | null;
  }> {
    if (!this.remote.isOnline()) {
      return { thresholds: null, plans: null };
    }
    const [thresholds, plans] = await Promise.all([
      this.remote.pullThresholds(),
      this.remote.pullPlans(),
    ]);
    return { thresholds, plans };
  }

  markSynced<T extends { id: number; synced?: boolean }>(
    items: T[],
    syncedIds: Set<number>
  ): T[] {
    return items.map((item) =>
      syncedIds.has(item.id) ? { ...item, synced: true } : item
    );
  }
}
