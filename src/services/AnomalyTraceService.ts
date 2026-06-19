import type {
  AnomalyTrace,
  AnomalyTraceInput,
  AreaThreshold,
  CloseCondition,
  InspectionRecord,
  AnomalyTicket,
  ProcessingStep,
  ProcessingActionType,
  RootCauseCategory,
  TraceStatus,
  TicketAnomalyType,
} from "../domain";
import { checkAnomalies, formatNow } from "../domain";
import { TICKET_ASSIGNEES } from "../domain";

const CONSECUTIVE_NORMAL_REQUIRED = 3;

export class AnomalyTraceService {
  create(
    input: AnomalyTraceInput,
    existingTraces: AnomalyTrace[]
  ): AnomalyTrace {
    const now = formatNow();
    const maxId = existingTraces.reduce((max, t) => Math.max(max, t.id), 0);

    return {
      id: maxId + 1,
      roomId: input.roomId,
      area: input.area,
      anomalyType: input.anomalyType,
      status: "异常发生",
      firstOccurredAt: now,
      lastOccurredAt: now,
      anomalyCount: 1,
      recoveryCount: 0,
      initialRecordId: input.initialRecordId,
      triggerTicketId: input.triggerTicketId,
      linkedRecordIds: input.initialRecordId ? [input.initialRecordId] : [],
      linkedTicketIds: input.triggerTicketId ? [input.triggerTicketId] : [],
      processingSteps: [
        {
          id: 1,
          timestamp: now,
          operator: TICKET_ASSIGNEES[0],
          action: "启动调查" as ProcessingActionType,
          description: `检测到${input.anomalyType}，自动启动根因追踪流程`,
        },
      ],
      closeCondition: {
        particleStable: false,
        pressureStable: false,
        tempHumidityStable: false,
        deviceNormal: false,
        consecutiveNormalRecords: 0,
        ticketsClosed: false,
      },
      canClose: false,
      synced: false,
    };
  }

  inferRootCause(
    trace: AnomalyTrace,
    recentRecords: InspectionRecord[],
    relatedTickets: AnomalyTicket[]
  ): { cause: RootCauseCategory; detail: string; confidence: number } {
    const anomalyType = trace.anomalyType;
    const deviceStatuses = recentRecords.map((r) => r.deviceStatus);
    const hasFaultDevice = deviceStatuses.some((s) => s === "故障");
    const particleTrend = this.analyzeParticleTrend(recentRecords);
    const pressureTrend = this.analyzePressureTrend(recentRecords);
    const tempHumidityTrend = this.analyzeTempHumidityTrend(recentRecords);

    if (anomalyType === "粒子异常") {
      if (particleTrend === "increasing") {
        return {
          cause: "过滤器堵塞",
          detail: "粒子计数持续上升趋势，符合高效过滤器堵塞或效率下降的典型特征，建议检查过滤器使用寿命和压差",
          confidence: 80,
        };
      }
      if (hasFaultDevice) {
        return {
          cause: "设备维护缺失",
          detail: "关联设备处于故障状态，可能导致局部气流紊乱或粒子扩散异常",
          confidence: 70,
        };
      }
      return {
        cause: "人员操作不当",
        detail: "粒子偶发超标，可能与人员进出、操作动作不规范或物料带入污染有关",
        confidence: 55,
      };
    }

    if (anomalyType === "压差异常") {
      if (pressureTrend === "fluctuating") {
        return {
          cause: "阀门故障",
          detail: "压差波动明显，疑似压差调节阀定位漂移或执行机构故障，建议校准或更换",
          confidence: 75,
        };
      }
      if (pressureTrend === "decreasing") {
        return {
          cause: "密封性问题",
          detail: "压差持续下降，可能存在房间密封失效（门缝、传递窗、高效过滤器边框泄漏等）",
          confidence: 72,
        };
      }
      return {
        cause: "空调系统故障",
        detail: "压差偏离正常值范围，可能与送排风量失衡、风机转速异常有关",
        confidence: 65,
      };
    }

    if (anomalyType === "温湿度偏移") {
      if (tempHumidityTrend === "unstable") {
        return {
          cause: "空调系统故障",
          detail: "温湿度持续波动，疑似空调机组温控/湿控模块异常或传感器漂移",
          confidence: 78,
        };
      }
      if (hasFaultDevice) {
        return {
          cause: "设备维护缺失",
          detail: "关联设备故障可能产生异常散热或影响局部气流组织，导致温湿度偏移",
          confidence: 60,
        };
      }
      return {
        cause: "未知原因",
        detail: "温湿度偏移原因不明确，建议结合设备运行日志和现场排查进一步分析",
        confidence: 40,
      };
    }

    return {
      cause: "未知原因",
      detail: "当前数据不足以确定根因，建议增加现场排查和设备检查",
      confidence: 30,
    };
  }

