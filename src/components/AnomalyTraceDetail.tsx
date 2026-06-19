import { useState, useMemo } from "react";
import type {
  AnomalyTrace,
  TraceStatus,
  InspectionRecord,
  ProcessingActionType,
  RootCauseCategory,
} from "../domain";
import {
  TRACE_STATUS_TAG_CLASS,
  TICKET_ANOMALY_TYPE_CLASS,
  TRACE_STATUSES,
  ROOT_CAUSE_CATEGORIES,
  PROCESSING_ACTIONS,
  TICKET_STATUS_TAG_CLASS,
  checkAnomalies,
} from "../domain";
import { TICKET_ASSIGNEES } from "../domain";

interface AnomalyTraceDetailProps {
  trace: AnomalyTrace;
  onBack: () => void;
  thresholds: any;
  getRecordsForRoom: (roomId: string, limit?: number) => InspectionRecord[];
  getTicketsForTrace: (trace: AnomalyTrace) => any[];
  getRecordsForTrace: (trace: AnomalyTrace) => InspectionRecord[];
  evaluateTraceCloseCondition: (trace: AnomalyTrace) => {
    condition: any;
    canClose: boolean;
    warnings: string[];
  };
  inferRootCauseForTrace: (traceId: number) => {
    cause: RootCauseCategory;
    detail: string;
    confidence: number;
  } | null;
  checkClosedTicketAbnormal: (trace: AnomalyTrace) => boolean;
  ticketAssignees: () => string[];
  setTraceRootCause: (
    traceId: number,
    rootCause: RootCauseCategory,
    detail: string,
    confidence: number
  ) => void;
  addTraceProcessingStep: (
    traceId: number,
    action: ProcessingActionType,
    description: string,
    operator: string,
    beforeStatus?: string,
    afterStatus?: string
  ) => void;
  updateTraceStatus: (traceId: number, status: TraceStatus) => void;
  markTraceRecovery: (traceId: number, operator: string) => void;
}

