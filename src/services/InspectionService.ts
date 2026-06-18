import {
  buildInspectionRecord,
  checkAnomalies,
  formatNow,
  getRecordStatus,
  validateInspectionInput,
} from "../domain/rules";
import type {
  AnomalyCheckResult,
  AreaThreshold,
  CleanArea,
  InspectionRecord,
  InspectionRecordInput,
  RecordStatusResult,
} from "../domain/models";
import type { AppRepository } from "../repositories";
import { TICKET_ASSIGNEES } from "../domain/constants";

export class InspectionService {
  constructor(private repo: AppRepository) {}

  async getAll(): Promise<InspectionRecord[]> {
    return this.repo.getInspectionRecords();
  }

  async getByArea(area: CleanArea | "全部"): Promise<InspectionRecord[]> {
    const all = await this.repo.getInspectionRecords();
    if (area === "全部") return all;
    return all.filter((r) => r.area === area);
  }

  async create(
    input: InspectionRecordInput,
    thresholds: AreaThreshold[],
    existingRoomIds: string[]
  ): Promise<{ record: InspectionRecord; errors: Partial<Record<string, string>> } | null> {
    const errors = validateInspectionInput(input, existingRoomIds);
    if (Object.keys(errors).length > 0) {
      return { record: null as unknown as InspectionRecord, errors };
    }
    const record = buildInspectionRecord(input, thresholds);
    await this.repo.saveInspectionRecord(record);
    return { record, errors: {} };
  }

  async replaceAll(records: InspectionRecord[]): Promise<void> {
    await this.repo.saveAllInspectionRecords(records);
  }

  getRoomIds(records: InspectionRecord[]): string[] {
    return records.map((r) => r.roomId);
  }

  checkAnomalies(
    readings: {
      area: CleanArea;
      particle05um: number;
      particle5um: number;
      pressure: number;
      temperature: number;
      humidity: number;
    },
    thresholds: AreaThreshold[]
  ): AnomalyCheckResult {
    return checkAnomalies(readings, thresholds);
  }

  getStatus(anomalies: AnomalyCheckResult): RecordStatusResult {
    return getRecordStatus(anomalies);
  }

  randomAssignee(): string {
    return TICKET_ASSIGNEES[Math.floor(Math.random() * TICKET_ASSIGNEES.length)];
  }

  formatNow(): string {
    return formatNow();
  }
}