  private analyzeParticleTrend(records: InspectionRecord[]): "stable" | "increasing" | "decreasing" | "fluctuating" {
    if (records.length < 3) return "stable";
    const values = records.slice(0, 5).map((r) => r.particle05um);
    const diffs: number[] = [];
    for (let i = 1; i < values.length; i++) {
      diffs.push(values[i - 1] - values[i]);
    }
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const variance =
      diffs.reduce((a, b) => a + (b - avgDiff) ** 2, 0) / diffs.length;
    if (variance > avgDiff * avgDiff * 2) return "fluctuating";
    if (avgDiff > 0) return "increasing";
    if (avgDiff < 0) return "decreasing";
    return "stable";
  }

  private analyzePressureTrend(records: InspectionRecord[]): "stable" | "increasing" | "decreasing" | "fluctuating" {
    if (records.length < 3) return "stable";
    const values = records.slice(0, 5).map((r) => r.pressure);
    const diffs: number[] = [];
    for (let i = 1; i < values.length; i++) {
      diffs.push(values[i] - values[i - 1]);
    }
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const maxAbsDiff = Math.max(...diffs.map((d) => Math.abs(d)));
    if (maxAbsDiff >= 3) return "fluctuating";
    if (avgDiff <= -1) return "decreasing";
    if (avgDiff >= 1) return "increasing";
    return "stable";
  }

  private analyzeTempHumidityTrend(records: InspectionRecord[]): "stable" | "unstable" {
    if (records.length < 3) return "stable";
    const temps = records.slice(0, 5).map((r) => r.temperature);
    const hums = records.slice(0, 5).map((r) => r.humidity);
    const tRange = Math.max(...temps) - Math.min(...temps);
    const hRange = Math.max(...hums) - Math.min(...hums);
    if (tRange >= 3 || hRange >= 8) return "unstable";
    return "stable";
  }

