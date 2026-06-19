import type {
  AnomalyTicket,
  AnomalyTrace,
  AreaThreshold,
  InspectionPlan,
  InspectionRecord,
  SyncEntityType,
  SyncItemResult,
} from "../domain";
import type { RemoteSyncRepository, SyncResult } from "./types";

export class ApiSyncRepository implements RemoteSyncRepository {
  private online: boolean;
  private listeners: Set<(online: boolean) => void> = new Set();
  private simulateFailures: boolean = false;
  private failureCounter: number = 0;

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

  setSimulateFailures(enabled: boolean) {
    this.simulateFailures = enabled;
  }

  private async simulateNetworkDelay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 80 + Math.random() * 150));
  }

  private shouldRandomlyFail(): boolean {
    if (!this.simulateFailures) return false;
    this.failureCounter++;
    return this.failureCounter % 3 === 0;
  }

  async pushRecord(_record: InspectionRecord): Promise<SyncItemResult> {
    if (!this.online) {
      return { success: false, errorMessage: "网络离线，无法同步巡检记录" };
    }
    await this.simulateNetworkDelay();
    if (this.shouldRandomlyFail()) {
      return { success: false, errorMessage: "服务器超时（504）：提交巡检记录失败，请稍后重试" };
    }
    return { success: true };
  }

  async pushTicket(_ticket: AnomalyTicket): Promise<SyncItemResult> {
    if (!this.online) {
      return { success: false, errorMessage: "网络离线，无法同步异常工单" };
    }
    await this.simulateNetworkDelay();
    if (this.shouldRandomlyFail()) {
      return { success: false, errorMessage: "权限校验失败（403）：工单操作人信息不匹配，请联系管理员" };
    }
    return { success: true };
  }

  async pushPlan(_plan: InspectionPlan): Promise<SyncItemResult> {
    if (!this.online) {
      return { success: false, errorMessage: "网络离线，无法同步巡检计划" };
    }
    await this.simulateNetworkDelay();
    if (this.shouldRandomlyFail()) {
      return { success: false, errorMessage: "数据冲突（409）：该计划已被其他用户修改，请刷新后重试" };
    }
    return { success: true };
  }

  async pushTrace(_trace: AnomalyTrace): Promise<SyncItemResult> {
    if (!this.online) {
      return { success: false, errorMessage: "网络离线，无法同步异常追踪" };
    }
    await this.simulateNetworkDelay();
    if (this.shouldRandomlyFail()) {
      return { success: false, errorMessage: "服务内部错误（500）：保存异常追踪失败，请重试" };
    }
    return { success: true };
  }

  async pullThresholds(): Promise<AreaThreshold[] | null> {
    if (!this.online) return null;
    await this.simulateNetworkDelay();
    return null;
  }

  async pullPlans(): Promise<InspectionPlan[] | null> {
    if (!this.online) return null;
    await this.simulateNetworkDelay();
    return null;
  }

  async syncAll(
    records: InspectionRecord[],
    tickets: AnomalyTicket[],
    plans: InspectionPlan[]
  ): Promise<SyncResult> {
    const detailedResults: Array<{
      entityType: SyncEntityType;
      entityId: number;
      success: boolean;
      errorMessage?: string;
    }> = [];
    let syncedRecords = 0;
    let syncedTickets = 0;
    let syncedPlans = 0;
    const errors: string[] = [];

    for (const record of records) {
      const r = await this.pushRecord(record);
      if (r.success) {
        syncedRecords++;
      } else if (r.errorMessage) {
        errors.push(r.errorMessage);
      }
      detailedResults.push({
        entityType: "inspectionRecord",
        entityId: record.id,
        success: r.success,
        errorMessage: r.errorMessage,
      });
    }

    for (const ticket of tickets) {
      const r = await this.pushTicket(ticket);
      if (r.success) {
        syncedTickets++;
      } else if (r.errorMessage) {
        errors.push(r.errorMessage);
      }
      detailedResults.push({
        entityType: "anomalyTicket",
        entityId: ticket.id,
        success: r.success,
        errorMessage: r.errorMessage,
      });
    }

    for (const plan of plans) {
      const r = await this.pushPlan(plan);
      if (r.success) {
        syncedPlans++;
      } else if (r.errorMessage) {
        errors.push(r.errorMessage);
      }
      detailedResults.push({
        entityType: "inspectionPlan",
        entityId: plan.id,
        success: r.success,
        errorMessage: r.errorMessage,
      });
    }

    if (!this.online) {
      errors.unshift("当前离线，无法同步");
    } else if (errors.length === 0 && syncedRecords + syncedTickets + syncedPlans === 0) {
      errors.push("API 未接入，跳过同步");
    }

    return {
      syncedRecords,
      syncedTickets,
      syncedPlans,
      syncedTraces: 0,
      errors,
      detailedResults,
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
