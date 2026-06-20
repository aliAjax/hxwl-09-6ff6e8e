import type {
  AnomalyTicket,
  AnomalyTrace,
  AreaThreshold,
  InspectionPlan,
  InspectionRecord,
  SyncAction,
  SyncConflict,
  SyncEntityType,
  SyncQueueDetailedStatus,
  SyncQueueItem,
  SyncStatus,
} from "../domain/models";
import type { AppRepository, RemoteSyncRepository, SyncResult } from "../repositories";
import { SyncService } from "./SyncService";
import { formatNow } from "../domain/rules";

type SyncableEntity =
  | InspectionRecord
  | AnomalyTicket
  | InspectionPlan
  | AnomalyTrace
  | AreaThreshold;

interface EntitySaveHandlers {
  inspectionRecord: (updated: InspectionRecord[]) => Promise<void>;
  anomalyTicket: (updated: AnomalyTicket[]) => Promise<void>;
  inspectionPlan: (updated: InspectionPlan[]) => Promise<void>;
  anomalyTrace: (updated: AnomalyTrace[]) => Promise<void>;
  threshold: (updated: AreaThreshold[]) => Promise<void>;
}

interface EntityGetHandlers {
  inspectionRecord: () => Promise<InspectionRecord[]>;
  anomalyTicket: () => Promise<AnomalyTicket[]>;
  inspectionPlan: () => Promise<InspectionPlan[]>;
  anomalyTrace: () => Promise<AnomalyTrace[]>;
  threshold: () => Promise<AreaThreshold[]>;
}

type EntityUpdateFn<T> = (entity: T) => T;

export class SyncCoordinator {
  private syncService: SyncService;
  private repo: AppRepository;

  private queueChangeListeners: Set<() => void> = new Set();
  private conflictChangeListeners: Set<() => void> = new Set();
  private dataChangeListeners: Set<(entityType: SyncEntityType) => void> = new Set();

  private readonly entityGet: EntityGetHandlers;
  private readonly entitySave: EntitySaveHandlers;

  constructor(repo: AppRepository, remote: RemoteSyncRepository) {
    this.repo = repo;
    this.syncService = new SyncService(repo, remote);

    this.entityGet = {
      inspectionRecord: () => this.repo.getInspectionRecords(),
      anomalyTicket: () => this.repo.getAnomalyTickets(),
      inspectionPlan: () => this.repo.getInspectionPlans(),
      anomalyTrace: () => this.repo.getAnomalyTraces?.() ?? Promise.resolve([]),
      threshold: () => this.repo.getThresholds(),
    };

    this.entitySave = {
      inspectionRecord: (data) => this.repo.saveAllInspectionRecords(data),
      anomalyTicket: (data) => this.repo.saveAllAnomalyTickets(data),
      inspectionPlan: (data) => this.repo.saveAllInspectionPlans(data),
      anomalyTrace: (data) => this.repo.saveAllAnomalyTraces?.(data) ?? Promise.resolve(),
      threshold: (data) => this.repo.saveThresholds(data),
    };
  }

  onQueueChange(callback: () => void): () => void {
    this.queueChangeListeners.add(callback);
    return () => this.queueChangeListeners.delete(callback);
  }

  onConflictChange(callback: () => void): () => void {
    this.conflictChangeListeners.add(callback);
    return () => this.conflictChangeListeners.delete(callback);
  }

  onDataChange(callback: (entityType: SyncEntityType) => void): () => void {
    this.dataChangeListeners.add(callback);
    return () => this.dataChangeListeners.delete(callback);
  }

  private notifyQueueChange(): void {
    this.queueChangeListeners.forEach((l) => l());
  }

  private notifyConflictChange(): void {
    this.conflictChangeListeners.forEach((l) => l());
  }

  private notifyDataChange(entityType: SyncEntityType): void {
    this.dataChangeListeners.forEach((l) => l(entityType));
  }

  isOnline(): boolean {
    return this.syncService.isOnline();
  }

  onOnlineChange(callback: (online: boolean) => void): () => void {
    return this.syncService.onOnlineChange(callback);
  }

  setSimulateConflicts(enabled: boolean): void {
    this.syncService.setSimulateConflicts(enabled);
  }

  bumpVersion<T extends { version?: number; updatedAt?: string }>(entity: T): T {
    return this.syncService.bumpVersion(entity);
  }

