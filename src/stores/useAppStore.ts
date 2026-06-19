import { useCallback, useEffect, useState } from "react";
import type {
  AnomalyCheckResult,
  AnomalyTicket,
  AnomalyTicketInput,
  AnomalyTrace,
  AnomalyTraceInput,
  AreaThreshold,
  BackupData,
  CleanArea,
  FilterConditions,
  InspectionPlan,
  InspectionRecord,
  InspectionRecordInput,
  MigrationContext,
  PlanStatus,
  ProcessingActionType,
  RecordStatusResult,
  RootCauseCategory,
  SyncConflict,
  SyncEntityType,
  SyncQueueItem,
  SyncStatus,
  TicketAnomalyType,
  TicketStatus,
  TraceStatus,
} from "../domain";
import { appService, migrationService } from "../services";
import { localDBRepository } from "../repositories";
import type { SyncResult } from "../repositories";
import { formatNow } from "../domain/rules";

type Updater<T> = T | ((prev: T) => T);

function resolveUpdater<T>(updater: Updater<T>, prev: T): T {
  return typeof updater === "function"
    ? (updater as (p: T) => T)(prev)
    : updater;
}

export interface UseAppStoreReturn {
  thresholds: AreaThreshold[];
  inspectionRecords: InspectionRecord[];
  anomalyTickets: AnomalyTicket[];
  anomalyTraces: AnomalyTrace[];
  inspectionPlans: InspectionPlan[];
  filters: FilterConditions;
  syncStatus: SyncStatus;
  syncQueue: SyncQueueItem[];
  syncConflicts: SyncConflict[];
  isLoading: boolean;
  isMigrating: boolean;
  migrationContext: MigrationContext | null;
  wasInitialized: boolean;
  isOnline: boolean;
  setThresholds: (t: Updater<AreaThreshold[]>) => void;
  setInspectionRecords: (r: Updater<InspectionRecord[]>) => void;
  setAnomalyTickets: (t: Updater<AnomalyTicket[]>) => void;
  setAnomalyTraces: (t: Updater<AnomalyTrace[]>) => void;
  setInspectionPlans: (p: Updater<InspectionPlan[]>) => void;
  setFilters: (f: Updater<FilterConditions>) => void;
  addInspectionRecord: (record: InspectionRecord) => void;
  submitInspectionRecord: (
    input: InspectionRecordInput) => Promise<{
      record: InspectionRecord | null; errors: Record<string, string> }>;
  addAnomalyTicket: (ticket: AnomalyTicket) => void;
  createAnomalyTicket: (
    input: Omit<AnomalyTicket, "id" | "createdAt" | "status" | "processNotes">
  ) => Promise<AnomalyTicket>;
  createTicketFromRecord: (
    readings: {
      roomId: string;
      area: CleanArea;
      particle05um: number;
      particle5um: number;
      pressure: number;
      temperature: number;
      humidity: number;
      sourceRecordId?: number;
      sourceRecord?: InspectionRecord;
    },
    anomalyType: TicketAnomalyType
  ) => Promise<{ ticket: AnomalyTicket; trace: AnomalyTrace }>;
  createOrUpdateTraceFromTicket: (
    ticket: AnomalyTicket,
    record?: InspectionRecord
  ) => Promise<AnomalyTrace>;
  updateAnomalyTicketStatus: (id: number, status: TicketStatus, processNote?: string) => void;
  createAnomalyTrace: (
    input: AnomalyTraceInput
  ) => Promise<AnomalyTrace>;
  addAnomalyTrace: (trace: AnomalyTrace) => void;
  updateAnomalyTrace: (trace: AnomalyTrace) => void;
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
  createOrUpdateTraceFromRecord: (
    record: InspectionRecord,
    anomalyType: TicketAnomalyType,
    ticketId?: number
  ) => Promise<AnomalyTrace>;
  addInspectionPlan: (plan: InspectionPlan) => void;
  createInspectionPlan: (input: {
    date: string;
    area: CleanArea;
    role: string;
    inspector: string;
  }) => Promise<InspectionPlan | null>;
  updateInspectionPlanStatus: (planId: number, status: PlanStatus) => void;
  linkRecordToPlan: (planId: number, recordId: number) => void;
  getTodayPlans: () => InspectionPlan[];
  checkAnomalies: (readings: {
    area: CleanArea;
    particle05um: number;
    particle5um: number;
    pressure: number;
    temperature: number;
    humidity: number;
  }) => AnomalyCheckResult;
  getRecordStatus: (anomalies: AnomalyCheckResult) => RecordStatusResult;
  hasTicketForRecord: (
    recordId: number,
    anomalyType: TicketAnomalyType
  ) => boolean;
  getExistingRoomIds: () => string[];
  getTracesForRoom: (roomId: string) => AnomalyTrace[];
  getRecordsForRoom: (roomId: string, limit?: number) => InspectionRecord[];
  getTicketsForTrace: (trace: AnomalyTrace) => AnomalyTicket[];
  getRecordsForTrace: (trace: AnomalyTrace) => InspectionRecord[];
  evaluateTraceCloseCondition: (
    trace: AnomalyTrace
  ) => { condition: import("../domain").CloseCondition; canClose: boolean; warnings: string[] };
  inferRootCauseForTrace: (traceId: number) => {
    cause: RootCauseCategory;
    detail: string;
    confidence: number;
  } | null;
  checkClosedTicketAbnormal: (trace: AnomalyTrace) => boolean;
  ticketAssignees: () => string[];
  planAreas: () => CleanArea[];
  planRoles: () => string[];
  countTicketsByStatus: () => Record<TicketStatus, number>;
  countPlansByStatus: () => Record<PlanStatus, number>;
  countTracesByStatus: () => Record<TraceStatus, number>;
  exportRecordsCsv: (
    areaFilter: CleanArea | "全部") => { success: boolean; message?: string };
  exportTicketsCsv: (
    areaFilter: CleanArea | "全部") => { success: boolean; message?: string };
  exportPlansCsv: (
    areaFilter: CleanArea | "全部") => { success: boolean; message?: string };
  exportAllJson: () => { success: boolean; message?: string };
  exportTeamReviewReport: (params: {
    area: CleanArea | "全部";
    startDate: string;
    endDate: string;
  }) => { success: boolean; message?: string };
  clearLocalData: () => Promise<void>;
  syncPending: () => Promise<SyncResult>;
  processQueue: (
    scope?: "all" | "pending" | "failed",
    itemIds?: number[]
  ) => Promise<SyncResult>;
  retryQueueItem: (itemId: number) => Promise<SyncResult>;
  retryAllFailed: () => Promise<SyncResult>;
  removeQueueItem: (itemId: number) => Promise<void>;
  clearSyncedQueueItems: () => Promise<void>;
  refreshSyncQueue: () => Promise<void>;
  resolveConflict: (conflictId: number, resolution: "keepLocal" | "useRemote") => Promise<{ success: boolean; errorMessage?: string }>;
  refreshSyncConflicts: () => Promise<void>;
  clearResolvedConflicts: () => Promise<void>;
  removeConflict: (conflictId: number) => Promise<void>;
  backupData: () => Promise<BackupData>;
  backupAndDownload: () => Promise<BackupData>;
  restoreBackup: (backup: BackupData) => Promise<boolean>;
  validateBackup: (backup: BackupData) => Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }>;
  resetToSampleData: () => Promise<void>;
  forceResetToSampleData: () => Promise<void>;
  getMigrationSummary: () => Promise<{
    currentVersion: number;
    latestVersion: number;
    needsMigration: boolean;
    lastMigration?: any;
    totalFailedRecords: number;
  }>;
  runMigrations: () => Promise<MigrationContext>;
}

