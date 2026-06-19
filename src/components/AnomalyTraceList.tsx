import { useState, useMemo, useEffect } from "react";
import type {
  AnomalyTrace,
  TraceStatus,
  CleanArea,
  TicketAnomalyType,
  InspectionRecord,
} from "../domain";
import {
  TRACE_STATUSES,
  TRACE_STATUS_TAG_CLASS,
  TICKET_ANOMALY_TYPE_CLASS,
  CLEAN_AREAS,
  TICKET_ANOMALY_TYPES,
  checkAnomalies,
} from "../domain";
import AnomalyTraceDetail from "./AnomalyTraceDetail";

type TraceStatusFilter = "全部" | TraceStatus;
const STATUS_FILTERS: TraceStatusFilter[] = ["全部", ...TRACE_STATUSES];

interface AnomalyTraceListProps {
  traces: AnomalyTrace[];
  records: InspectionRecord[];
  thresholds: any;
  getTracesForRoom: (roomId: string) => AnomalyTrace[];
  getRecordsForRoom: (roomId: string, limit?: number) => InspectionRecord[];
  getTicketsForTrace: (trace: AnomalyTrace) => any[];
  getRecordsForTrace: (trace: AnomalyTrace) => InspectionRecord[];
  evaluateTraceCloseCondition: (trace: AnomalyTrace) => any;
  inferRootCauseForTrace: (traceId: number) => any;
  checkClosedTicketAbnormal: (trace: AnomalyTrace) => boolean;
  ticketAssignees: () => string[];
  setTraceRootCause: (
    traceId: number,
    rootCause: any,
    detail: string,
    confidence: number
  ) => void;
  addTraceProcessingStep: (
    traceId: number,
    action: any,
    description: string,
    operator: string,
    beforeStatus?: string,
    afterStatus?: string
  ) => void;
  updateTraceStatus: (traceId: number, status: TraceStatus) => void;
  markTraceRecovery: (traceId: number, operator: string) => void;
  createOrUpdateTraceFromRecord: (
    record: InspectionRecord,
    anomalyType: TicketAnomalyType,
    ticketId?: number
  ) => Promise<any>;
  externalSelectedRecord?: { record: InspectionRecord; anomalyType: TicketAnomalyType } | null;
  onClearExternalRecord?: () => void;
  onEnterTraceFromRecord?: (record: InspectionRecord) => void;
}