  private async updateEntityInList<T extends { id?: number; area?: string }>(
    entityType: SyncEntityType,
    entityId: number | string,
    updater: EntityUpdateFn<T>
  ): Promise<T | null> {
    const getAll = this.entityGet[entityType as keyof EntityGetHandlers];
    const saveAll = this.entitySave[entityType as keyof EntitySaveHandlers];

    const all = (await getAll()) as unknown as T[];
    const idMatchFn = (item: T): boolean => {
      if (entityType === "threshold") {
        return (item as unknown as AreaThreshold).area === entityId;
      }
      return (item as any).id === entityId;
    };

    const index = all.findIndex(idMatchFn);
    if (index === -1) return null;

    const updatedEntity = updater(all[index]);
    all[index] = updatedEntity;

    await saveAll(all as any);
    this.notifyDataChange(entityType);

    return updatedEntity;
  }

  private async markSynced(
    entityType: SyncEntityType,
    entityId: number
  ): Promise<void> {
    await this.updateEntityInList(entityType, entityId, (entity) => ({
      ...entity,
      synced: true,
    } as any));
  }

  private async replaceLocal(
    entityType: SyncEntityType,
    entity: any
  ): Promise<void> {
    const entityId = entityType === "threshold" ? entity.area : entity.id;
    await this.updateEntityInList(entityType, entityId, () => ({
      ...entity,
      synced: false,
    }));
  }

  async updateRecord(
    record: InspectionRecord,
    action: SyncAction = "update"
  ): Promise<{ record: InspectionRecord; queueItem: SyncQueueItem | null }> {
    const updated = this.bumpVersion({ ...record, synced: false });
    const result = await this.updateEntityInList<InspectionRecord>(
      "inspectionRecord",
      record.id,
      () => updated
    );

    const queueItem = await this.syncService.enqueueEntity(
      "inspectionRecord",
      updated,
      action
    );
    this.notifyQueueChange();

    return { record: result ?? updated, queueItem };
  }

  async updateTicket(
    ticket: AnomalyTicket,
    action: SyncAction = "update"
  ): Promise<{ ticket: AnomalyTicket; queueItem: SyncQueueItem | null }> {
    const updated = this.bumpVersion({ ...ticket, synced: false });
    const result = await this.updateEntityInList<AnomalyTicket>(
      "anomalyTicket",
      ticket.id,
      () => updated
    );

    const queueItem = await this.syncService.enqueueEntity(
      "anomalyTicket",
      updated,
      action
    );
    this.notifyQueueChange();

    return { ticket: result ?? updated, queueItem };
  }

  async updatePlan(
    plan: InspectionPlan,
    action: SyncAction = "update"
  ): Promise<{ plan: InspectionPlan; queueItem: SyncQueueItem | null }> {
    const updated = this.bumpVersion({ ...plan, synced: false });
    const result = await this.updateEntityInList<InspectionPlan>(
      "inspectionPlan",
      plan.id,
      () => updated
    );

    const queueItem = await this.syncService.enqueueEntity(
      "inspectionPlan",
      updated,
      action
    );
    this.notifyQueueChange();

    return { plan: result ?? updated, queueItem };
  }

  async updateTrace(
    trace: AnomalyTrace,
    action: SyncAction = "update"
  ): Promise<{ trace: AnomalyTrace; queueItem: SyncQueueItem | null }> {
    const updated = this.bumpVersion({ ...trace, synced: false });
    const result = await this.updateEntityInList<AnomalyTrace>(
      "anomalyTrace",
      trace.id,
      () => updated
    );

    const queueItem = await this.syncService.enqueueEntity(
      "anomalyTrace",
      updated,
      action
    );
    this.notifyQueueChange();

    return { trace: result ?? updated, queueItem };
  }

  async updateThreshold(
    threshold: AreaThreshold,
    action: SyncAction = "update"
  ): Promise<{ threshold: AreaThreshold; queueItem: SyncQueueItem | null }> {
    const updated = this.bumpVersion(threshold);
    const result = await this.updateEntityInList<AreaThreshold>(
      "threshold",
      threshold.area,
      () => updated
    );

    const queueItem = await this.syncService.enqueueEntity(
      "threshold",
      updated,
      action
    );
    this.notifyQueueChange();

    return { threshold: result ?? updated, queueItem };
  }

  async updateThresholds(
    thresholds: AreaThreshold[]
  ): Promise<{ thresholds: AreaThreshold[]; queueItems: SyncQueueItem[] }> {
    const getAll = this.entityGet.threshold;
    const saveAll = this.entitySave.threshold;

    const prev = await getAll();
    const queueItems: SyncQueueItem[] = [];
    const finalThresholds: AreaThreshold[] = [];

    for (const th of thresholds) {
      const prevTh = prev.find((p) => p.area === th.area);
      const isChanged = !prevTh || this.isThresholdChanged(prevTh, th);

      if (isChanged) {
        const updated = this.bumpVersion(th);
        finalThresholds.push(updated);
        const queueItem = await this.syncService.enqueueEntity(
          "threshold",
          updated,
          "update"
        );
        if (queueItem) {
          queueItems.push(queueItem);
        }
      } else {
        finalThresholds.push(th);
      }
    }

    await saveAll(finalThresholds);
    this.notifyDataChange("threshold");
    if (queueItems.length > 0) {
      this.notifyQueueChange();
    }

    return { thresholds: finalThresholds, queueItems };
  }

