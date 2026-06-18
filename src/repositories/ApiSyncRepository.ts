import type {
  AnomalyTicket,
  AreaThreshold,
  InspectionPlan,
  InspectionRecord,
} from "../domain";
import type { RemoteSyncRepository, SyncResult } from "./types";

export class ApiSyncRepository implements RemoteSyncRepository {
  private online: boolean;
  private listeners: Set<(online: boolean) => void> = new Set();

  constructor() {
    this.online = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.handleOnline);
      window.addEventListener("offline", this.handleOffline);
    }
  }

  private handleOnline = () => {
    this.online = true;
    this.listeners.forEach((l) => l(true));
  };

  private handleOffline = () => {
    this.online = false;
    this.listeners.forEach((l) => l(false));
  };

  isOnline(): boolean {
    return this.online;
  }

  onOnlineChange(callback: (online: boolean) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  async pushRecord(_record: InspectionRecord): Promise<boolean> {
    return false;
  }

  async pushTicket(_ticket: AnomalyTicket): Promise<boolean> {
    return false;
  }

  async pushPlan(_plan: InspectionPlan): Promise<boolean> {
    return false;
  }

  async pullThresholds(): Promise<AreaThreshold[] | null> {
    return null;
  }

  async pullPlans(): Promise<InspectionPlan[] | null> {
    return null;
  }

  async syncAll(
    _records: InspectionRecord[],
    _tickets: AnomalyTicket[],
    _plans: InspectionPlan[]
  ): Promise<SyncResult> {
    return {
      syncedRecords: 0,
      syncedTickets: 0,
      syncedPlans: 0,
      errors: ["API 未接入，跳过同步"],
    };
  }

  dispose() {
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline);
      window.removeEventListener("offline", this.handleOffline);
    }
    this.listeners.clear();
  }
}

export const apiSyncRepository = new ApiSyncRepository();
