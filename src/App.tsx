import { useMemo, useState, useRef } from "react";
import "./styles.css";
import {
  MetricCard,
  ConfirmDialog,
  ThresholdConfig,
  PreviewTable,
  InspectionRecordForm,
  InspectionSchedule,
  AnomalyTicketManagement,
  InspectionRecordsList,
  DataExportPanel,
  SyncStatusBar,
  AnomalyTraceList,
  ConflictResolutionDialog,
} from "./components";
import type { SyncConflict } from "./domain";
import AnomalyTrendAnalysis from "./AnomalyTrendAnalysis";
import RoleDashboard from "./RoleDashboard";
import { useAppStore } from "./stores";
import type {
  AnomalyType,
  CleanArea,
  InspectionRecord,
  PlanStatus,
  RoleType,
  TicketAnomalyType,
  TicketStatus,
  TrendAnomalyType,
} from "./domain";
import { checkAnomalies, getRecordStatus } from "./domain";
import type { UseAppStoreReturn } from "./stores/useAppStore";

type SampleRecord = {
  id: number;
  roomId: string;
  area: CleanArea;
  particle05um: number;
  particle5um: number;
  pressure: number;
  temperature: number;
  humidity: number;
};

const sampleRecords: SampleRecord[] = [
  { id: 1, roomId: "CR-1201", area: "ISO 5", particle05um: 4200, particle5um: 35, pressure: 15, temperature: 22, humidity: 45 },
  { id: 2, roomId: "CR-2107", area: "ISO 6", particle05um: 28000, particle5um: 200, pressure: 15, temperature: 22, humidity: 48 },
  { id: 3, roomId: "Y-0302", area: "黄光区", particle05um: 30000, particle5um: 250, pressure: 12, temperature: 23, humidity: 54 },
  { id: 4, roomId: "CR-3305", area: "ISO 7", particle05um: 380000, particle5um: 3100, pressure: 7, temperature: 27, humidity: 62 },
  { id: 5, roomId: "CR-1108", area: "ISO 5", particle05um: 2800, particle5um: 20, pressure: 14, temperature: 21, humidity: 42 },
];

const project = {
  id: "hxwl-09",
  port: 5109,
  title: "半导体洁净室巡检",
  subtitle: "洁净等级阈值、粒子计数与异常处理看板",
  stack: "React + Vite + TypeScript + CSS",
  domain: "洁净室巡检",
  users: ["巡检员", "厂务工程师", "班组长"] as RoleType[],
  metrics: ["粒子异常", "压差异常", "温湿度偏移", "待处理数量"],
};