  private isThresholdChanged(a: AreaThreshold, b: AreaThreshold): boolean {
    if (a.area !== b.area) return true;
    if (a.particle05um !== b.particle05um) return true;
    if (a.particle5um !== b.particle5um) return true;
    if (a.pressure?.min !== b.pressure?.min) return true;
    if (a.pressure?.max !== b.pressure?.max) return true;
    if (a.temperature?.min !== b.temperature?.min) return true;
    if (a.temperature?.max !== b.temperature?.max) return true;
    if (a.humidity?.min !== b.humidity?.min) return true;
    if (a.humidity?.max !== b.humidity?.max) return true;
    return false;
  }

  async addRecord(
    record: InspectionRecord
  ): Promise<{ record: InspectionRecord; queueItem: SyncQueueItem | null }> {
    const getAll = this.entityGet.inspectionRecord;
    const saveAll = this.entitySave.inspectionRecord;

    const updated = this.bumpVersion({ ...record, synced: false });
    const all = await getAll();
    all.unshift(updated);
    await saveAll(all);
    this.notifyDataChange("inspectionRecord");

    const queueItem = await this.syncService.enqueueEntity(
      "inspectionRecord",
      updated,
      "create"
    );
    this.notifyQueueChange();

    return { record: updated, queueItem };
  }

  async addTicket(
    ticket: AnomalyTicket
  ): Promise<{ ticket: AnomalyTicket; queueItem: SyncQueueItem | null }> {
    const getAll = this.entityGet.anomalyTicket;
    const saveAll = this.entitySave.anomalyTicket;

    const updated = this.bumpVersion({ ...ticket, synced: false });
    const all = await getAll();
    all.push(updated);
    await saveAll(all);
    this.notifyDataChange("anomalyTicket");

    const queueItem = await this.syncService.enqueueEntity(
      "anomalyTicket",
      updated,
      "create"
    );
    this.notifyQueueChange();

    return { ticket: updated, queueItem };
  }

  async addPlan(
    plan: InspectionPlan
  ): Promise<{ plan: InspectionPlan; queueItem: SyncQueueItem | null }> {
    const getAll = this.entityGet.inspectionPlan;
    const saveAll = this.entitySave.inspectionPlan;

    const updated = this.bumpVersion({ ...plan, synced: false });
    const all = await getAll();
    all.unshift(updated);
    await saveAll(all);
    this.notifyDataChange("inspectionPlan");

    const queueItem = await this.syncService.enqueueEntity(
      "inspectionPlan",
      updated,
      "create"
    );
    this.notifyQueueChange();

    return { plan: updated, queueItem };
  }

  async addTrace(
    trace: AnomalyTrace
  ): Promise<{ trace: AnomalyTrace; queueItem: SyncQueueItem | null }> {
    const getAll = this.entityGet.anomalyTrace;
    const saveAll = this.entitySave.anomalyTrace;

    const updated = this.bumpVersion({ ...trace, synced: false });
    const all = await getAll();
    all.unshift(updated);
    await saveAll(all);
    this.notifyDataChange("anomalyTrace");

    const queueItem = await this.syncService.enqueueEntity(
      "anomalyTrace",
      updated,
      "create"
    );
    this.notifyQueueChange();

    return { trace: updated, queueItem };
  }

  async processQueue(
    scope: "all" | "pending" | "failed" = "all",
    itemIds?: number[]
  ): Promise<SyncResult> {
    const originalMarkSynced = (this.syncService as any).markEntitySynced.bind(
      this.syncService
    );
    const originalReplaceLocal = (this.syncService as any).replaceEntityLocal.bind(
      this.syncService
    );

    (this.syncService as any).markEntitySynced = async (
      entityType: SyncEntityType,
      entityId: number
    ) => {
      await this.markSynced(entityType, entityId);
    };

    (this.syncService as any).replaceEntityLocal = async (
      entityType: SyncEntityType,
      entity: any
    ) => {
      await this.replaceLocal(entityType, entity);
      this.notifyDataChange(entityType);
    };

    try {
      const result = await this.syncService.processQueue(scope, itemIds);

      const syncedTypes = new Set<SyncEntityType>();
      for (const r of result.detailedResults) {
        if (r.success) {
          syncedTypes.add(r.entityType);
        }
      }
      syncedTypes.forEach((t) => this.notifyDataChange(t));

      this.notifyQueueChange();
      if (result.conflictedRecords + result.conflictedTickets + result.conflictedPlans + result.conflictedTraces > 0) {
        this.notifyConflictChange();
      }

      return result;
    } finally {
      (this.syncService as any).markEntitySynced = originalMarkSynced;
      (this.syncService as any).replaceEntityLocal = originalReplaceLocal;
    }
  }

