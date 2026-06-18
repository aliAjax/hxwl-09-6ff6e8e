import type {
  CleanArea,
  InspectionPlan,
  PlanStatus,
  RoleType,
} from "../domain/models";
import type { AppRepository } from "../repositories";
import { CLEAN_AREAS, PLAN_ROLES } from "../domain/constants";
import { formatNow } from "../domain/rules";

export class PlanService {
  constructor(private repo: AppRepository) {}

  async getAll(): Promise<InspectionPlan[]> {
    return this.repo.getInspectionPlans();
  }

  async getByStatus(status: "全部" | PlanStatus): Promise<InspectionPlan[]> {
    const all = await this.repo.getInspectionPlans();
    if (status === "全部") return all;
    return all.filter((p) => p.status === status);
  }

  async create(input: {
    date: string;
    area: CleanArea;
    role: string;
    inspector: string;
  }): Promise<InspectionPlan> {
    const plan: InspectionPlan = {
      id: Date.now(),
      date: input.date,
      area: input.area,
      role: input.role,
      inspector: input.inspector.trim(),
      status: "未开始",
      synced: false,
    };
    await this.repo.saveInspectionPlan(plan);
    return plan;
  }

  async updateStatus(planId: number, status: PlanStatus): Promise<void> {
    await this.repo.updatePlanStatus(planId, status);
  }

  async replaceAll(plans: InspectionPlan[]): Promise<void> {
    await this.repo.saveAllInspectionPlans(plans);
  }

  countByStatus(plans: InspectionPlan[]): Record<PlanStatus, number> {
    return {
      未开始: plans.filter((p) => p.status === "未开始").length,
      进行中: plans.filter((p) => p.status === "进行中").length,
      已完成: plans.filter((p) => p.status === "已完成").length,
    };
  }

  getAreas(): CleanArea[] {
    return CLEAN_AREAS;
  }

  getRoles(): RoleType[] {
    return PLAN_ROLES;
  }

  todayStr(): string {
    return formatNow().slice(0, 10);
  }
}
