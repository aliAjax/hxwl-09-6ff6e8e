import type {
  AnomalyTicket,
  AnomalyTicketInput,
  AnomalyTrace,
  AreaThreshold,
  FilterConditions,
  InspectionPlan,
  InspectionRecord,
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

  getFilters(): Promise<FilterConditions>;
  saveFilters(filters: FilterConditions): Promise<void>;

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
    wasEmpty: boolean;
  }>;
}

export interface SyncResult {
  syncedRecords: number;
  syncedTickets: number;
  syncedPlans: number;
  errors: string[];
}

export interface RemoteSyncRepository {
  pushRecord(record: InspectionRecord): Promise<boolean>;
  pushTicket(ticket: AnomalyTicket): Promise<boolean>;
  pushPlan(plan: InspectionPlan): Promise<boolean>;
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