  async resolveConflict(
    conflictId: number,
    resolution: "keepLocal" | "useRemote"
  ): Promise<{ success: boolean; errorMessage?: string }> {
    const originalReplaceLocal = (this.syncService as any).replaceEntityLocal.bind(
      this.syncService
    );

    (this.syncService as any).replaceEntityLocal = async (
      entityType: SyncEntityType,
      entity: any
    ) => {
      await this.replaceLocal(entityType, entity);
      this.notifyDataChange(entityType);
    };

    try {
      const result = await this.syncService.resolveConflict(
        conflictId,
        resolution
      );

      if (result.success) {
        const conflicts = await this.syncService.getConflicts();
        const conflict = conflicts.find((c) => c.id === conflictId);
        if (conflict && resolution === "useRemote") {
          this.notifyDataChange(conflict.entityType);
        }
        this.notifyQueueChange();
        this.notifyConflictChange();
      }

      return result;
    } finally {
      (this.syncService as any).replaceEntityLocal = originalReplaceLocal;
    }
  }

  async pushPending(): Promise<SyncResult> {
    return this.processQueue("pending");
  }

  async retryItem(itemId: number): Promise<SyncResult> {
    return this.processQueue("all", [itemId]);
  }

  async retryAllFailed(): Promise<SyncResult> {
    return this.processQueue("failed");
  }

  async removeQueueItem(itemId: number): Promise<void> {
    await this.syncService.removeQueueItem(itemId);
    this.notifyQueueChange();
  }

  async clearSyncedQueueItems(): Promise<void> {
    await this.syncService.clearSyncedItems();
    this.notifyQueueChange();
  }

  async clearResolvedConflicts(): Promise<void> {
    await this.syncService.clearResolvedConflicts();
    this.notifyConflictChange();
  }

  async removeConflict(conflictId: number): Promise<void> {
    await this.syncService.removeConflict(conflictId);
    this.notifyConflictChange();
  }

  async migrateUnsyncedToQueue(): Promise<number> {
    const count = await this.syncService.migrateUnsyncedToQueue();
    if (count > 0) {
      this.notifyQueueChange();
    }
    return count;
  }

  async getSyncStatus(): Promise<SyncStatus> {
    return this.syncService.getSyncStatus();
  }

  async getQueue(): Promise<SyncQueueItem[]> {
    return this.syncService.getQueue();
  }

  async getDetailedQueueStatus(): Promise<SyncQueueDetailedStatus> {
    return this.syncService.getDetailedQueueStatus();
  }

  async getConflicts(): Promise<SyncConflict[]> {
    return this.syncService.getConflicts();
  }

  async getUnresolvedConflicts(): Promise<SyncConflict[]> {
    return this.syncService.getUnresolvedConflicts();
  }

  async getEntity<T extends SyncableEntity>(
    entityType: SyncEntityType
  ): Promise<T[]> {
    const handler = this.entityGet[entityType as keyof EntityGetHandlers];
    return (await handler()) as T[];
  }

  async saveAllRecords(records: InspectionRecord[]): Promise<void> {
    await this.entitySave.inspectionRecord(records);
    this.notifyDataChange("inspectionRecord");
  }

  async saveAllTickets(tickets: AnomalyTicket[]): Promise<void> {
    await this.entitySave.anomalyTicket(tickets);
    this.notifyDataChange("anomalyTicket");
  }

  async saveAllPlans(plans: InspectionPlan[]): Promise<void> {
    await this.entitySave.inspectionPlan(plans);
    this.notifyDataChange("inspectionPlan");
  }

  async saveAllTraces(traces: AnomalyTrace[]): Promise<void> {
    await this.entitySave.anomalyTrace(traces);
    this.notifyDataChange("anomalyTrace");
  }

  async saveAllThresholds(thresholds: AreaThreshold[]): Promise<void> {
    await this.entitySave.threshold(thresholds);
    this.notifyDataChange("threshold");
  }

  async enqueueEntity(
    entityType: SyncEntityType,
    entity: SyncableEntity,
    action: SyncAction = "update"
  ): Promise<SyncQueueItem | null> {
    const versioned = this.bumpVersion({ ...entity, synced: false });

    const entityId = entityType === "threshold" 
      ? (versioned as AreaThreshold).area 
      : (versioned as any).id;
    await this.updateEntityInList(
      entityType,
      entityId,
      () => versioned
    );

    const item = await this.syncService.enqueueEntity(
      entityType,
      versioned,
      action
    );
    if (item) {
      this.notifyQueueChange();
    }
    return item;
  }
}
