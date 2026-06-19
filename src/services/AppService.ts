import type {
  AnomalyTicket,
  AnomalyTrace,
  AreaThreshold,
  FilterConditions,
  InspectionPlan,
  InspectionRecord,
  SyncStatus,
} from "../domain/models";
import type { AppRepository, RemoteSyncRepository, SyncResult } from "../repositories";
import { ThresholdService } from "./ThresholdService";
import { InspectionService } from "./InspectionService";
import { TicketService } from "./TicketService";
import { PlanService } from "./PlanService";
import { ExportService } from "./ExportService";
import { SyncService } from "./SyncService";
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
  isLoading: boolean;
}

export class AppService {
  readonly thresholds: ThresholdService;
  readonly inspection: InspectionService;
  readonly tickets: TicketService;
  readonly traces: AnomalyTraceService;
  readonly plans: PlanService;
  readonly export: ExportService;
  readonly sync: SyncService;
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
    this.sync = new SyncService(repo, remote);
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
}
