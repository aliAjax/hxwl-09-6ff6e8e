import type { AreaThreshold } from "../domain";
import type { AppRepository } from "../repositories";

export class ThresholdService {
  constructor(private repo: AppRepository) {}

  async getAll(): Promise<AreaThreshold[]> {
    return this.repo.getThresholds();
  }

  async updateAll(thresholds: AreaThreshold[]): Promise<void> {
    await this.repo.saveThresholds(thresholds);
  }

  async update(area: AreaThreshold["area"], updates: Partial<Omit<AreaThreshold, "area">>): Promise<AreaThreshold[]> {
    const all = await this.repo.getThresholds();
    const updated = all.map((t) => (t.area === area ? { ...t, ...updates } : t));
    await this.repo.saveThresholds(updated);
    return updated;
  }
}