export default function AnomalyTraceDetail({
  trace,
  onBack,
  thresholds,
  getRecordsForRoom,
  getTicketsForTrace,
  evaluateTraceCloseCondition,
  inferRootCauseForTrace,
  checkClosedTicketAbnormal,
  ticketAssignees,
  setTraceRootCause,
  addTraceProcessingStep,
  updateTraceStatus,
  markTraceRecovery,
}: AnomalyTraceDetailProps) {
  const [showCauseForm, setShowCauseForm] = useState(false);
  const [showStepForm, setShowStepForm] = useState(false);
  const [showStatusForm, setShowStatusForm] = useState(false);

  const [causeForm, setCauseForm] = useState({
    rootCause: (trace.rootCause ||
      ROOT_CAUSE_CATEGORIES[0]) as RootCauseCategory,
    detail: trace.rootCauseDetail || "",
    confidence: trace.confidence || 50,
  });

  const [stepForm, setStepForm] = useState({
    action: PROCESSING_ACTIONS[0] as ProcessingActionType,
    description: "",
    operator: ticketAssignees()[0],
    beforeStatus: "",
    afterStatus: "",
  });

  const [newStatus, setNewStatus] = useState<TraceStatus>(trace.status);

  const safeThresholds = Array.isArray(thresholds) ? thresholds : [];
  const roomRecords = getRecordsForRoom(trace.roomId, 20) || [];
  const relatedTickets = getTicketsForTrace(trace) || [];
  const closeEvalRaw = evaluateTraceCloseCondition(trace);
  const defaultCondition = {
    particleStable: false,
    pressureStable: false,
    tempHumidityStable: false,
    deviceNormal: false,
    consecutiveNormalRecords: 0,
    ticketsClosed: false,
  };
  const closeEval = closeEvalRaw && closeEvalRaw.condition
    ? {
        ...closeEvalRaw,
        condition: { ...defaultCondition, ...closeEvalRaw.condition },
      }
    : { condition: defaultCondition, canClose: false, warnings: [] as string[] };
  const closedAbnormal = checkClosedTicketAbnormal(trace);
  const inferred = inferRootCauseForTrace(trace.id);

  const continuousAnomalyCount = useMemo(() => {
    if (!roomRecords || roomRecords.length === 0) return 0;
    let count = 0;
    for (let i = 0; i < roomRecords.length; i++) {
      const anomalies = checkAnomalies(roomRecords[i], safeThresholds);
      const matches =
        (trace.anomalyType === "粒子异常" && anomalies.particle) ||
        (trace.anomalyType === "压差异常" && anomalies.pressure) ||
        (trace.anomalyType === "温湿度偏移" &&
          (anomalies.temp || anomalies.humidity));
      if (matches) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }, [roomRecords, trace.anomalyType, safeThresholds]);

  const recoveryRelapsePattern = useMemo(() => {
    if (!roomRecords || roomRecords.length === 0) return [];
    const patterns: string[] = [];
    let prevAnomaly = false;
    let inRecovery = false;
    for (let i = roomRecords.length - 1; i >= 0; i--) {
      const anomalies = checkAnomalies(roomRecords[i], safeThresholds);
      const matches =
        (trace.anomalyType === "粒子异常" && anomalies.particle) ||
        (trace.anomalyType === "压差异常" && anomalies.pressure) ||
        (trace.anomalyType === "温湿度偏移" &&
          (anomalies.temp || anomalies.humidity));
      if (matches && !prevAnomaly) {
        if (inRecovery) {
          patterns.push(`${roomRecords[i].createdAt} 再次超限（复发）`);
        }
        prevAnomaly = true;
        inRecovery = false;
      } else if (!matches && prevAnomaly) {
        inRecovery = true;
        prevAnomaly = false;
      }
    }
    return patterns;
  }, [roomRecords, trace.anomalyType, safeThresholds]);

  const latestDeviceStatus = roomRecords[0]?.deviceStatus || "未知";

  return (
    <section className="trace-detail-panel panel">
      <div className="trace-detail-header">
        <button className="trace-back-btn" onClick={onBack}>
          ← 返回列表
        </button>
        <div className="trace-detail-title">
          <div>
            <h2>{trace.roomId}</h2>
            <div className="trace-detail-tags">
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
              <span className="trace-area-tag">{trace.area}</span>
            </div>
          </div>
          <div className="trace-detail-actions">
            <button onClick={() => setShowStatusForm(true)}>
              更改状态
            </button>
            {!closeEval.canClose && trace.status !== "已恢复" && (
              <button
                className="primary-action"
                onClick={() =>
                  markTraceRecovery(trace.id, TICKET_ASSIGNEES[0])
                }
              >
                标记恢复
              </button>
            )}
          </div>
        </div>
      </div>

      {closedAbnormal && (
        <div className="trace-detail-alert trace-alert-warning">
          <strong>⚠️ 边界场景检测：工单关闭但数据仍异常</strong>
          <p>
            该房间的关联工单状态显示已关闭，但最新巡检数据仍显示存在
            {trace.anomalyType}。建议重新评估工单关闭条件或重新开启新工单。
          </p>
        </div>
      )}

      {continuousAnomalyCount >= 3 && (
        <div className="trace-detail-alert trace-alert-info">
          <strong>📊 连续异常提示</strong>
          <p>
            该房间已连续 {continuousAnomalyCount} 次巡检出现
            {trace.anomalyType}，属于连续多次异常。建议优先处理并记录处理步骤。
          </p>
        </div>
      )}

      {recoveryRelapsePattern.length > 0 && trace.status === "复发" && (
        <div className="trace-detail-alert trace-alert-relapse">
          <strong>🔄 异常复发记录</strong>
          <ul>
            {recoveryRelapsePattern.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="trace-detail-grid">
        <div className="trace-detail-col trace-detail-main">
          <section className="trace-section">
            <h3>📋 最近记录变化</h3>
            <div className="trace-record-timeline">
              {roomRecords.length > 0 ? (
                roomRecords.slice(0, 10).map((record, idx) => {
                  const anomalies = checkAnomalies(record, thresholds);
                  const matches =
                    (trace.anomalyType === "粒子异常" && anomalies.particle) ||
                    (trace.anomalyType === "压差异常" && anomalies.pressure) ||
                    (trace.anomalyType === "温湿度偏移" &&
                      (anomalies.temp || anomalies.humidity));
                  return (
                    <div
                      key={record.id}
                      className={`trace-record-item ${
                        matches ? "trace-record-abnormal" : ""
                      }`}
                    >
                      <div className="trace-record-time">{record.createdAt}</div>
                      <div className="trace-record-values">
                        <span>粒子: {record.particle05um.toLocaleString()}</span>
                        <span>压差: {record.pressure}Pa</span>
                        <span>温度: {record.temperature}°C</span>
                        <span>湿度: {record.humidity}%</span>
                        <span>设备: {record.deviceStatus}</span>
                      </div>
                      {matches && (
                        <span className="trace-record-badge">异常</span>
                      )}
                      {idx === 0 && (
                        <span className="trace-record-latest">最新</span>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="trace-empty-text">暂无该房间的巡检记录</p>
              )}
            </div>
          </section>

          <section className="trace-section">
            <h3>🛠️ 处理过程时间线</h3>
            <div className="trace-processing-timeline">
              {trace.processingSteps.length > 0 ? (
                trace.processingSteps.map((step, idx) => (
                  <div key={step.id} className="trace-step-item">
                    <div className="trace-step-dot">{idx + 1}</div>
                    <div className="trace-step-content">
                      <div className="trace-step-header">
                        <span className="trace-step-action">{step.action}</span>
                        <span className="trace-step-time">{step.timestamp}</span>
                      </div>
                      <div className="trace-step-operator">操作人: {step.operator}</div>
                      <div className="trace-step-desc">{step.description}</div>
                      {(step.beforeStatus || step.afterStatus) && (
                        <div className="trace-step-change">
                          {step.beforeStatus && (
                            <span>变更前: {step.beforeStatus}</span>
                          )}
                          {step.beforeStatus && step.afterStatus && (
                            <span className="trace-step-arrow">→</span>
                          )}
                          {step.afterStatus && (
                            <span>变更后: {step.afterStatus}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="trace-empty-text">暂无处理记录</p>
              )}
            </div>
            <button
              className="trace-add-step-btn"
              onClick={() => setShowStepForm(true)}
            >
              + 添加处理步骤
            </button>
          </section>
        </div>

        <div className="trace-detail-col trace-detail-side">
          <section className="trace-section">
            <h3>🏠 房间与设备状态</h3>
            <div className="trace-room-info">
              <div className="trace-info-row">
                <span>房间编号</span>
                <strong>{trace.roomId}</strong>
              </div>
              <div className="trace-info-row">
                <span>洁净等级</span>
                <strong>{trace.area}</strong>
              </div>
              <div className="trace-info-row">
                <span>异常类型</span>
                <strong>{trace.anomalyType}</strong>
              </div>
              <div className="trace-info-row">
                <span>首次发生</span>
                <strong>{trace.firstOccurredAt}</strong>
              </div>
              <div className="trace-info-row">
                <span>最近发生</span>
                <strong>{trace.lastOccurredAt}</strong>
              </div>
              <div className="trace-info-row">
                <span>异常次数</span>
                <strong className="trace-stat-warn">
                  {trace.anomalyCount} 次
                </strong>
              </div>
              <div className="trace-info-row">
                <span>恢复次数</span>
                <strong className="trace-stat-ok">
                  {trace.recoveryCount} 次
                </strong>
              </div>
              <div className="trace-info-row">
                <span>最新设备状态</span>
                <strong
                  className={
                    latestDeviceStatus === "故障"
                      ? "trace-stat-warn"
                      : "trace-stat-ok"
                  }
                >
                  {latestDeviceStatus}
                </strong>
              </div>
            </div>
          </section>

          <section className="trace-section">
            <h3>🔍 可能根因分析</h3>
            {trace.rootCause ? (
              <div className="trace-cause-panel">
                <div className="trace-cause-main">
                  <span className="trace-cause-category">
                    {trace.rootCause}
                  </span>
                  {trace.confidence && (
                    <div className="trace-cause-confidence">
                      <div
                        className="trace-cause-bar"
                        style={{ width: `${trace.confidence}%` }}
                      />
                      <span>{trace.confidence}%</span>
                    </div>
                  )}
                </div>
                {trace.rootCauseDetail && (
                  <p className="trace-cause-detail">
                    {trace.rootCauseDetail}
                  </p>
                )}
                <button onClick={() => setShowCauseForm(true)}>
                  更新根因
                </button>
              </div>
            ) : (
              <div className="trace-cause-empty">
                {inferred ? (
                  <>
                    <div className="trace-cause-suggested">
                      <p>
                        💡 基于数据分析建议根因:
                      </p>
                      <strong>{inferred.cause}</strong>
                      <span className="trace-cause-confidence-mini">
                        ({inferred.confidence}%)
                      </span>
                    </div>
                    <p className="trace-cause-detail">{inferred.detail}</p>
                    <button
                      className="primary-action"
                      onClick={() => {
                        setCauseForm({
                          rootCause: inferred.cause,
                          detail: inferred.detail,
                          confidence: inferred.confidence,
                        });
                        setShowCauseForm(true);
                      }}
                    >
                      应用并编辑
                    </button>
                  </>
                ) : (
                  <>
                    <p className="trace-empty-text">暂无根因判断</p>
                    <button onClick={() => setShowCauseForm(true)}>
                      + 记录根因
                    </button>
                  </>
                )}
              </div>
            )}
          </section>

          <section className="trace-section">
            <h3>📑 关联工单</h3>
            <div className="trace-tickets-list">
              {relatedTickets.length > 0 ? (
                relatedTickets.map((ticket) => (
                  <div key={ticket.id} className="trace-ticket-item">
                    <div className="trace-ticket-header">
                      <span className="trace-ticket-id">#{ticket.id}</span>
                      <span
                        className={`ticket-status-tag ${TICKET_STATUS_TAG_CLASS[ticket.status as keyof typeof TICKET_STATUS_TAG_CLASS] || ""}`}
                      >
                        {ticket.status}
                      </span>
                    </div>
                    <div className="trace-ticket-info">
                      <span>负责人: {ticket.assignee}</span>
                      <span>{ticket.createdAt}</span>
                    </div>
                    {ticket.remark && (
                      <p className="trace-ticket-remark">{ticket.remark}</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="trace-empty-text">暂无关联工单</p>
              )}
            </div>
          </section>

          <section className="trace-section">
            <h3>✅ 关闭条件检查</h3>
            <div className="trace-close-conditions">
              <div
                className={`trace-condition-item ${
                  closeEval.condition.particleStable ? "trace-condition-ok" : ""
                }`}
              >
                <span>粒子计数稳定</span>
                <span>{closeEval.condition.particleStable ? "✓" : "✗"}</span>
              </div>
              <div
                className={`trace-condition-item ${
                  closeEval.condition.pressureStable ? "trace-condition-ok" : ""
                }`}
              >
                <span>压差稳定</span>
                <span>{closeEval.condition.pressureStable ? "✓" : "✗"}</span>
              </div>
              <div
                className={`trace-condition-item ${
                  closeEval.condition.tempHumidityStable ? "trace-condition-ok" : ""
                }`}
              >
                <span>温湿度稳定</span>
                <span>
                  {closeEval.condition.tempHumidityStable ? "✓" : "✗"}
                </span>
              </div>
              <div
                className={`trace-condition-item ${
                  closeEval.condition.deviceNormal ? "trace-condition-ok" : ""
                }`}
              >
                <span>设备状态正常</span>
                <span>{closeEval.condition.deviceNormal ? "✓" : "✗"}</span>
              </div>
              <div
                className={`trace-condition-item ${
                  closeEval.condition.consecutiveNormalRecords >= 3
                    ? "trace-condition-ok"
                    : ""
                }`}
              >
                <span>连续正常记录</span>
                <span>
                  {closeEval.condition.consecutiveNormalRecords}/3
                </span>
              </div>
              <div
                className={`trace-condition-item ${
                  closeEval.condition.ticketsClosed ? "trace-condition-ok" : ""
                }`}
              >
                <span>关联工单关闭</span>
                <span>{closeEval.condition.ticketsClosed ? "✓" : "✗"}</span>
              </div>
            </div>
            {closeEval.warnings.length > 0 && (
              <div className="trace-close-warnings">
                <strong>关闭前需解决:</strong>
                <ul>
                  {closeEval.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            {closeEval.canClose && (
              <div className="trace-close-ready">
                ✓ 所有条件已满足，可关闭追踪链路
              </div>
            )}
          </section>
        </div>
      </div>

      {showCauseForm && (
        <div className="trace-modal-overlay" onClick={() => setShowCauseForm(false)}>
          <div className="trace-modal" onClick={(e) => e.stopPropagation()}>
            <h3>设置可能根因</h3>
            <label>
              <span>根因分类</span>
              <select
                value={causeForm.rootCause}
                onChange={(e) =>
                  setCauseForm((p) => ({
                    ...p,
                    rootCause: e.target.value as RootCauseCategory,
                  }))
                }
              >
                {ROOT_CAUSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>详细说明</span>
              <textarea
                rows={4}
                value={causeForm.detail}
                onChange={(e) =>
                  setCauseForm((p) => ({ ...p, detail: e.target.value }))
                }
                placeholder="描述根因的具体细节..."
              />
            </label>
            <label>
              <span>置信度: {causeForm.confidence}%</span>
              <input
                type="range"
                min="0"
                max="100"
                value={causeForm.confidence}
                onChange={(e) =>
                  setCauseForm((p) => ({
                    ...p,
                    confidence: Number(e.target.value),
                  }))
                }
              />
            </label>
            <div className="trace-modal-actions">
              <button onClick={() => setShowCauseForm(false)}>取消</button>
              <button
                className="primary-action"
                onClick={() => {
                  setTraceRootCause(
                    trace.id,
                    causeForm.rootCause,
                    causeForm.detail,
                    causeForm.confidence
                  );
                  setShowCauseForm(false);
                }}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {showStepForm && (
        <div className="trace-modal-overlay" onClick={() => setShowStepForm(false)}>
          <div className="trace-modal" onClick={(e) => e.stopPropagation()}>
            <h3>添加处理步骤</h3>
            <label>
              <span>操作类型</span>
              <select
                value={stepForm.action}
                onChange={(e) =>
                  setStepForm((p) => ({
                    ...p,
                    action: e.target.value as ProcessingActionType,
                  }))
                }
              >
                {PROCESSING_ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>操作说明</span>
              <textarea
                rows={3}
                value={stepForm.description}
                onChange={(e) =>
                  setStepForm((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="详细描述这次操作..."
              />
            </label>
            <label>
              <span>操作人</span>
              <select
                value={stepForm.operator}
                onChange={(e) =>
                  setStepForm((p) => ({ ...p, operator: e.target.value }))
                }
              >
                {ticketAssignees().map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <div className="trace-form-row">
              <label>
                <span>变更前状态(可选)</span>
                <input
                  type="text"
                  value={stepForm.beforeStatus}
                  onChange={(e) =>
                    setStepForm((p) => ({ ...p, beforeStatus: e.target.value }))
                  }
                  placeholder="如: 8Pa"
                />
              </label>
              <label>
                <span>变更后状态(可选)</span>
                <input
                  type="text"
                  value={stepForm.afterStatus}
                  onChange={(e) =>
                    setStepForm((p) => ({ ...p, afterStatus: e.target.value }))
                  }
                  placeholder="如: 12Pa"
                />
              </label>
            </div>
            <div className="trace-modal-actions">
              <button onClick={() => setShowStepForm(false)}>取消</button>
              <button
                className="primary-action"
                onClick={() => {
                  if (stepForm.description.trim()) {
                    addTraceProcessingStep(
                      trace.id,
                      stepForm.action,
                      stepForm.description.trim(),
                      stepForm.operator,
                      stepForm.beforeStatus || undefined,
                      stepForm.afterStatus || undefined
                    );
                    setStepForm({
                      action: PROCESSING_ACTIONS[0],
                      description: "",
                      operator: ticketAssignees()[0],
                      beforeStatus: "",
                      afterStatus: "",
                    });
                    setShowStepForm(false);
                  }
                }}
              >
                确认添加
              </button>
            </div>
          </div>
        </div>
      )}

      {showStatusForm && (
        <div
          className="trace-modal-overlay"
          onClick={() => setShowStatusForm(false)}
        >
          <div className="trace-modal" onClick={(e) => e.stopPropagation()}>
            <h3>更改追踪状态</h3>
            <label>
              <span>新状态</span>
              <select
                value={newStatus}
                onChange={(e) =>
                  setNewStatus(e.target.value as TraceStatus)
                }
              >
                {TRACE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <div className="trace-modal-actions">
              <button onClick={() => setShowStatusForm(false)}>取消</button>
              <button
                className="primary-action"
                onClick={() => {
                  updateTraceStatus(trace.id, newStatus);
                  setShowStatusForm(false);
                }}
              >
                确认更改
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
