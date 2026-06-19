import type {
  AnomalyTicket,
  AnomalyTicketInput,
  AnomalyTrace,
  AreaThreshold,
  FilterConditions,
  InspectionPlan,
  InspectionRecord,
  SyncQueueItem,
  SyncEntityType,
  SyncItemResult,
  TicketStatus,
  TraceStatus,
} from "../domain";

export interface AppRepository {
  getThresholds(): Promise<AreaThreshold[]>;
  saveThresholds(thresholds: AreaThreshold[]): Promise<void>;

  getInspectionRecords(): Promise<InspectionRecord[]>;
  saveInspectionRecord(record: InspectionRecord): Promise<void>;
  saveAllInspectionRecords(records: InspectionRecord[]): Promise<void>;

  getAnomalyTickets(): Promise<AnomalyTicket[]>;
  saveAnomalyTicket(ticket: AnomalyTicket): Promise<void>;
  saveAllAnomalyTickets(tickets: AnomalyTicket[]): Promise<void>;
  updateTicketStatus(ticketId: number, status: TicketStatus): Promise<void>;

  getAnomalyTraces(): Promise<AnomalyTrace[]>;
  saveAnomalyTrace(trace: AnomalyTrace): Promise<void>;
  saveAllAnomalyTraces(traces: AnomalyTrace[]): Promise<void>;

  getInspectionPlans(): Promise<InspectionPlan[]>;
  saveInspectionPlan(plan: InspectionPlan): Promise<void>;
  saveAllInspectionPlans(plans: InspectionPlan[]): Promise<void>;
  updatePlanStatus(planId: number, status: InspectionPlan["status"]): Promise<void>;
  addLinkedRecordToPlan(planId: number, recordId: number): Promise<void>;

  getFilters(): Promise<FilterConditions>;
  saveFilters(filters: FilterConditions): Promise<void>;

  getSyncQueue(): Promise<SyncQueueItem[]>;
  saveSyncQueueItem(item: SyncQueueItem): Promise<void>;
  saveAllSyncQueueItems(items: SyncQueueItem[]): Promise<void>;
  updateSyncQueueItem(item: SyncQueueItem): Promise<void>;
  removeSyncQueueItem(id: number): Promise<void>;
  clearSyncedQueueItems(): Promise<void>;
  getNextSyncQueueId(): Promise<number>;

  isEmpty(): Promise<boolean>;
  seedDefaults(): Promise<void>;
  clearAll(): Promise<void>;
  loadAll(): Promise<{
    thresholds: AreaThreshold[];
    inspectionRecords: InspectionRecord[];
    anomalyTickets: AnomalyTicket[];
    anomalyTraces: AnomalyTrace[];
    inspectionPlans: InspectionPlan[];
    filters: FilterConditions;
    syncQueue: SyncQueueItem[];
    wasEmpty: boolean;
  }>;
}

export interface SyncResult {
  syncedRecords: number;
  syncedTickets: number;
  syncedPlans: number;
  syncedTraces: number;
  errors: string[];
  detailedResults: Array<{
    entityType: SyncEntityType;
    entityId: number;
    success: boolean;
    errorMessage?: string;
  }>;
}

export interface RemoteSyncRepository {
  pushRecord(record: InspectionRecord): Promise<SyncItemResult>;
  pushTicket(ticket: AnomalyTicket): Promise<SyncItemResult>;
  pushPlan(plan: InspectionPlan): Promise<SyncItemResult>;
  pushTrace(trace: AnomalyTrace): Promise<SyncItemResult>;
  pullThresholds(): Promise<AreaThreshold[] | null>;
  pullPlans(): Promise<InspectionPlan[] | null>;
  syncAll(
    records: InspectionRecord[],
    tickets: AnomalyTicket[],
    plans: InspectionPlan[]
  ): Promise<SyncResult>;
  isOnline(): boolean;
  onOnlineChange(callback: (online: boolean) => void): () => void;
}