export default function AnomalyTraceList({
  traces,
  records,
  thresholds,
  getTracesForRoom,
  getRecordsForRoom,
  getTicketsForTrace,
  getRecordsForTrace,
  evaluateTraceCloseCondition,
  inferRootCauseForTrace,
  checkClosedTicketAbnormal,
  ticketAssignees,
  setTraceRootCause,
  addTraceProcessingStep,
  updateTraceStatus,
  markTraceRecovery,
  createOrUpdateTraceFromRecord,
  externalSelectedRecord,
  onClearExternalRecord,
}: AnomalyTraceListProps) {
  const [statusFilter, setStatusFilter] = useState<TraceStatusFilter>("全部");
  const [areaFilter, setAreaFilter] = useState<CleanArea | "全部">("全部");
  const [typeFilter, setTypeFilter] = useState<TicketAnomalyType | "全部">("全部");
  const [roomSearch, setRoomSearch] = useState("");
  const [selectedTraceId, setSelectedTraceId] = useState<number | null>(null);
  const [pendingTrace, setPendingTrace] = useState<AnomalyTrace | null>(null);

  useEffect(() => {
    if (!externalSelectedRecord) return;
    const { record, anomalyType } = externalSelectedRecord;
    createOrUpdateTraceFromRecord(record, anomalyType).then((trace) => {
      if (trace) {
        setPendingTrace(trace);
        setSelectedTraceId(trace.id);
      }
    });
    onClearExternalRecord?.();
  }, [externalSelectedRecord, createOrUpdateTraceFromRecord, onClearExternalRecord]);

  const selectedTrace = useMemo(() => {
    if (pendingTrace) return pendingTrace;
    return traces.find((t) => t.id === selectedTraceId) || null;
  }, [traces, selectedTraceId, pendingTrace]);

  const filteredTraces = useMemo(() => {
    return traces.filter((t) => {
      if (statusFilter !== "全部" && t.status !== statusFilter) return false;
      if (areaFilter !== "全部" && t.area !== areaFilter) return false;
      if (typeFilter !== "全部" && t.anomalyType !== typeFilter) return false;
      if (
        roomSearch.trim() &&
        !t.roomId.toLowerCase().includes(roomSearch.trim().toLowerCase())
      )
        return false;
      return true;
    });
  }, [traces, statusFilter, areaFilter, typeFilter, roomSearch]);

  const activeTraces = traces.filter((t) => t.status !== "已恢复");
  const recoveredTraces = traces.filter((t) => t.status === "已恢复");
  const relapseTraces = traces.filter((t) => t.status === "复发");

  const closedTicketAbnormalCount = traces.filter((t) =>
    checkClosedTicketAbnormal(t)
  ).length;

  const abnormalRecords = useMemo(() => {
    return records.filter((r) => {
      const anomalies = checkAnomalies(r, thresholds);
      return !anomalies.none;
    });
  }, [records, thresholds]);

  if (selectedTrace) {
    return (
      <AnomalyTraceDetail
        trace={selectedTrace}
        onBack={() => {
          setSelectedTraceId(null);
          setPendingTrace(null);
        }}
        thresholds={thresholds}
        getRecordsForRoom={getRecordsForRoom}
        getTicketsForTrace={getTicketsForTrace}
        getRecordsForTrace={getRecordsForTrace}
        evaluateTraceCloseCondition={evaluateTraceCloseCondition}
        inferRootCauseForTrace={inferRootCauseForTrace}
        checkClosedTicketAbnormal={checkClosedTicketAbnormal}
        ticketAssignees={ticketAssignees}
        setTraceRootCause={setTraceRootCause}
        addTraceProcessingStep={addTraceProcessingStep}
        updateTraceStatus={updateTraceStatus}
        markTraceRecovery={markTraceRecovery}
      />
    );
  }

  return (
    <section className="trace-section panel">
      <div className="section-heading">
        <div>
          <p>根因追踪</p>
          <h2>洁净室异常根因追踪</h2>
        </div>
        <div className="trace-header-actions">
          <span className="trace-count-badge">共 {traces.length} 条追踪链路</span>
        </div>
      </div>

      <div className="trace-overview-stats">
        <div className="trace-overview-card trace-overview-active">
          <strong>{activeTraces.length}</strong>
          <span>进行中追踪</span>
        </div>
        <div className="trace-overview-card trace-overview-relapse">
          <strong>{relapseTraces.length}</strong>
          <span>复发异常</span>
        </div>
        <div className="trace-overview-card trace-overview-recovered">
          <strong>{recoveredTraces.length}</strong>
          <span>已恢复</span>
        </div>
        <div className="trace-overview-card trace-overview-warning">
          <strong>{closedTicketAbnormalCount}</strong>
          <span>工单关闭但仍异常</span>
        </div>
      </div>

      {abnormalRecords.length > 0 && (
        <div className="trace-entry-panel">
          <h3>从近期异常记录快速进入追踪</h3>
          <div className="trace-entry-records">
            {abnormalRecords.slice(0, 6).map((record) => {
              const anomalies = checkAnomalies(record, thresholds);
              const types: TicketAnomalyType[] = [];
              if (anomalies.particle) types.push("粒子异常");
              if (anomalies.pressure) types.push("压差异常");
              if (anomalies.temp || anomalies.humidity) types.push("温湿度偏移");
              const existingTraces = getTracesForRoom(record.roomId);
              const primaryType = types[0];
              const existingMatchingTrace = existingTraces.find(
                (t) => t.anomalyType === primaryType
              );
              return (
                <div
                  key={record.id}
                  className="trace-entry-card"
                  onClick={async () => {
                    try {
                      const trace = await createOrUpdateTraceFromRecord(
                        record,
                        primaryType
                      );
                      if (trace) {
                        setPendingTrace(trace);
                        setSelectedTraceId(trace.id);
                      }
                    } catch (e) {
                      console.error("创建或更新追踪失败:", e);
                      if (existingMatchingTrace) {
                        setPendingTrace(null);
                        setSelectedTraceId(existingMatchingTrace.id);
                      }
                    }
                  }}
                >
                  <div className="trace-entry-room">
                    <strong>{record.roomId}</strong>
                    <span>{record.area}</span>
                  </div>
                  <div className="trace-entry-types">
                    {types.map((t) => (
                      <span
                        key={t}
                        className={`trace-entry-type ${TICKET_ANOMALY_TYPE_CLASS[t]}`}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="trace-entry-time">{record.createdAt}</div>
                  <div className="trace-entry-action">
                    {existingTraces.length > 0 ? (
                      <span className="trace-entry-has-trace">
                        查看 {existingTraces.length} 条追踪 →
                      </span>
                    ) : (
                      <span className="trace-entry-new">+ 创建追踪链路</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="trace-filters">
        <div className="trace-filter-group">
          <label>搜索房间</label>
          <input
            type="text"
            placeholder="输入房间编号..."
            value={roomSearch}
            onChange={(e) => setRoomSearch(e.target.value)}
          />
        </div>
        <div className="trace-filter-group">
          <label>追踪状态</label>
          <div className="chips muted">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                className={statusFilter === f ? "chip-active" : ""}
                onClick={() => setStatusFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="trace-filter-group">
          <label>洁净等级</label>
          <div className="chips muted">
            {(["全部", ...CLEAN_AREAS] as const).map((f) => (
              <button
                key={f}
                className={areaFilter === f ? "chip-active" : ""}
                onClick={() => setAreaFilter(f as any)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="trace-filter-group">
          <label>异常类型</label>
          <div className="chips muted">
            {(["全部", ...TICKET_ANOMALY_TYPES] as const).map((f) => (
              <button
                key={f}
                className={typeFilter === f ? "chip-active" : ""}
                onClick={() => setTypeFilter(f as any)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="trace-list">
        {filteredTraces.length > 0 ? (
          filteredTraces.map((trace) => {
            const closedAbnormal = checkClosedTicketAbnormal(trace);
            return (
              <article
                key={trace.id}
                className={`trace-card ${
                  closedAbnormal ? "trace-card-warning" : ""
                }`}
                onClick={() => {
                  setPendingTrace(null);
                  setSelectedTraceId(trace.id);
                }}
              >
                <div className="trace-card-header">
                  <div className="trace-card-room">
                    <h3>{trace.roomId}</h3>
                    <span className="trace-card-area">{trace.area}</span>
                  </div>
                  <div className="trace-card-tags">
                    <span
                      className={`trace-status-tag ${TRACE_STATUS_TAG_CLASS[trace.status]}`}
                    >
                      {trace.status}
                    </span>
                    <span
                      className={`trace-type-badge ${TICKET_ANOMALY_TYPE_CLASS[trace.anomalyType]}`}
                    >
                      {trace.anomalyType}
                    </span>
                  </div>
                </div>

                <div className="trace-card-stats">
                  <div className="trace-stat">
                    <span className="trace-stat-label">异常次数</span>
                    <strong className="trace-stat-value">{trace.anomalyCount}</strong>
                  </div>
                  <div className="trace-stat">
                    <span className="trace-stat-label">恢复次数</span>
                    <strong className="trace-stat-value trace-stat-recovery">
                      {trace.recoveryCount}
                    </strong>
                  </div>
                  <div className="trace-stat">
                    <span className="trace-stat-label">处理步骤</span>
                    <strong className="trace-stat-value">
                      {trace.processingSteps.length}
                    </strong>
                  </div>
                  <div className="trace-stat">
                    <span className="trace-stat-label">关联工单</span>
                    <strong className="trace-stat-value">
                      {trace.linkedTicketIds.length}
                    </strong>
                  </div>
                </div>

                {trace.rootCause && (
                  <div className="trace-card-cause">
                    <span className="trace-cause-label">可能根因:</span>
                    <span className="trace-cause-value">{trace.rootCause}</span>
                    {trace.confidence && (
                      <span className="trace-cause-confidence">
                        ({trace.confidence}%)
                      </span>
                    )}
                  </div>
                )}

                {closedAbnormal && (
                  <div className="trace-card-warn">
                    ⚠️ 警告: 关联工单已关闭，但最新数据仍显示异常
                  </div>
                )}

                <div className="trace-card-footer">
                  <span>首次: {trace.firstOccurredAt}</span>
                  <span>最近: {trace.lastOccurredAt}</span>
                  <span className="trace-view-detail">查看详情 →</span>
                </div>
              </article>
            );
          })
        ) : (
          <div className="trace-empty">
            <p>暂无匹配的追踪链路</p>
            <p className="trace-empty-hint">
              调整筛选条件或从上方异常记录创建新的追踪链路
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
