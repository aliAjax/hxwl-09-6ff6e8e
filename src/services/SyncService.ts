import type {
  AnomalyTicket,
  AnomalyTrace,
  InspectionPlan,
  InspectionRecord,
  SyncAction,
  SyncEntityType,
  SyncItemStatus,
  SyncQueueDetailedStatus,
  SyncQueueItem,
  SyncStatus,
} from "../domain/models";
import type { AppRepository, RemoteSyncRepository, SyncResult } from "../repositories";
import { formatNow } from "../domain/rules";

type SyncableEntity = InspectionRecord | AnomalyTicket | InspectionPlan | AnomalyTrace;
type SyncedMarkEntity = InspectionRecord | AnomalyTicket | InspectionPlan | AnomalyTrace;

interface EntitySaveHandlerMap {
  inspectionRecord: (updated: InspectionRecord[]) => Promise<void>;
  anomalyTicket: (updated: AnomalyTicket[]) => Promise<void>;
  inspectionPlan: (updated: InspectionPlan[]) => Promise<void>;
  anomalyTrace: (updated: AnomalyTrace[]) => Promise<void>;
}

export class SyncService {
  private nextIdCache: number | null = null;
  private isProcessing = false;
  private queueChangeListeners: Set<() => void> = new Set();

  constructor(
    private repo: AppRepository,
    private remote: RemoteSyncRepository
  ) {}

  onQueueChange(callback: () => void): () => void {
    this.queueChangeListeners.add(callback);
    return () => this.queueChangeListeners.delete(callback);
  }

  private notifyQueueChange() {
    this.queueChangeListeners.forEach((l) => l());
  }

  isOnline(): boolean {
    return this.remote.isOnline();
  }

  onOnlineChange(callback: (online: boolean) => void): () => void {
    return this.remote.onOnlineChange(callback);
  }

  private async getNextId(): Promise<number> {
    if (this.nextIdCache === null) {
      this.nextIdCache = await this.repo.getNextSyncQueueId();
    }
    return this.nextIdCache++;
  }

  private buildFingerprint(
    entityType: SyncEntityType,
    entityId: number,
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
        String(snap.status ?? "")
      );
    } else if (entityType === "anomalyTicket") {
      keyParts.push(
        String(snap.roomId ?? ""),
        String(snap.createdAt ?? ""),
        String(snap.anomalyType ?? ""),
        String(snap.status ?? "")
      );
    } else if (entityType === "inspectionPlan") {
      keyParts.push(
        String(snap.date ?? ""),
        String(snap.area ?? ""),
        String(snap.inspector ?? ""),
        String(snap.status ?? "")
      );
    } else if (entityType === "anomalyTrace") {
      keyParts.push(
        String(snap.roomId ?? ""),
        String(snap.anomalyType ?? ""),
        String(snap.status ?? ""),
        String(snap.lastOccurredAt ?? "")
      );
    }

    return keyParts.join("|");
  }

  async enqueueEntity(
    entityType: SyncEntityType,
    entity: SyncableEntity,
    action: SyncAction = "update"
  ): Promise<SyncQueueItem | null> {
    const entityId = (entity as any).id as number;
    if (!entityId) return null;

    const fingerprint = this.buildFingerprint(entityType, entityId, action, entity);
    const existingQueue = await this.repo.getSyncQueue();

    const duplicate = existingQueue.find(
      (item) =>
        item.entityType === entityType &&
        item.entityId === entityId &&
        item.status !== "synced" &&
        item.syncFingerprint === fingerprint
    );
    if (duplicate) return duplicate;

    const sameEntityExisting = existingQueue.find(
      (item) =>
        item.entityType === entityType &&
        item.entityId === entityId &&
        (item.status === "pending" || item.status === "failed")
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
      this.repo.getAnomalyTraces ? this.repo.getAnomalyTraces() : Promise.resolve([]),
    ]);

    const existingQueue = await this.repo.getSyncQueue();
    const existingFingerprints = new Set(
      existingQueue
        .filter((i) => i.status !== "synced")
        .map((i) => `${i.entityType}:${i.entityId}`)
    );

    let created = 0;
    const tasks: Array<{ type: SyncEntityType; list: SyncableEntity[] }> = [
      { type: "inspectionRecord", list: records.filter((r) => !r.synced) },
      { type: "anomalyTicket", list: tickets.filter((t) => !t.synced) },
      { type: "inspectionPlan", list: plans.filter((p) => !p.synced) },
      { type: "anomalyTrace", list: traces.filter((t: any) => !t.synced) },
    ];

    for (const { type, list } of tasks) {
      for (const entity of list) {
        const key = `${type}:${(entity as any).id}`;
        if (existingFingerprints.has(key)) continue;
        const result = await this.enqueueEntity(type, entity, "create");
        if (result) created++;
      }
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
    }
  }

  private async pushSingle(item: SyncQueueItem): Promise<{
    success: boolean;
    errorMessage?: string;
  }> {
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
      default:
        return { success: false, errorMessage: "未知的实体类型" };
    }
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
          return i.status === "pending" || i.status === "failed";
        });
      }

      const detailedResults: SyncResult["detailedResults"] = [];
      const errors: string[] = [];
      let syncedRecords = 0;
      let syncedTickets = 0;
      let syncedPlans = 0;
      let syncedTraces = 0;

      for (const item of queue) {
        const updatedItem: SyncQueueItem = {
          ...item,
          status: "syncing",
          lastAttemptAt: formatNow(),
        };
        await this.repo.updateSyncQueueItem(updatedItem);
        this.notifyQueueChange();

        const result = await this.pushSingle(updatedItem);

        if (result.success) {
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
        errors,
        detailedResults,
      };
    } finally {
      this.isProcessing = false;
    }
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

  async getQueue(): Promise<SyncQueueItem[]> {
    return this.repo.getSyncQueue();
  }

  async getDetailedQueueStatus(): Promise<SyncQueueDetailedStatus> {
    const queue = await this.repo.getSyncQueue();
    let pending = 0;
    let syncing = 0;
    let failed = 0;
    let synced = 0;
    for (const item of queue) {
      if (item.status === "pending") pending++;
      else if (item.status === "syncing") syncing++;
      else if (item.status === "failed") failed++;
      else if (item.status === "synced") synced++;
    }
    return { pending, syncing, failed, synced, queue };
  }

  async getSyncStatus(): Promise<SyncStatus> {
    const [records, tickets, plans, detailedStatus] = await Promise.all([
      this.repo.getInspectionRecords(),
      this.repo.getAnomalyTickets(),
      this.repo.getInspectionPlans(),
      this.getDetailedQueueStatus(),
    ]);

    const queueByEntityFailed: Record<SyncEntityType, number> = {
      inspectionRecord: 0,
      anomalyTicket: 0,
      inspectionPlan: 0,
      anomalyTrace: 0,
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
      isOnline: this.remote.isOnline(),
      queueTotal: detailedStatus.queue.length,
      queuePending: detailedStatus.pending,
      queueFailed: detailedStatus.failed,
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
