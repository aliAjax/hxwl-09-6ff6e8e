import type { AnomalyTicket, InspectionPlan, InspectionRecord } from "../domain/models";
import { buildExportCsv, escapeCsvField, formatNow, generateFileName } from "../domain/rules";

export type ExportFormat = "csv" | "json";

export class ExportService {
  downloadCsv(csvContent: string, fileName: string): void {
    const bom = "\uFEFF";
    const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
    this.triggerDownload(blob, fileName);
  }

  downloadJson(data: unknown, fileName: string): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json;charset=utf-8;",
    });
    this.triggerDownload(blob, fileName);
  }

  exportRecordsCsv(
    records: InspectionRecord[],
    areaFilter: string
  ): { success: boolean; message?: string } {
    if (records.length === 0) {
      return {
        success: false,
        message: `暂无匹配的巡检数据，无法导出。请先录入巡检记录。`,
      };
    }
    const exportTime = formatNow();
    const csv = buildExportCsv(records, exportTime);
    const fileName = generateFileName("巡检记录", areaFilter);
    this.downloadCsv(csv, fileName);
    return { success: true };
  }

  exportTicketsCsv(
    tickets: AnomalyTicket[],
    areaFilter: string
  ): { success: boolean; message?: string } {
    if (tickets.length === 0) {
      return { success: false, message: "暂无异常工单数据，无法导出。" };
    }
    const headers = [
      "工单号",
      "房间编号",
      "洁净等级",
      "异常类型",
      "负责人",
      "状态",
      "备注",
      "关联记录ID",
      "创建时间",
      "导出时间",
    ];
    const exportTime = formatNow();
    const rows = tickets.map((t) => [
      String(t.id),
      t.roomId,
      t.area,
      t.anomalyType,
      t.assignee,
      t.status,
      t.remark,
      t.sourceRecordId ? String(t.sourceRecordId) : "",
      t.createdAt,
      exportTime,
    ]);
    const csv =
      headers.map(escapeCsvField).join(",") +
      "\r\n" +
      rows.map((row) => row.map(escapeCsvField).join(",")).join("\r\n");
    const fileName = generateFileName("异常工单", areaFilter);
    this.downloadCsv(csv, fileName);
    return { success: true };
  }

  exportPlansCsv(
    plans: InspectionPlan[],
    areaFilter: string
  ): { success: boolean; message?: string } {
    if (plans.length === 0) {
      return { success: false, message: "暂无巡检计划数据，无法导出。" };
    }
    const headers = [
      "计划ID",
      "日期",
      "洁净等级",
      "角色",
      "巡检员",
      "状态",
      "导出时间",
    ];
    const exportTime = formatNow();
    const rows = plans.map((p) => [
      String(p.id),
      p.date,
      p.area,
      p.role,
      p.inspector,
      p.status,
      exportTime,
    ]);
    const csv =
      headers.map(escapeCsvField).join(",") +
      "\r\n" +
      rows.map((row) => row.map(escapeCsvField).join(",")).join("\r\n");
    const fileName = generateFileName("巡检计划", areaFilter);
    this.downloadCsv(csv, fileName);
    return { success: true };
  }

  exportAllJson(
    records: InspectionRecord[],
    tickets: AnomalyTicket[],
    plans: InspectionPlan[]
  ): { success: boolean; message?: string } {
    const data = {
      exportedAt: formatNow(),
      inspectionRecords: records,
      anomalyTickets: tickets,
      inspectionPlans: plans,
    };
    const fileName = `巡检全量数据_${formatNow()
      .slice(0, 10)
      .replace(/-/g, "")}.json`;
    this.downloadJson(data, fileName);
    return { success: true };
  }

  private triggerDownload(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const exportService = new ExportService();