function App() {
  const store: UseAppStoreReturn = useAppStore();
  const {
    thresholds,
    inspectionRecords,
    anomalyTickets,
    inspectionPlans,
    filters,
    syncStatus,
    syncQueue,
    syncConflicts,
    isLoading,
    isMigrating,
    migrationContext,
    isOnline,
    anomalyTraces,
    setThresholds,
    addInspectionRecord,
    linkRecordToPlan,
    getTodayPlans,
    createTicketFromRecord,
    hasTicketForRecord,
    getExistingRoomIds,
    createAnomalyTicket,
    updateAnomalyTicketStatus,
    createInspectionPlan,
    setFilters,
    countTicketsByStatus,
    countPlansByStatus,
    exportRecordsCsv,
    exportTicketsCsv,
    exportPlansCsv,
    exportAllJson,
    exportTeamReviewReport,
    resetToSampleData,
    forceResetToSampleData,
    clearLocalData,
    backupAndDownload,
    syncPending,
    processQueue,
    retryQueueItem,
    retryAllFailed,
    removeQueueItem,
    clearSyncedQueueItems,
    resolveConflict,
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
  } = store;

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showAdvancedResetConfirm, setShowAdvancedResetConfirm] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [resetBackupDownloaded, setResetBackupDownloaded] = useState(false);
  const [traceEntryRecord, setTraceEntryRecord] = useState<{
    record: any;
    anomalyType: TicketAnomalyType;
  } | null>(null);
  const traceSectionRef = useRef<HTMLDivElement>(null);
  const [selectedConflict, setSelectedConflict] = useState<SyncConflict | null>(null);

  const handleAddTicket = (
    ticketData: Omit<
      import("./domain").AnomalyTicket,
      "id" | "createdAt" | "status" | "processNotes"
    >
  ) => {
    createAnomalyTicket(ticketData);
  };

  const handleCreateTicketFromRecord = async (
    record: SampleRecord,
    anomalyType: TicketAnomalyType
  ) => {
    await createTicketFromRecord(
      {
        roomId: record.roomId,
        area: record.area,
        particle05um: record.particle05um,
        particle5um: record.particle5um,
        pressure: record.pressure,
        temperature: record.temperature,
        humidity: record.humidity,
        sourceRecordId: record.id,
      },
      anomalyType
    );
  };

  const metricValues = useMemo(() => {
    const results = sampleRecords.map((r) => checkAnomalies(r, thresholds));
    const particle = results.filter((r) => r.particle).length;
    const pressure = results.filter((r) => r.pressure).length;
    const temphum = results.filter((r) => r.temp || r.humidity).length;
    const total = sampleRecords.length - results.filter((r) => r.none).length;
    return [String(particle), String(pressure), String(temphum), String(total)];
  }, [thresholds]);

  const handleSubmitInspectionRecord = async (record: InspectionRecord, planId?: number) => {
    addInspectionRecord(record);
    if (planId) {
      linkRecordToPlan(planId, record.id);
    }

    const anomalies = checkAnomalies(record, thresholds);
    const anomalyTypes: TicketAnomalyType[] = [];
    if (anomalies.particle) anomalyTypes.push("粒子异常");
    if (anomalies.pressure) anomalyTypes.push("压差异常");
    if (anomalies.temp || anomalies.humidity) anomalyTypes.push("温湿度偏移");

    for (const anomalyType of anomalyTypes) {
      const hasExistingTicket = hasTicketForRecord(record.id, anomalyType);
      if (!hasExistingTicket) {
        try {
          await createTicketFromRecord(
            {
              roomId: record.roomId,
              area: record.area,
              particle05um: record.particle05um,
              particle5um: record.particle5um,
              pressure: record.pressure,
              temperature: record.temperature,
              humidity: record.humidity,
              sourceRecordId: record.id,
              sourceRecord: record,
            },
            anomalyType
          );
        } catch (e) {
          console.error("自动创建工单或追踪失败:", e);
        }
      } else {
        try {
          await createOrUpdateTraceFromRecord(record, anomalyType);
        } catch (e) {
          console.error("更新追踪失败:", e);
        }
      }
    }

    if (anomalies.none) {
      const roomTraces = getTracesForRoom(record.roomId);
      for (const trace of roomTraces) {
        if (trace.status !== "已恢复") {
          try {
            await createOrUpdateTraceFromRecord(record, trace.anomalyType);
          } catch (e) {
            console.error("更新追踪恢复状态失败:", e);
          }
        }
      }
    }
  };

  const handlePlanStatusFilter = (filter: "全部" | PlanStatus) => {
    setFilters({ ...filters, planStatusFilter: filter });
  };

  const handleTicketStatusFilter = (filter: "全部" | TicketStatus) => {
    setFilters({ ...filters, ticketStatusFilter: filter });
  };

  const handleTrendAreaFilter = (area: CleanArea | "全部") => {
    setFilters({ ...filters, trendAreaFilter: area });
  };

  const handleTrendTypeFilter = (type: TrendAnomalyType) => {
    setFilters({ ...filters, trendTypeFilter: type });
  };

  const handleRoleChange = (role: RoleType) => {
    setFilters({ ...filters, activeRole: role });
  };

  const handleInspectorChange = (inspector: string) => {
    setFilters({ ...filters, activeInspector: inspector });
  };

  const handleConfirmClear = async () => {
    await clearLocalData();
    setShowClearConfirm(false);
  };

  const handleShowResetConfirm = () => {
    setResetBackupDownloaded(false);
    setShowAdvancedResetConfirm(true);
  };

  const handleBackupBeforeReset = async () => {
    await backupAndDownload();
    setResetBackupDownloaded(true);
  };

  const handleConfirmReset = async () => {
    if (!resetBackupDownloaded && inspectionRecords.length > 0) {
      const confirmed = window.confirm(
        "您还没有备份当前数据！确定要在未备份的情况下恢复示例数据吗？\n\n建议先点击「备份当前数据」按钮进行备份。"
      );
      if (!confirmed) return;
    }
    await forceResetToSampleData();
    setShowAdvancedResetConfirm(false);
    setResetBackupDownloaded(false);
  };

  const handleCancelReset = () => {
    setShowAdvancedResetConfirm(false);
    setResetBackupDownloaded(false);
  };

  const handleSyncNow = async () => {
    const result = await processQueue("all");
    const parts: string[] = [];
    if (result.syncedRecords > 0) parts.push(`记录 ${result.syncedRecords}`);
    if (result.syncedTickets > 0) parts.push(`工单 ${result.syncedTickets}`);
    if (result.syncedPlans > 0) parts.push(`计划 ${result.syncedPlans}`);
    if (result.syncedTraces > 0) parts.push(`追踪 ${result.syncedTraces}`);

    let msg: string;
    const conflictCount =
      (result as any).conflictedRecords +
      (result as any).conflictedTickets +
      (result as any).conflictedPlans +
      (result as any).conflictedTraces || 0;
    if (result.errors.length > 0) {
      const failedCount = result.detailedResults.filter((r) => r.status === "failed").length;
      const conflictItems = result.detailedResults.filter((r) => r.status === "conflict").length;
      const successPart = parts.length > 0 ? `成功：${parts.join("、")}；` : "";
      const conflictPart = conflictItems > 0 ? `${conflictItems} 项冲突需要处理；` : "";
      msg = `${successPart}${conflictPart}${failedCount > 0 ? `${failedCount} 项失败：` : ""}${result.errors.slice(0, 2).join("；")}${result.errors.length > 2 ? "..." : ""}`;
    } else if (conflictCount > 0) {
      const successPart = parts.length > 0 ? `成功：${parts.join("、")}；` : "";
      msg = `${successPart}检测到 ${conflictCount} 项数据冲突，请在同步队列中查看并处理`;
    } else if (parts.length > 0) {
      msg = `同步完成：${parts.join("、")}`;
    } else {
      msg = "没有需要同步的项目";
    }
    setSyncMessage(msg);
    setTimeout(() => setSyncMessage(""), 4500);
  };

  const handleViewTraceFromRecord = (record: any, anomalyType: TicketAnomalyType) => {
    setTraceEntryRecord({ record, anomalyType });
    setTimeout(() => {
      document
        .querySelector(".trace-section")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case "createRecord":
      case "scanQR":
        document
          .querySelector(".record-form-panel")
          ?.scrollIntoView({ behavior: "smooth" });
        break;
      case "viewSchedule":
      case "assignTask":
        document
          .querySelector(".plan-section")
          ?.scrollIntoView({ behavior: "smooth" });
        break;
      case "createDeviceTicket":
      case "viewDevices":
        document
          .querySelector(".ticket-section")
          ?.scrollIntoView({ behavior: "smooth" });
        break;
      case "configureThreshold":
        document
          .querySelector(".threshold-panel")
          ?.scrollIntoView({ behavior: "smooth" });
        break;
      case "exportReport":
        document
          .querySelector(".export-panel")
          ?.scrollIntoView({ behavior: "smooth" });
        break;
      default:
        break;
    }
  };

  if (isLoading) {
    return (
      <main className="app-shell">
        <div className="loading-panel panel">
          <div className="loading-spinner" />
          <p className="loading-text">正在加载本地数据...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <SyncStatusBar
        syncStatus={syncStatus}
        syncQueue={syncQueue}
        syncConflicts={syncConflicts}
        onSyncNow={handleSyncNow}
        onProcessQueue={processQueue}
        onRetryFailed={retryAllFailed}
        onRetryItem={retryQueueItem}
        onRemoveItem={removeQueueItem}
        onClearSynced={clearSyncedQueueItems}
        onResolveConflict={resolveConflict}
        onOpenConflictPanel={() => {
          const firstUnresolved = syncConflicts.find((c) => !c.resolvedAt);
          if (firstUnresolved) setSelectedConflict(firstUnresolved);
        }}
      />
      {syncMessage && <div className="sync-message">{syncMessage}</div>}

      <section className="hero">
        <div>
          <p className="eyebrow">
            {project.id} · port {project.port} ·{" "}
            <span className={isOnline ? "hero-online" : "hero-offline"}>
              {isOnline ? "● 在线" : "● 离线模式"}
            </span>
          </p>
          <h1>{project.title}</h1>
          <p className="subtitle">{project.subtitle}</p>
          <div className="hero-actions">
            <button
              className="hero-action-btn secondary"
              onClick={handleShowResetConfirm}
            >
              恢复示例数据
            </button>
            <button
              className="hero-action-btn danger"
              onClick={() => setShowClearConfirm(true)}
            >
              清空本地数据
            </button>
          </div>
        </div>
        <div className="stack-card">
          <span>技术栈</span>
          <strong>{project.stack}</strong>
          <div className="storage-info">
            <span className="storage-label">数据存储</span>
            <span className="storage-value">本地 IndexedDB</span>
          </div>
        </div>
      </section>

      <RoleDashboard
        onQuickAction={handleQuickAction}
        activeRole={filters.activeRole}
        onRoleChange={handleRoleChange}
        activeInspector={filters.activeInspector}
        onInspectorChange={handleInspectorChange}
        inspectionPlans={inspectionPlans}
        inspectionRecords={inspectionRecords}
        anomalyTickets={anomalyTickets}
        anomalyTraces={anomalyTraces}
        thresholds={thresholds}
        todayPlans={getTodayPlans()}
      />

      <section className="metrics-grid">
        {project.metrics.map((metric: string, index: number) => (
          <MetricCard
            key={metric}
            label={metric}
            value={metricValues[index]}
            index={index}
          />
        ))}
      </section>

      <AnomalyTrendAnalysis
        selectedArea={filters.trendAreaFilter}
        selectedType={filters.trendTypeFilter}
        onAreaChange={handleTrendAreaFilter}
        onTypeChange={handleTrendTypeFilter}
        inspectionRecords={inspectionRecords}
        anomalyTickets={anomalyTickets}
        thresholds={thresholds}
      />

      <AnomalyTraceList
        traces={anomalyTraces}
        records={inspectionRecords}
        thresholds={thresholds}
        getTracesForRoom={getTracesForRoom}
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
        createOrUpdateTraceFromRecord={createOrUpdateTraceFromRecord}
        externalSelectedRecord={traceEntryRecord}
        onClearExternalRecord={() => setTraceEntryRecord(null)}
      />

      <ThresholdConfig
        thresholds={thresholds}
        inspectionRecords={inspectionRecords}
        onUpdate={setThresholds}
      />

      <PreviewTable
        thresholds={thresholds}
        onCreateTicket={handleCreateTicketFromRecord}
        hasTicketForRecord={hasTicketForRecord}
      />

      <section className="workspace">
        <aside className="panel narrow">
          <h2>角色</h2>
          <div className="chips">
            {project.users.map((user: string) => (
              <span key={user}>{user}</span>
            ))}
          </div>
          <h2>筛选</h2>
          <div className="chips muted">
            {["ISO 5", "ISO 6", "ISO 7", "黄光区"].map((filter: string) => (
              <button key={filter}>{filter}</button>
            ))}
          </div>
          <h2>统计</h2>
          <div className="sidebar-stats">
            <div className="sidebar-stat">
              <strong>{inspectionRecords.length}</strong>
              <span>巡检记录</span>
            </div>
            <div className="sidebar-stat">
              <strong>{anomalyTickets.filter((t) => t.status !== "已关闭").length}</strong>
              <span>待处理工单</span>
            </div>
            <div className="sidebar-stat">
              <strong>{inspectionPlans.filter((p) => p.status === "进行中").length}</strong>
              <span>进行中计划</span>
            </div>
          </div>
        </aside>

        <InspectionRecordForm
          thresholds={thresholds}
          onSubmit={handleSubmitInspectionRecord}
          existingRoomIds={getExistingRoomIds()}
          todayPlans={getTodayPlans()}
        />
      </section>

      <InspectionSchedule
        plans={inspectionPlans}
        activeFilter={filters.planStatusFilter}
        onFilterChange={handlePlanStatusFilter}
        onAddPlan={(plan) => createInspectionPlan(plan)}
        onStatusChange={(planId, status) => store.updateInspectionPlanStatus(planId, status)}
      />

      <AnomalyTicketManagement
        tickets={anomalyTickets}
        activeFilter={filters.ticketStatusFilter}
        onFilterChange={handleTicketStatusFilter}
        onAddTicket={handleAddTicket}
        onStatusChange={updateAnomalyTicketStatus}
      />

      <InspectionRecordsList
        records={inspectionRecords}
        thresholds={thresholds}
        onViewTrace={handleViewTraceFromRecord}
      />

      <DataExportPanel
        onExportRecords={exportRecordsCsv}
        onExportTickets={exportTicketsCsv}
        onExportPlans={exportPlansCsv}
        onExportAll={exportAllJson}
        onExportTeamReview={exportTeamReviewReport}
      />

      <ConfirmDialog
        open={showClearConfirm}
        title="清空本地数据"
        message="确定要清空所有本地存储的数据吗？此操作将删除所有巡检记录、阈值配置、异常工单和筛选条件，并恢复为内置示例数据。"
        confirmText="确认清空"
        cancelText="取消"
        danger
        onConfirm={handleConfirmClear}
        onCancel={() => setShowClearConfirm(false)}
      />

      <ConfirmDialog
        open={showResetConfirm}
        title="恢复示例数据"
        message="确定要恢复为内置示例数据吗？此操作将覆盖当前所有数据并恢复为初始示例数据。"
        confirmText="确认恢复"
        cancelText="取消"
        onConfirm={handleConfirmReset}
        onCancel={() => setShowResetConfirm(false)}
      />

      {showAdvancedResetConfirm && (
        <div className="confirm-overlay" onClick={handleCancelReset}>
          <div
            className="confirm-modal reset-confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="confirm-title">⚠️ 恢复示例数据</h3>
            <div className="reset-confirm-content">
              <p className="confirm-message">
                此操作将 <strong>覆盖所有本地数据</strong>
                并恢复为内置示例数据。建议先备份您的数据！
              </p>

              <div className="data-stats-panel">
                <h4>当前数据统计</h4>
                <div className="data-stats-grid">
                  <div className="data-stat-item">
                    <span className="data-stat-value">{inspectionRecords.length}</span>
                    <span className="data-stat-label">巡检记录</span>
                  </div>
                  <div className="data-stat-item">
                    <span className="data-stat-value">{anomalyTickets.length}</span>
                    <span className="data-stat-label">异常工单</span>
                  </div>
                  <div className="data-stat-item">
                    <span className="data-stat-value">{anomalyTraces.length}</span>
                    <span className="data-stat-label">异常追踪</span>
                  </div>
                  <div className="data-stat-item">
                    <span className="data-stat-value">{inspectionPlans.length}</span>
                    <span className="data-stat-label">巡检计划</span>
                  </div>
                </div>
              </div>

              <div className="reset-actions-section">
                <button
                  className={`backup-btn ${resetBackupDownloaded ? "backup-btn-success" : ""}`}
                  onClick={handleBackupBeforeReset}
                >
                  {resetBackupDownloaded ? "✅ 备份已下载" : "💾 备份当前数据 (JSON)"}
                </button>
                <p className="backup-hint">
                  {resetBackupDownloaded
                    ? "备份已成功下载，您可以安全地恢复示例数据了。"
                    : "点击上方按钮下载当前所有数据的备份文件，以防数据丢失。"}
                </p>
              </div>
            </div>
            <div className="confirm-actions">
              <button onClick={handleCancelReset}>取消</button>
              <button
                className={resetBackupDownloaded ? "primary-action" : "danger"}
                onClick={handleConfirmReset}
              >
                {resetBackupDownloaded ? "确认恢复示例数据" : "跳过备份，直接恢复"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConflictResolutionDialog
        open={selectedConflict !== null}
        conflict={selectedConflict}
        onResolve={resolveConflict}
        onClose={() => setSelectedConflict(null)}
      />
    </main>
  );
}

export default App;