  evaluateCloseCondition(
    trace: AnomalyTrace,
    roomRecords: InspectionRecord[],
    relatedTickets: AnomalyTicket[],
    thresholds: AreaThreshold[]
  ): { condition: CloseCondition; canClose: boolean; warnings: string[] } {
    const warnings: string[] = [];
    const recentRecords = roomRecords.slice(0, 10);

    const normalRecords = recentRecords.filter((r) => {
      const anomalies = checkAnomalies(r, thresholds);
      return anomalies.none;
    });
    const consecutiveNormals = this.countConsecutiveNormals(
      recentRecords,
      thresholds
    );

    const lastRecord = recentRecords[0];
    const lastAnomalies = lastRecord
      ? checkAnomalies(lastRecord, thresholds)
      : { particle: true, pressure: true, temp: true, humidity: true, none: false };

    const particleStable = !lastAnomalies.particle;
    const pressureStable = !lastAnomalies.pressure;
    const tempHumidityStable = !lastAnomalies.temp && !lastAnomalies.humidity;
    const deviceNormal =
      lastRecord?.deviceStatus === "运行中" ||
      lastRecord?.deviceStatus === "待机";

    const activeTickets = relatedTickets.filter(
      (t) => t.status !== "已关闭" && t.roomId === trace.roomId
    );
    const ticketsClosed = activeTickets.length === 0;

    if (!particleStable && trace.anomalyType === "粒子异常") {
      warnings.push("粒子计数仍未恢复正常范围");
    }
    if (!pressureStable && trace.anomalyType === "压差异常") {
      warnings.push("压差仍未恢复正常范围");
    }
    if (!tempHumidityStable && trace.anomalyType === "温湿度偏移") {
      warnings.push("温湿度仍未恢复正常范围");
    }
    if (!deviceNormal) {
      warnings.push("关联设备仍处于故障状态");
    }
    if (consecutiveNormals < CONSECUTIVE_NORMAL_REQUIRED) {
      warnings.push(
        `需要连续${CONSECUTIVE_NORMAL_REQUIRED}次稳定记录，当前仅${consecutiveNormals}次`
      );
    }
    if (!ticketsClosed) {
      warnings.push(
        `存在${activeTickets.length}个未关闭的关联工单`
      );
    }

    const condition: CloseCondition = {
      particleStable,
      pressureStable,
      tempHumidityStable,
      deviceNormal,
      consecutiveNormalRecords: consecutiveNormals,
      ticketsClosed,
    };

    const anomalyTypeSatisfied =
      (trace.anomalyType === "粒子异常" && particleStable) ||
      (trace.anomalyType === "压差异常" && pressureStable) ||
      (trace.anomalyType === "温湿度偏移" && tempHumidityStable);

    const canClose =
      anomalyTypeSatisfied &&
      deviceNormal &&
      consecutiveNormals >= CONSECUTIVE_NORMAL_REQUIRED &&
      ticketsClosed;

    return { condition, canClose, warnings };
  }

