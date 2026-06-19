import type {
  AnomalyTicket,
  InspectionPlan,
  InspectionRecord,
  AnomalyTrace,
  AreaThreshold,
  CleanArea,
  RootCauseCategory,
} from "../domain/models";
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

  exportTeamReviewReport(
    records: InspectionRecord[],
    tickets: AnomalyTicket[],
    traces: AnomalyTrace[],
    thresholds: AreaThreshold[],
    params: {
      area: CleanArea | "全部";
      startDate: string;
      endDate: string;
    }
  ): { success: boolean; message?: string } {
    const { area, startDate, endDate } = params;

    const inTimeRange = (ts: string): boolean => {
      if (!ts) return false;
      const t = ts.slice(0, 10);
      if (startDate && t < startDate) return false;
      if (endDate && t > endDate) return false;
      return true;
    };

    const filteredRecords = records.filter((r) => {
      const areaOk = area === "全部" || r.area === area;
      return areaOk && inTimeRange(r.createdAt);
    });

    const filteredTickets = tickets.filter((t) => {
      const areaOk = area === "全部" || t.area === area;
      return areaOk && inTimeRange(t.createdAt);
    });

    const filteredTraces = traces.filter((t) => {
      const areaOk = area === "全部" || t.area === area;
      return areaOk && inTimeRange(t.firstOccurredAt);
    });

    const areaThresholds =
      area === "全部" ? thresholds : thresholds.filter((t) => t.area === area);

    const rootCauseAnalysis = filteredTraces
      .filter((t) => t.rootCause)
      .map((t) => ({
        traceId: t.id,
        roomId: t.roomId,
        area: t.area,
        anomalyType: t.anomalyType,
        rootCause: t.rootCause as RootCauseCategory,
        rootCauseDetail: t.rootCauseDetail,
        confidence: t.confidence,
        status: t.status,
      }));

    const unclosedRisks = [
      ...filteredTickets
        .filter((t) => t.status !== "已关闭")
        .map((t) => ({
          type: "ticket" as const,
          id: t.id,
          roomId: t.roomId,
          area: t.area,
          anomalyType: t.anomalyType,
          status: t.status,
          assignee: t.assignee,
          createdAt: t.createdAt,
          remark: t.remark,
        })),
      ...filteredTraces
        .filter((t) => t.status !== "已恢复")
        .map((t) => ({
          type: "trace" as const,
          id: t.id,
          roomId: t.roomId,
          area: t.area,
          anomalyType: t.anomalyType,
          status: t.status,
          firstOccurredAt: t.firstOccurredAt,
          lastOccurredAt: t.lastOccurredAt,
          anomalyCount: t.anomalyCount,
          rootCause: t.rootCause,
        })),
    ];

    const totalRecords = filteredRecords.length;
    const abnormalRecords = filteredRecords.filter((r) => r.status !== "稳定").length;
    const totalTickets = filteredTickets.length;
    const closedTickets = filteredTickets.filter((t) => t.status === "已关闭").length;
    const totalTraces = filteredTraces.length;
    const recoveredTraces = filteredTraces.filter((t) => t.status === "已恢复").length;

    const report = {
      reportType: "班组复盘综合报告",
      exportedAt: formatNow(),
      reportScope: {
        area,
        startDate,
        endDate,
      },
      summary: {
        totalRecords,
        abnormalRecords,
        abnormalRate: totalRecords > 0 ? Number(((abnormalRecords / totalRecords) * 100).toFixed(2)) : 0,
        totalTickets,
        closedTickets,
        ticketClosureRate: totalTickets > 0 ? Number(((closedTickets / totalTickets) * 100).toFixed(2)) : 0,
        totalTraces,
        recoveredTraces,
        traceRecoveryRate: totalTraces > 0 ? Number(((recoveredTraces / totalTraces) * 100).toFixed(2)) : 0,
        unclosedRiskCount: unclosedRisks.length,
      },
      inspectionRecords: filteredRecords,
      anomalyTickets: filteredTickets,
      anomalyTraces: filteredTraces,
      rootCauseAnalysis,
      unclosedRisks,
      thresholdSnapshot: areaThresholds,
    };

    const areaPart = area === "全部" ? "全部区域" : area.replace(/\s/g, "");
    const datePart = startDate || endDate
      ? `${startDate ? startDate.replace(/-/g, "") : "不限"}_${endDate ? endDate.replace(/-/g, "") : "不限"}`
      : "全部时间";
    const fileName = `班组复盘综合报告_${areaPart}_${datePart}.json`;
    this.downloadJson(report, fileName);
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
