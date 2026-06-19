import type {
  AnomalyTicket,
  AnomalyTrace,
  AreaThreshold,
  FilterConditions,
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
import { ThresholdService } from "./ThresholdService";
import { InspectionService } from "./InspectionService";
import { TicketService } from "./TicketService";
import { PlanService } from "./PlanService";
import { ExportService } from "./ExportService";
import { SyncCoordinator } from "./SyncCoordinator";
import { FilterService } from "./FilterService";
import { AnomalyTraceService } from "./AnomalyTraceService";

export interface AppState {
  thresholds: AreaThreshold[];
  inspectionRecords: InspectionRecord[];
  anomalyTickets: AnomalyTicket[];
  anomalyTraces: AnomalyTrace[];
  inspectionPlans: InspectionPlan[];
  filters: FilterConditions;
  syncStatus: SyncStatus;
  syncQueue: SyncQueueItem[];
  syncConflicts: SyncConflict[];
  isLoading: boolean;
}

export class AppService {
  readonly thresholds: ThresholdService;
  readonly inspection: InspectionService;
  readonly tickets: TicketService;
  readonly traces: AnomalyTraceService;
  readonly plans: PlanService;
  readonly export: ExportService;
  readonly sync: SyncCoordinator;
  readonly filters: FilterService;
  private readonly repo: AppRepository;

  constructor(repo: AppRepository, remote: RemoteSyncRepository) {
    this.repo = repo;
    this.thresholds = new ThresholdService(repo);
    this.inspection = new InspectionService(repo);
    this.tickets = new TicketService(repo);
    this.traces = new AnomalyTraceService();
    this.plans = new PlanService(repo);
    this.export = new ExportService();
    this.sync = new SyncCoordinator(repo, remote);
    this.filters = new FilterService(repo);
  }

  async loadAll(): Promise<{
    thresholds: AreaThreshold[];
    inspectionRecords: InspectionRecord[];
    anomalyTickets: AnomalyTicket[];
    anomalyTraces: AnomalyTrace[];
    inspectionPlans: InspectionPlan[];
    filters: FilterConditions;
    wasEmpty: boolean;
  }> {
    const [thresholds, inspectionRecords, anomalyTickets, anomalyTraces, inspectionPlans, filters] =
      await Promise.all([
        this.thresholds.getAll(),
        this.inspection.getAll(),
        this.tickets.getAll(),
        this.repo.getAnomalyTraces
          ? this.repo.getAnomalyTraces()
          : Promise.resolve([]),
        this.plans.getAll(),
        this.filters.get(),
      ]);
    const wasEmpty =
      thresholds.length === 0 &&
      inspectionRecords.length === 0 &&
      anomalyTickets.length === 0 &&
      inspectionPlans.length === 0;
    if (wasEmpty) {
      return this.seedDefaults();
    }
    return {
      thresholds,
      inspectionRecords,
      anomalyTickets,
      anomalyTraces,
      inspectionPlans,
      filters,
      wasEmpty,
    };
  }

  async seedDefaults() {
    await this.thresholds.updateAll([]);
    const data = await this.loadAll();
    return { ...data, wasEmpty: true };
  }

  async clearAllAndSeed(): Promise<void> {
    await this.thresholds.updateAll([]);
  }

  async getSyncStatus(): Promise<SyncStatus> {
    return this.sync.getSyncStatus();
  }

  async pushPending(): Promise<SyncResult> {
    return this.sync.pushPending();
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    return this.sync.getQueue();
  }

  async getDetailedQueueStatus(): Promise<SyncQueueDetailedStatus> {
    return this.sync.getDetailedQueueStatus();
  }

  async enqueueEntity(
    entityType: SyncEntityType,
    entity: any,
    action: SyncAction = "update"
  ): Promise<SyncQueueItem | null> {
    return this.sync.enqueueEntity(entityType, entity, action);
  }

  async processQueue(
    scope: "all" | "pending" | "failed" = "all",
    itemIds?: number[]
  ): Promise<SyncResult> {
    return this.sync.processQueue(scope, itemIds);
  }

  async retryQueueItem(itemId: number): Promise<SyncResult> {
    return this.sync.retryItem(itemId);
  }

  async retryAllFailed(): Promise<SyncResult> {
    return this.sync.retryAllFailed();
  }

  async removeQueueItem(itemId: number): Promise<void> {
    return this.sync.removeQueueItem(itemId);
  }

  async clearSyncedQueueItems(): Promise<void> {
    return this.sync.clearSyncedQueueItems();
  }

  async migrateUnsyncedToQueue(): Promise<number> {
    return this.sync.migrateUnsyncedToQueue();
  }

  onQueueChange(callback: () => void): () => void {
    return this.sync.onQueueChange(callback);
  }

  onConflictChange(callback: () => void): () => void {
    return this.sync.onConflictChange(callback);
  }

  async getSyncConflicts(): Promise<SyncConflict[]> {
    return this.sync.getConflicts();
  }

  async getUnresolvedConflicts(): Promise<SyncConflict[]> {
    return this.sync.getUnresolvedConflicts();
  }

  async resolveConflict(
    conflictId: number,
    resolution: "keepLocal" | "useRemote"
  ): Promise<{ success: boolean; errorMessage?: string }> {
    return this.sync.resolveConflict(conflictId, resolution);
  }

  async clearResolvedConflicts(): Promise<void> {
    return this.sync.clearResolvedConflicts();
  }

  async removeConflict(conflictId: number): Promise<void> {
    return this.sync.removeConflict(conflictId);
  }

  setSimulateConflicts(enabled: boolean): void {
    this.sync.setSimulateConflicts(enabled);
  }
}