  private countConsecutiveNormals(
    records: InspectionRecord[],
    thresholds: AreaThreshold[]
  ): number {
    let count = 0;
    for (const r of records) {
      const anomalies = checkAnomalies(r, thresholds);
      if (anomalies.none) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  updateOnNewRecord(
    trace: AnomalyTrace,
    newRecord: InspectionRecord,
    thresholds: AreaThreshold[]
  ): AnomalyTrace {
    const anomalies = checkAnomalies(newRecord, thresholds);
    const anomalyMatches =
      (trace.anomalyType === "粒子异常" && anomalies.particle) ||
      (trace.anomalyType === "压差异常" && anomalies.pressure) ||
      (trace.anomalyType === "温湿度偏移" &&
        (anomalies.temp || anomalies.humidity));

    let newStatus: TraceStatus = trace.status;
    let anomalyCount = trace.anomalyCount;
    let recoveryCount = trace.recoveryCount;
    const newLinkedRecordIds = trace.linkedRecordIds.includes(newRecord.id)
      ? trace.linkedRecordIds
      : [...trace.linkedRecordIds, newRecord.id];

    if (anomalyMatches) {
      anomalyCount++;
      if (trace.status === "已恢复" || trace.status === "待验证") {
        newStatus = "复发";
      } else if (trace.status === "异常发生") {
        newStatus = "调查中";
      }
    } else if (!anomalies.none && trace.status === "异常发生") {
      newStatus = "调查中";
    }

    return {
      ...trace,
      status: newStatus,
      anomalyCount,
      recoveryCount,
      lastOccurredAt: anomalyMatches ? newRecord.createdAt : trace.lastOccurredAt,
      linkedRecordIds: newLinkedRecordIds,
    };
  }

  updateOnTicketChange(
    trace: AnomalyTrace,
    ticket: AnomalyTicket
  ): AnomalyTrace {
    const newLinkedTicketIds = trace.linkedTicketIds.includes(ticket.id)
      ? trace.linkedTicketIds
      : [...trace.linkedTicketIds, ticket.id];

    let newStatus = trace.status;
    if (ticket.status === "处理中" && trace.status === "异常发生") {
      newStatus = "处理中";
    }

    return {
      ...trace,
      status: newStatus,
      linkedTicketIds: newLinkedTicketIds,
    };
  }

  addProcessingStep(
    trace: AnomalyTrace,
    action: ProcessingActionType,
    description: string,
    operator: string,
    beforeStatus?: string,
    afterStatus?: string
  ): AnomalyTrace {
    const maxStepId = trace.processingSteps.reduce(
      (max, s) => Math.max(max, s.id),
      0
    );
    const step: ProcessingStep = {
      id: maxStepId + 1,
      timestamp: formatNow(),
      operator,
      action,
      description,
      beforeStatus,
      afterStatus,
    };
    return {
      ...trace,
      processingSteps: [...trace.processingSteps, step],
    };
  }

  updateRootCause(
    trace: AnomalyTrace,
    rootCause: RootCauseCategory,
    detail: string,
    confidence: number
  ): AnomalyTrace {
    return {
      ...trace,
      rootCause,
      rootCauseDetail: detail,
      confidence,
      status: trace.status === "异常发生" ? "调查中" : trace.status,
    };
  }

  markRecovery(
    trace: AnomalyTrace,
    operator: string
  ): AnomalyTrace {
    return {
      ...this.addProcessingStep(
        { ...trace, recoveryCount: trace.recoveryCount + 1 },
        "其他操作",
        `由${operator}标记为已恢复状态`,
        operator
      ),
      status: "已恢复",
    };
  }

  findTraceForRoom(
    traces: AnomalyTrace[],
    roomId: string,
    anomalyType: TicketAnomalyType
  ): AnomalyTrace | undefined {
    return traces.find(
      (t) =>
        t.roomId === roomId &&
        t.anomalyType === anomalyType &&
        t.status !== "已恢复"
    );
  }

  findAllTracesForRoom(
    traces: AnomalyTrace[],
    roomId: string
  ): AnomalyTrace[] {
    return traces.filter((t) => t.roomId === roomId);
  }

  getRecentRecordsForRoom(
    records: InspectionRecord[],
    roomId: string,
    limit: number = 10
  ): InspectionRecord[] {
    return records
      .filter((r) => r.roomId === roomId)
      .slice(0, limit);
  }

  getRelatedTicketsForTrace(
    tickets: AnomalyTicket[],
    trace: AnomalyTrace
  ): AnomalyTicket[] {
    if (trace.linkedTicketIds.length > 0) {
      return tickets.filter((t) => trace.linkedTicketIds.includes(t.id));
    }
    return tickets.filter(
      (t) =>
        t.roomId === trace.roomId && t.anomalyType === trace.anomalyType
    );
  }

  getRelatedRecordsForTrace(
    records: InspectionRecord[],
    trace: AnomalyTrace
  ): InspectionRecord[] {
    if (trace.linkedRecordIds.length > 0) {
      return records.filter((r) => trace.linkedRecordIds.includes(r.id));
    }
    return records.filter((r) => r.roomId === trace.roomId).slice(0, 20);
  }

  checkTicketClosedButDataAbnormal(
    trace: AnomalyTrace,
    tickets: AnomalyTicket[],
    records: InspectionRecord[],
    thresholds: AreaThreshold[]
  ): boolean {
    const relatedTickets = this.getRelatedTicketsForTrace(tickets, trace);
    if (relatedTickets.length === 0) return false;
    const allTicketsClosed = relatedTickets.every(
      (t) => t.status === "已关闭"
    );
    const lastRecord = records.find((r) => r.roomId === trace.roomId);
    if (!lastRecord) return false;
    const anomalies = checkAnomalies(lastRecord, thresholds);
    const anomalyMatches =
      (trace.anomalyType === "粒子异常" && anomalies.particle) ||
      (trace.anomalyType === "压差异常" && anomalies.pressure) ||
      (trace.anomalyType === "温湿度偏移" &&
        (anomalies.temp || anomalies.humidity));
    return allTicketsClosed && anomalyMatches;
  }
}

export const anomalyTraceService = new AnomalyTraceService();
