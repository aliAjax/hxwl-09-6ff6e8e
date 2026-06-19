import type {
  AnomalyTicket,
  AnomalyTicketInput,
  AreaThreshold,
  CleanArea,
  TicketAnomalyType,
  TicketStatus,
} from "../domain/models";
import type { AppRepository } from "../repositories";
import { buildTicketRemark, formatNow, nextTicketStatus, prevTicketStatus } from "../domain/rules";
import { TICKET_ASSIGNEES } from "../domain/constants";

export class TicketService {
  constructor(private repo: AppRepository) {}

  async getAll(): Promise<AnomalyTicket[]> {
    return this.repo.getAnomalyTickets();
  }

  async getByStatus(status: "全部" | TicketStatus): Promise<AnomalyTicket[]> {
    const all = await this.repo.getAnomalyTickets();
    if (status === "全部") return all;
    return all.filter((t) => t.status === status);
  }

  async getByArea(area: CleanArea | "全部"): Promise<AnomalyTicket[]> {
    const all = await this.repo.getAnomalyTickets();
    if (area === "全部") return all;
    return all.filter((t) => t.area === area);
  }

  async create(input: AnomalyTicketInput): Promise<AnomalyTicket> {
    const ticket: AnomalyTicket = {
      ...input,
      id: Date.now(),
      status: "待处理",
      createdAt: formatNow(),
      processNotes: [],
      synced: false,
    };
    await this.repo.saveAnomalyTicket(ticket);
    return ticket;
  }

  async createFromReadings(
    readings: {
      roomId: string;
      area: CleanArea;
      particle05um: number;
      particle5um: number;
      pressure: number;
      temperature: number;
      humidity: number;
      sourceRecordId?: number;
    },
    anomalyType: TicketAnomalyType,
    thresholds: AreaThreshold[],
    assignee?: string
  ): Promise<AnomalyTicket> {
    const remark = buildTicketRemark(readings, anomalyType, thresholds);
    return this.create({
      roomId: readings.roomId,
      area: readings.area,
      anomalyType,
      assignee: assignee ?? this.randomAssignee(),
      remark,
      sourceRecordId: readings.sourceRecordId,
    });
  }

  async updateStatus(ticketId: number, status: TicketStatus): Promise<void> {
    await this.repo.updateTicketStatus(ticketId, status);
  }

  async replaceAll(tickets: AnomalyTicket[]): Promise<void> {
    await this.repo.saveAllAnomalyTickets(tickets);
  }

  hasTicketForRecord(
    tickets: AnomalyTicket[],
    recordId: number,
    anomalyType: TicketAnomalyType
  ): boolean {
    return tickets.some(
      (t) => t.sourceRecordId === recordId && t.anomalyType === anomalyType
    );
  }

  getAssignees(): string[] {
    return TICKET_ASSIGNEES;
  }

  randomAssignee(): string {
    return TICKET_ASSIGNEES[Math.floor(Math.random() * TICKET_ASSIGNEES.length)];
  }

  nextStatus(current: TicketStatus): TicketStatus | null {
    return nextTicketStatus(current);
  }

  prevStatus(current: TicketStatus): TicketStatus | null {
    return prevTicketStatus(current);
  }

  countByStatus(tickets: AnomalyTicket[]): Record<TicketStatus, number> {
    return {
      待处理: tickets.filter((t) => t.status === "待处理").length,
      处理中: tickets.filter((t) => t.status === "处理中").length,
      已关闭: tickets.filter((t) => t.status === "已关闭").length,
    };
  }
}
