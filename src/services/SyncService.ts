import type {
  AnomalyTicket,
  InspectionPlan,
  InspectionRecord,
  SyncStatus,
} from "../domain/models";
import type { AppRepository, RemoteSyncRepository, SyncResult } from "../repositories";

export class SyncService {
  constructor(
    private repo: AppRepository,
    private remote: RemoteSyncRepository
  ) {}

  isOnline(): boolean {
    return this.remote.isOnline();
  }

  onOnlineChange(callback: (online: boolean) => void): () => void {
    return this.remote.onOnlineChange(callback);
  }

  async getSyncStatus(): Promise<SyncStatus> {
    const [records, tickets, plans] = await Promise.all([
      this.repo.getInspectionRecords(),
      this.repo.getAnomalyTickets(),
      this.repo.getInspectionPlans(),
    ]);

    return {
      pendingRecords: records.filter((r) => !r.synced).length,
      pendingTickets: tickets.filter((t) => !t.synced).length,
      pendingPlans: plans.filter((p) => !p.synced).length,
      isOnline: this.remote.isOnline(),
    };
  }

  async pushPending(): Promise<SyncResult> {
    if (!this.remote.isOnline()) {
      return {
        syncedRecords: 0,
        syncedTickets: 0,
        syncedPlans: 0,
        errors: ["当前离线，无法同步"],
      };
    }

    const [records, tickets, plans] = await Promise.all([
      this.repo.getInspectionRecords(),
      this.repo.getAnomalyTickets(),
      this.repo.getInspectionPlans(),
    ]);

    const pendingRecords = records.filter((r) => !r.synced);
    const pendingTickets = tickets.filter((t) => !t.synced);
    const pendingPlans = plans.filter((p) => !p.synced);

    const result = await this.remote.syncAll(
      pendingRecords,
      pendingTickets,
      pendingPlans
    );

    if (result.syncedRecords > 0) {
      const syncedRecordIds = new Set(
        pendingRecords.slice(0, result.syncedRecords).map((r) => r.id)
      );
      const updatedRecords = records.map((r) =>
        syncedRecordIds.has(r.id) ? { ...r, synced: true } : r
      );
      await this.repo.saveAllInspectionRecords(updatedRecords);
    }

    if (result.syncedTickets > 0) {
      const syncedTicketIds = new Set(
        pendingTickets.slice(0, result.syncedTickets).map((t) => t.id)
      );
      const updatedTickets = tickets.map((t) =>
        syncedTicketIds.has(t.id) ? { ...t, synced: true } : t
      );
      await this.repo.saveAllAnomalyTickets(updatedTickets);
    }

    if (result.syncedPlans > 0) {
      const syncedPlanIds = new Set(
        pendingPlans.slice(0, result.syncedPlans).map((p) => p.id)
      );
      const updatedPlans = plans.map((p) =>
        syncedPlanIds.has(p.id) ? { ...p, synced: true } : p
      );
      await this.repo.saveAllInspectionPlans(updatedPlans);
    }

    return result;
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