export function useAppStore(): UseAppStoreReturn {
  const [thresholds, setThresholdsState] = useState<AreaThreshold[]>([]);
  const [inspectionRecords, setInspectionRecordsState] = useState<
    InspectionRecord[]
  >([]);
  const [anomalyTickets, setAnomalyTicketsState] = useState<
    AnomalyTicket[]>([]);
  const [anomalyTraces, setAnomalyTracesState] = useState<AnomalyTrace[]>([]);
  const [inspectionPlans, setInspectionPlansState] = useState<
    InspectionPlan[]>([]);
  const [filters, setFiltersState] = useState<FilterConditions>(
      appService.filters.defaults()
    );
  const [syncStatus, setSyncStatusState] = useState<SyncStatus>({
    pendingRecords: 0,
    pendingTickets: 0,
    pendingPlans: 0,
    failedRecords: 0,
    failedTickets: 0,
    failedPlans: 0,
    conflictCount: 0,
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    queueTotal: 0,
    queuePending: 0,
    queueFailed: 0,
    queueConflict: 0,
  });
  const [syncQueue, setSyncQueueState] = useState<SyncQueueItem[]>([]);
  const [syncConflicts, setSyncConflictsState] = useState<SyncConflict[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationContext, setMigrationContext] = useState<MigrationContext | null>(null);
  const [wasInitialized, setWasInitialized] = useState(false);

  const refreshSyncStatus = useCallback(async () => {
    const [ss, queue, conflicts] = await Promise.all([
      appService.getSyncStatus(),
      appService.getSyncQueue(),
      appService.getUnresolvedConflicts(),
    ]);
    setSyncStatusState(ss);
    setSyncQueueState(queue);
    setSyncConflictsState(conflicts);
  }, []);

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        setIsMigrating(true);

        const needsMigration = await migrationService.needsMigration();
        if (needsMigration) {
          console.log("[Migration] 检测到需要数据迁移，开始执行...");
          const migrationResult = await migrationService.runMigrations();
          if (mounted) {
            setMigrationContext(migrationResult);
            if (migrationResult.failedRecords.length > 0) {
              console.warn(
                `[Migration] 有 ${migrationResult.failedRecords.length} 条记录迁移失败`
              );
            }
          }
        }

        const data = await localDBRepository.loadAll();
        if (!mounted) return;

        setThresholdsState(data.thresholds);
        setInspectionRecordsState(data.inspectionRecords);
        setAnomalyTicketsState(data.anomalyTickets);
        setAnomalyTracesState((data as any).anomalyTraces || []);
        setInspectionPlansState(data.inspectionPlans);
        setFiltersState(data.filters);
        setSyncQueueState((data as any).syncQueue || []);
        setSyncConflictsState((data as any).syncConflicts || []);
        setWasInitialized(data.wasEmpty);

        const migratedCount = await appService.migrateUnsyncedToQueue();
        if (migratedCount > 0) {
          console.log(`[Sync] 迁移了 ${migratedCount} 条未同步数据到同步队列`);
        }

        const ss = await appService.getSyncStatus();
        const queue = await appService.getSyncQueue();
        const conflicts = await appService.getUnresolvedConflicts();
        setSyncStatusState(ss);
        setSyncQueueState(queue);
        setSyncConflictsState(conflicts);
        setIsLoading(false);
        setIsMigrating(false);
      } catch (err) {
        console.error("Failed to initialize:", err);
        setIsLoading(false);
        setIsMigrating(false);
      }
    };

    initialize();

    const unsubscribeOnline = appService.sync.onOnlineChange((online) => {
      if (!mounted) return;
      setSyncStatusState((prev) => ({ ...prev, isOnline: online }));
    });

    const unsubscribeQueue = appService.onQueueChange(async () => {
      if (!mounted) return;
      await refreshSyncStatus();
    });

    const unsubscribeConflict = appService.onConflictChange(async () => {
      if (!mounted) return;
      await refreshSyncStatus();
    });

    const unsubscribeData = appService.sync.onDataChange(
      async (entityType: SyncEntityType) => {
        if (!mounted) return;
        switch (entityType) {
          case "inspectionRecord":
            setInspectionRecordsState(await localDBRepository.getInspectionRecords());
            break;
          case "anomalyTicket":
            setAnomalyTicketsState(await localDBRepository.getAnomalyTickets());
            break;
          case "inspectionPlan":
            setInspectionPlansState(await localDBRepository.getInspectionPlans());
            break;
          case "anomalyTrace":
            setAnomalyTracesState(await localDBRepository.getAnomalyTraces());
            break;
          case "threshold":
            setThresholdsState(await localDBRepository.getThresholds());
            break;
        }
      }
    );

    return () => {
      mounted = false;
      unsubscribeOnline();
      unsubscribeQueue();
      unsubscribeConflict();
      unsubscribeData();
    };
  }, [refreshSyncStatus]);

  const refreshSyncQueue = useCallback(async () => {
    await refreshSyncStatus();
  }, [refreshSyncStatus]);

  const refreshSyncConflicts = useCallback(async () => {
    await refreshSyncStatus();
  }, [refreshSyncStatus]);

  const setThresholds = useCallback((t: Updater<AreaThreshold[]>) => {
    setThresholdsState((prev) => {
      const next = resolveUpdater(t, prev);

      (async () => {
        try {
          await appService.sync.updateThresholds(next);
        } catch (err) {
          console.error("Failed to process thresholds update:", err);
          localDBRepository.saveThresholds(next).catch((e) =>
            console.error("Failed to save thresholds:", e)
          );
        }
      })();

      return next;
    });
  }, []);

  const setInspectionRecords = useCallback(
    (r: Updater<InspectionRecord[]>) => {
      setInspectionRecordsState((prev) => {
        const next = resolveUpdater(r, prev);
        appService.sync.saveAllRecords(next).catch((err) =>
          console.error("Failed to save inspection records:", err)
        );
        return next;
      });
    },
    []
  );

  const setAnomalyTickets = useCallback((t: Updater<AnomalyTicket[]>) => {
    setAnomalyTicketsState((prev) => {
      const next = resolveUpdater(t, prev);
      appService.sync.saveAllTickets(next).catch((err) =>
        console.error("Failed to save anomaly tickets:", err)
      );
      return next;
    });
  }, []);

  const setAnomalyTraces = useCallback((t: Updater<AnomalyTrace[]>) => {
    setAnomalyTracesState((prev) => {
      const next = resolveUpdater(t, prev);
      appService.sync.saveAllTraces(next).catch((err) =>
        console.error("Failed to save anomaly traces:", err)
      );
      return next;
    });
  }, []);

  const setInspectionPlans = useCallback((p: Updater<InspectionPlan[]>) => {
    setInspectionPlansState((prev) => {
      const next = resolveUpdater(p, prev);
      appService.sync.saveAllPlans(next).catch((err) =>
      console.error("Failed to save inspection plans:", err)
    );
      return next;
    });
  }, []);

  const setFilters = useCallback((f: Updater<FilterConditions>) => {
    setFiltersState((prev) => {
      const next = resolveUpdater(f, prev);
      localDBRepository.saveFilters(next).catch((err) =>
        console.error("Failed to save filters:", err)
      );
      return next;
    });
  }, []);

  const addInspectionRecord = useCallback(
    (record: InspectionRecord) => {
      setInspectionRecords((prev) => [record, ...prev]);
      appService.sync.addRecord(record).catch((e) =>
        console.error("添加巡检记录失败:", e)
      );
    },
    [setInspectionRecords]
  );

  const submitInspectionRecord = useCallback(
    async (input: InspectionRecordInput) => {
      const roomIds = inspectionRecords.map((r) => r.roomId);
      const result = await appService.inspection.create(
        input,
        thresholds,
        roomIds
      );
      if (result && result.record) {
        addInspectionRecord(result.record);
      }
      return (result || { record: null, errors: {} }) as {
        record: InspectionRecord | null; errors: Record<string, string> };
    },
    [thresholds, inspectionRecords, addInspectionRecord]
  );

  const addAnomalyTicket = useCallback(
    (ticket: AnomalyTicket) => {
      setAnomalyTickets((prev) => [...prev, ticket]);
      appService.sync.addTicket(ticket).catch((e) =>
        console.error("添加异常工单失败:", e)
      );
    },
    [setAnomalyTickets]
  );

  const addAnomalyTrace = useCallback(
    (trace: AnomalyTrace) => {
      setAnomalyTraces((prev) => [trace, ...prev]);
      appService.sync.addTrace(trace).catch((e) =>
        console.error("添加异常追踪失败:", e)
      );
    },
    [setAnomalyTraces]
  );

  const updateAnomalyTrace = useCallback(
    (trace: AnomalyTrace) => {
      setAnomalyTraces((prev) =>
        prev.map((t) => (t.id === trace.id ? trace : t))
      );
      appService.sync.updateTrace(trace).catch((e) =>
        console.error("更新异常追踪失败:", e)
      );
    },
    [setAnomalyTraces]
  );

  const createAnomalyTrace = useCallback(
    async (input: AnomalyTraceInput) => {
      const trace = appService.traces.create(input, anomalyTraces);
      addAnomalyTrace(trace);
      return trace;
    },
    [anomalyTraces, addAnomalyTrace]
  );

  const setTraceRootCause = useCallback(
    (
      traceId: number,
      rootCause: RootCauseCategory,
      detail: string,
      confidence: number
    ) => {
      setAnomalyTraces((prev) => {
        const next = prev.map((t) => {
          if (t.id !== traceId) return t;
          const updated = appService.traces.updateRootCause(t, rootCause, detail, confidence);
          appService.sync.updateTrace(updated).catch((e) =>
            console.error("更新异常追踪根因失败:", e)
          );
          return updated;
        });
        return next;
      });
    },
    [setAnomalyTraces]
  );

  const addTraceProcessingStep = useCallback(
    (
      traceId: number,
      action: ProcessingActionType,
      description: string,
      operator: string,
      beforeStatus?: string,
      afterStatus?: string
    ) => {
      setAnomalyTraces((prev) => {
        const next = prev.map((t) => {
          if (t.id !== traceId) return t;
          const updated = appService.traces.addProcessingStep(
            t,
            action,
            description,
            operator,
            beforeStatus,
            afterStatus
          );
          appService.sync.updateTrace(updated).catch((e) =>
            console.error("更新异常追踪步骤失败:", e)
          );
          return updated;
        });
        return next;
      });
    },
    [setAnomalyTraces]
  );

  const updateTraceStatus = useCallback(
    (traceId: number, status: TraceStatus) => {
      setAnomalyTraces((prev) => {
        const next = prev.map((t) => {
          if (t.id !== traceId) return t;
          const updated = { ...t, status };
          appService.sync.updateTrace(updated).catch((e) =>
            console.error("更新异常追踪状态失败:", e)
          );
          return updated;
        });
        return next;
      });
    },
    [setAnomalyTraces]
  );

  const markTraceRecovery = useCallback(
    (traceId: number, operator: string) => {
      setAnomalyTraces((prev) => {
        const next = prev.map((t) => {
          if (t.id !== traceId) return t;
          const updated = appService.traces.markRecovery(t, operator);
          appService.sync.updateTrace(updated).catch((e) =>
            console.error("标记异常追踪恢复失败:", e)
          );
          return updated;
        });
        return next;
      });
    },
    [setAnomalyTraces]
  );

  const createOrUpdateTraceFromRecord = useCallback(
    async (
      record: InspectionRecord,
      anomalyType: TicketAnomalyType,
      ticketId?: number
    ): Promise<AnomalyTrace> => {
      const existing = appService.traces.findTraceForRoomIncludingRecovered(
        anomalyTraces,
        record.roomId,
        anomalyType
      );

      if (existing) {
        let updated = appService.traces.updateOnNewRecord(
          existing,
          record,
          thresholds
        );
        if (ticketId && !updated.linkedTicketIds.includes(ticketId)) {
          const ticket = anomalyTickets.find(t => t.id === ticketId);
          if (ticket) {
            updated = appService.traces.updateOnTicketChange(updated, ticket, false);
          } else {
            updated.linkedTicketIds = [...updated.linkedTicketIds, ticketId];
          }
        }
        updateAnomalyTrace(updated);
        return updated;
      } else {
        const traceInput: AnomalyTraceInput = {
          roomId: record.roomId,
          area: record.area,
          anomalyType,
          initialRecordId: record.id,
          triggerTicketId: ticketId,
        };
        const newTrace = await createAnomalyTrace(traceInput);
        return newTrace;
      }
    },
    [anomalyTraces, anomalyTickets, thresholds, updateAnomalyTrace, createAnomalyTrace]
  );

  const createOrUpdateTraceFromTicket = useCallback(
    async (
      ticket: AnomalyTicket,
      record?: InspectionRecord
    ): Promise<AnomalyTrace> => {
      const existing = appService.traces.findTraceForRoomIncludingRecovered(
        anomalyTraces,
        ticket.roomId,
        ticket.anomalyType
      );

      if (existing) {
        let updated = appService.traces.updateOnTicketChange(
          existing,
          ticket,
          true
        );
        if (record && !updated.linkedRecordIds.includes(record.id)) {
          updated = appService.traces.updateOnNewRecord(updated, record, thresholds);
        }
        updateAnomalyTrace(updated);
        return updated;
      } else {
        const traceInput: AnomalyTraceInput = {
          roomId: ticket.roomId,
          area: ticket.area,
          anomalyType: ticket.anomalyType,
          initialRecordId: record?.id,
          triggerTicketId: ticket.id,
        };
        const newTrace = await createAnomalyTrace(traceInput);
        return newTrace;
      }
    },
    [anomalyTraces, thresholds, updateAnomalyTrace, createAnomalyTrace]
  );

  const createAnomalyTicket = useCallback(
    async (
      input: Omit<AnomalyTicket, "id" | "createdAt" | "status" | "processNotes">) => {
      const ticket = await appService.tickets.create(input);
      addAnomalyTicket(ticket);
      await createOrUpdateTraceFromTicket(ticket);
      return ticket;
    },
    [addAnomalyTicket, createOrUpdateTraceFromTicket]
  );

  const createTicketFromRecord = useCallback(
    async (
      readings: {
        roomId: string;
        area: CleanArea;
        particle05um: number;
        particle5um: number;
        pressure: number;
        temperature: number;
        humidity: number;
        sourceRecordId?: number;
        sourceRecord?: InspectionRecord;
      },
      anomalyType: TicketAnomalyType
    ) => {
      const ticket = await appService.tickets.createFromReadings(
        readings,
        anomalyType,
        thresholds
      );
      addAnomalyTicket(ticket);

      const sourceRecord = readings.sourceRecord ?? (readings.sourceRecordId
        ? inspectionRecords.find(r => r.id === readings.sourceRecordId)
        : undefined);
      const trace = await createOrUpdateTraceFromTicket(ticket, sourceRecord);

      return { ticket, trace };
    },
    [thresholds, addAnomalyTicket, inspectionRecords, createOrUpdateTraceFromTicket]
  );

  const updateAnomalyTicketStatus = useCallback(
    (id: number, status: TicketStatus, processNote?: string) => {
      const ticket = anomalyTickets.find(t => t.id === id);
      if (ticket) {
        const updatedTicket = {
          ...ticket,
          status,
          processNotes: processNote
            ? [...(ticket.processNotes || []), {
                note: processNote,
                timestamp: formatNow(),
                fromStatus: ticket.status,
                toStatus: status,
              }]
            : ticket.processNotes,
        };
        setAnomalyTickets((prev) =>
          prev.map((t) => (t.id === id ? updatedTicket : t))
        );
        appService.sync.updateTicket(updatedTicket).catch((e) =>
          console.error("更新异常工单状态失败:", e)
        );

        const relatedTrace = appService.traces.findTraceForRoomIncludingRecovered(
          anomalyTraces,
          ticket.roomId,
          ticket.anomalyType
        );
        if (relatedTrace) {
          const updatedTrace = appService.traces.updateOnTicketChange(
            relatedTrace,
            updatedTicket,
            false
          );
          updateAnomalyTrace(updatedTrace);
        }
      }
    },
    [anomalyTickets, anomalyTraces, setAnomalyTickets, updateAnomalyTrace]
  );

  const addInspectionPlan = useCallback(
    (plan: InspectionPlan) => {
      setInspectionPlans((prev) => [plan, ...prev]);
      appService.sync.addPlan(plan).catch((e) =>
        console.error("添加巡检计划失败:", e)
      );
    },
    [setInspectionPlans]
  );

  const createInspectionPlan = useCallback(
    async (input: {
      date: string;
      area: CleanArea;
      role: string;
      inspector: string;
    }) => {
      if (!input.inspector.trim()) {
        return null;
      }
      const plan = await appService.plans.create(input);
      addInspectionPlan(plan);
      return plan;
    },
    [addInspectionPlan]
  );

  const updateInspectionPlanStatus = useCallback(
    (planId: number, status: PlanStatus) => {
      const plan = inspectionPlans.find((p) => p.id === planId);
      setInspectionPlans((prev) =>
        prev.map((p) => (p.id === planId ? { ...p, status } : p))
      );
      if (plan) {
        const updated = { ...plan, status };
        appService.sync.updatePlan(updated).catch((e) =>
          console.error("更新巡检计划状态失败:", e)
        );
      }
    },
    [setInspectionPlans, inspectionPlans]
  );

  const linkRecordToPlan = useCallback(
    (planId: number, recordId: number) => {
      const plan = inspectionPlans.find((p) => p.id === planId);
      if (!plan) return;
      const linkedRecordIds = plan.linkedRecordIds ?? [];
      if (linkedRecordIds.includes(recordId)) return;

      const updated = {
        ...plan,
        linkedRecordIds: [...linkedRecordIds, recordId],
      };

      setInspectionPlans((prev) =>
        prev.map((p) => (p.id === planId ? updated : p))
      );

      appService.sync.updatePlan(updated).catch((e) =>
        console.error("关联记录到计划失败:", e)
      );
    },
    [setInspectionPlans, inspectionPlans]
  );

  const getTodayPlans = useCallback(() => {
    const today = appService.plans.todayStr();
    return inspectionPlans.filter((p) => p.date === today);
  }, [inspectionPlans]);

  const checkAnomalies = useCallback(
    (readings: {
      area: CleanArea;
      particle05um: number;
      particle5um: number;
      pressure: number;
      temperature: number;
      humidity: number;
    }) => {
      return appService.inspection.checkAnomalies(readings, thresholds);
    },
    [thresholds]
  );

  const getRecordStatus = useCallback(
    (anomalies: AnomalyCheckResult) => {
      return appService.inspection.getStatus(anomalies);
    },
    []
  );

  const hasTicketForRecord = useCallback(
    (recordId: number, anomalyType: TicketAnomalyType) => {
      return appService.tickets.hasTicketForRecord(
        anomalyTickets,
        recordId,
        anomalyType
      );
    },
    [anomalyTickets]
  );

  const getExistingRoomIds = useCallback(() => {
    return inspectionRecords.map((r) => r.roomId);
  }, [inspectionRecords]);

  const getTracesForRoom = useCallback(
    (roomId: string) => {
      return appService.traces.findAllTracesForRoom(anomalyTraces, roomId);
    },
    [anomalyTraces]
  );

  const getRecordsForRoom = useCallback(
    (roomId: string, limit: number = 10) => {
      return appService.traces.getRecentRecordsForRoom(inspectionRecords, roomId, limit);
    },
    [inspectionRecords]
  );

  const getTicketsForTrace = useCallback(
    (trace: AnomalyTrace) => {
      return appService.traces.getRelatedTicketsForTrace(anomalyTickets, trace);
    },
    [anomalyTickets]
  );

  const getRecordsForTrace = useCallback(
    (trace: AnomalyTrace) => {
      return appService.traces.getRelatedRecordsForTrace(inspectionRecords, trace);
    },
    [inspectionRecords]
  );

  const evaluateTraceCloseCondition = useCallback(
    (trace: AnomalyTrace) => {
      const roomRecords = appService.traces.getRecentRecordsForRoom(
        inspectionRecords,
        trace.roomId,
        20
      );
      const relatedTickets = appService.traces.getRelatedTicketsForTrace(
        anomalyTickets,
        trace
      );
      return appService.traces.evaluateCloseCondition(
        trace,
        roomRecords,
        relatedTickets,
        thresholds
      );
    },
    [inspectionRecords, anomalyTickets, thresholds]
  );

  const inferRootCauseForTrace = useCallback(
    (traceId: number) => {
      const trace = anomalyTraces.find((t) => t.id === traceId);
      if (!trace) return null;
      const recentRecords = appService.traces.getRecentRecordsForRoom(
        inspectionRecords,
        trace.roomId,
        10
      );
      const relatedTickets = appService.traces.getRelatedTicketsForTrace(
        anomalyTickets,
        trace
      );
      return appService.traces.inferRootCause(trace, recentRecords, relatedTickets);
    },
    [anomalyTraces, inspectionRecords, anomalyTickets]
  );

  const checkClosedTicketAbnormal = useCallback(
    (trace: AnomalyTrace) => {
      return appService.traces.checkTicketClosedButDataAbnormal(
        trace,
        anomalyTickets,
        inspectionRecords,
        thresholds
      );
    },
    [anomalyTickets, inspectionRecords, thresholds]
  );

  const ticketAssignees = useCallback(() => {
    return appService.tickets.getAssignees();
  }, []);

  const planAreas = useCallback(() => {
    return appService.plans.getAreas();
  }, []);

  const planRoles = useCallback(() => {
    return appService.plans.getRoles();
  }, []);

  const countTicketsByStatus = useCallback(() => {
    return appService.tickets.countByStatus(anomalyTickets);
  }, [anomalyTickets]);

  const countPlansByStatus = useCallback(() => {
    return appService.plans.countByStatus(inspectionPlans);
  }, [inspectionPlans]);

  const countTracesByStatus = useCallback(() => {
    const counts: Record<string, number> = {};
    anomalyTraces.forEach((t) => {
      counts[t.status] = (counts[t.status] || 0) + 1;
    });
    return counts as Record<TraceStatus, number>;
  }, [anomalyTraces]);

  const exportRecordsCsv = useCallback(
    (areaFilter: CleanArea | "全部") => {
      const records =
        areaFilter === "全部"
          ? inspectionRecords
          : inspectionRecords.filter((r) => r.area === areaFilter);
      return appService.export.exportRecordsCsv(records, areaFilter);
    },
    [inspectionRecords]
  );

  const exportTicketsCsv = useCallback(
    (areaFilter: CleanArea | "全部") => {
      const tickets =
        areaFilter === "全部"
          ? anomalyTickets
          : anomalyTickets.filter((t) => t.area === areaFilter);
      return appService.export.exportTicketsCsv(tickets, areaFilter);
    },
    [anomalyTickets]
  );

  const exportPlansCsv = useCallback(
    (areaFilter: CleanArea | "全部") => {
      const plans =
        areaFilter === "全部"
          ? inspectionPlans
          : inspectionPlans.filter((p) => p.area === areaFilter);
      return appService.export.exportPlansCsv(plans, areaFilter);
    },
    [inspectionPlans]
  );

  const exportAllJson = useCallback(() => {
    return appService.export.exportAllJson(
      inspectionRecords,
      anomalyTickets,
      inspectionPlans
    );
  }, [inspectionRecords, anomalyTickets, inspectionPlans]);

  const exportTeamReviewReport = useCallback(
    (params: { area: CleanArea | "全部"; startDate: string; endDate: string }) => {
      return appService.export.exportTeamReviewReport(
        inspectionRecords,
        anomalyTickets,
        anomalyTraces,
        thresholds,
        params
      );
    },
    [inspectionRecords, anomalyTickets, anomalyTraces, thresholds]
  );

  const backupData = useCallback(async (): Promise<BackupData> => {
    return await migrationService.backupAllData();
  }, []);

  const backupAndDownload = useCallback(async (): Promise<BackupData> => {
    return await migrationService.backupAndDownload();
  }, []);

  const restoreBackup = useCallback(async (backup: BackupData): Promise<boolean> => {
    const success = await migrationService.restoreBackup(backup);
    if (success) {
      const data = await localDBRepository.loadAll();
      setThresholdsState(data.thresholds);
      setInspectionRecordsState(data.inspectionRecords);
      setAnomalyTicketsState(data.anomalyTickets);
      setAnomalyTracesState((data as any).anomalyTraces || []);
      setInspectionPlansState(data.inspectionPlans);
      setFiltersState(data.filters);
      setSyncQueueState((data as any).syncQueue || []);
      setSyncConflictsState((data as any).syncConflicts || []);
      await refreshSyncStatus();
    }
    return success;
  }, [refreshSyncStatus]);

  const validateBackup = useCallback(
    async (backup: BackupData) => {
      return await migrationService.validateBackup(backup);
    },
    []
  );

  const resetToSampleData = useCallback(async () => {
    const isEmpty = await localDBRepository.isEmpty();
    if (!isEmpty) {
      await migrationService.backupAndDownload();
    }
    await migrationService.resetToSampleData();
    const data = await localDBRepository.loadAll();
    setThresholdsState(data.thresholds);
    setInspectionRecordsState(data.inspectionRecords);
    setAnomalyTicketsState(data.anomalyTickets);
    setAnomalyTracesState((data as any).anomalyTraces || []);
    setInspectionPlansState(data.inspectionPlans);
    setFiltersState(data.filters);
    setSyncQueueState((data as any).syncQueue || []);
    setSyncConflictsState((data as any).syncConflicts || []);
    await refreshSyncStatus();
  }, [refreshSyncStatus]);

  const forceResetToSampleData = useCallback(async () => {
    await migrationService.resetToSampleData();
    const data = await localDBRepository.loadAll();
    setThresholdsState(data.thresholds);
    setInspectionRecordsState(data.inspectionRecords);
    setAnomalyTicketsState(data.anomalyTickets);
    setAnomalyTracesState((data as any).anomalyTraces || []);
    setInspectionPlansState(data.inspectionPlans);
    setFiltersState(data.filters);
    setSyncQueueState((data as any).syncQueue || []);
    setSyncConflictsState((data as any).syncConflicts || []);
    await refreshSyncStatus();
  }, [refreshSyncStatus]);

  const getMigrationSummary = useCallback(async () => {
    return await migrationService.getMigrationSummary();
  }, []);

  const runMigrations = useCallback(async (): Promise<MigrationContext> => {
    setIsMigrating(true);
    try {
      const result = await migrationService.runMigrations();
      setMigrationContext(result);

      const data = await localDBRepository.loadAll();
      setThresholdsState(data.thresholds);
      setInspectionRecordsState(data.inspectionRecords);
      setAnomalyTicketsState(data.anomalyTickets);
      setAnomalyTracesState((data as any).anomalyTraces || []);
      setInspectionPlansState(data.inspectionPlans);
      setFiltersState(data.filters);
      setSyncQueueState((data as any).syncQueue || []);
      setSyncConflictsState((data as any).syncConflicts || []);
      await refreshSyncStatus();

      return result;
    } finally {
      setIsMigrating(false);
    }
  }, [refreshSyncStatus]);

  const clearLocalData = useCallback(async () => {
    await localDBRepository.clearAll();
    await localDBRepository.seedDefaults();
    const data = await localDBRepository.loadAll();
    setThresholdsState(data.thresholds);
    setInspectionRecordsState(data.inspectionRecords);
    setAnomalyTicketsState(data.anomalyTickets);
    setAnomalyTracesState((data as any).anomalyTraces || []);
    setInspectionPlansState(data.inspectionPlans);
    setFiltersState(data.filters);
    setSyncQueueState((data as any).syncQueue || []);
    setSyncConflictsState((data as any).syncConflicts || []);
    setWasInitialized(true);
    await refreshSyncStatus();
  }, [refreshSyncStatus]);

  const syncPending = useCallback(async () => {
    return appService.pushPending();
  }, []);

  const processQueue = useCallback(async (
    scope: "all" | "pending" | "failed" = "all",
    itemIds?: number[]
  ) => {
    return appService.processQueue(scope, itemIds);
  }, []);

  const retryQueueItem = useCallback(async (itemId: number) => {
    return appService.retryQueueItem(itemId);
  }, []);

  const retryAllFailed = useCallback(async () => {
    return appService.retryAllFailed();
  }, []);

  const removeQueueItem = useCallback(async (itemId: number) => {
    await appService.removeQueueItem(itemId);
  }, []);

  const clearSyncedQueueItems = useCallback(async () => {
    await appService.clearSyncedQueueItems();
  }, []);

  const resolveConflict = useCallback(async (
    conflictId: number,
    resolution: "keepLocal" | "useRemote"
  ): Promise<{ success: boolean; errorMessage?: string }> => {
    return appService.resolveConflict(conflictId, resolution);
  }, []);

  const clearResolvedConflicts = useCallback(async (): Promise<void> => {
    await appService.clearResolvedConflicts();
  }, []);

  const removeConflict = useCallback(async (conflictId: number): Promise<void> => {
    await appService.removeConflict(conflictId);
  }, []);

  return {
    thresholds,
    inspectionRecords,
    anomalyTickets,
    anomalyTraces,
    inspectionPlans,
    filters,
    syncStatus,
    syncQueue,
    syncConflicts,
    isLoading,
    isMigrating,
    migrationContext,
    wasInitialized,
    isOnline: syncStatus.isOnline,
    setThresholds,
    setInspectionRecords,
    setAnomalyTickets,
    setAnomalyTraces,
    setInspectionPlans,
    setFilters,
    addInspectionRecord,
    submitInspectionRecord,
    addAnomalyTicket,
    createAnomalyTicket,
    createTicketFromRecord,
    updateAnomalyTicketStatus,
    createAnomalyTrace,
    addAnomalyTrace,
    updateAnomalyTrace,
    setTraceRootCause,
    addTraceProcessingStep,
    updateTraceStatus,
    markTraceRecovery,
    createOrUpdateTraceFromRecord,
    createOrUpdateTraceFromTicket,
    addInspectionPlan,
    createInspectionPlan,
    updateInspectionPlanStatus,
    linkRecordToPlan,
    getTodayPlans,
    checkAnomalies,
    getRecordStatus,
    hasTicketForRecord,
    getExistingRoomIds,
    getTracesForRoom,
    getRecordsForRoom,
    getTicketsForTrace,
    getRecordsForTrace,
    evaluateTraceCloseCondition,
    inferRootCauseForTrace,
    checkClosedTicketAbnormal,
    ticketAssignees,
    planAreas,
    planRoles,
    countTicketsByStatus,
    countPlansByStatus,
    countTracesByStatus,
    exportRecordsCsv,
    exportTicketsCsv,
    exportPlansCsv,
    exportAllJson,
    exportTeamReviewReport,
    resetToSampleData,
    forceResetToSampleData,
    clearLocalData,
    syncPending,
    processQueue,
    retryQueueItem,
    retryAllFailed,
    removeQueueItem,
    clearSyncedQueueItems,
    refreshSyncQueue,
    resolveConflict,
    refreshSyncConflicts,
    clearResolvedConflicts,
    removeConflict,
    backupData,
    backupAndDownload,
    restoreBackup,
    validateBackup,
    getMigrationSummary,
    runMigrations,
  };
}
