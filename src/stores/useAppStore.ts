import { useCallback, useEffect, useState } from "react";
import type {
  AnomalyCheckResult,
  AnomalyTicket,
  AnomalyTicketInput,
  AnomalyTrace,
  AnomalyTraceInput,
  AreaThreshold,
  CleanArea,
  FilterConditions,
  InspectionPlan,
  InspectionRecord,
  InspectionRecordInput,
  PlanStatus,
  ProcessingActionType,
  RecordStatusResult,
  RootCauseCategory,
  SyncStatus,
  TicketAnomalyType,
  TicketStatus,
  TraceStatus,
} from "../domain";
import { appService } from "../services";
import { localDBRepository } from "../repositories";
import type { SyncResult } from "../repositories";

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
  isLoading: boolean;
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
    input: Omit<AnomalyTicket, "id" | "createdAt" | "status">
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
    },
    anomalyType: TicketAnomalyType
  ) => Promise<AnomalyTicket>;
  updateAnomalyTicketStatus: (id: number, status: TicketStatus) => void;
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
  resetToSampleData: () => Promise<void>;
  clearLocalData: () => Promise<void>;
  syncPending: () => Promise<SyncResult>;
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
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [wasInitialized, setWasInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;

    localDBRepository
      .loadAll()
      .then(async (data: any) => {
        if (!mounted) return;
        setThresholdsState(data.thresholds);
        setInspectionRecordsState(data.inspectionRecords);
        setAnomalyTicketsState(data.anomalyTickets);
        setAnomalyTracesState(data.anomalyTraces || []);
        setInspectionPlansState(data.inspectionPlans);
        setFiltersState(data.filters);
        setWasInitialized(data.wasEmpty);
        const ss = await appService.getSyncStatus();
        setSyncStatusState(ss);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load data:", err);
        setIsLoading(false);
      });

    const unsubscribe = appService.sync.onOnlineChange((online) => {
      if (!mounted) return;
      setSyncStatusState((prev) => ({ ...prev, isOnline: online }));
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const setThresholds = useCallback((t: Updater<AreaThreshold[]>) => {
    setThresholdsState((prev) => {
      const next = resolveUpdater(t, prev);
      localDBRepository.saveThresholds(next).catch((err) =>
        console.error("Failed to save thresholds:", err)
      );
      return next;
    });
  }, []);

  const setInspectionRecords = useCallback(
    (r: Updater<InspectionRecord[]>) => {
      setInspectionRecordsState((prev) => {
        const next = resolveUpdater(r, prev);
        localDBRepository.saveAllInspectionRecords(next).catch((err) =>
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
      localDBRepository.saveAllAnomalyTickets(next).catch((err) =>
        console.error("Failed to save anomaly tickets:", err)
      );
      return next;
    });
  }, []);

  const setAnomalyTraces = useCallback((t: Updater<AnomalyTrace[]>) => {
    setAnomalyTracesState((prev) => {
      const next = resolveUpdater(t, prev);
      localDBRepository.saveAllAnomalyTraces(next).catch((err) =>
        console.error("Failed to save anomaly traces:", err)
      );
      return next;
    });
  }, []);

  const setInspectionPlans = useCallback((p: Updater<InspectionPlan[]>) => {
    setInspectionPlansState((prev) => {
      const next = resolveUpdater(p, prev);
      localDBRepository.saveAllInspectionPlans(next).catch((err) =>
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
    },
    [setAnomalyTickets]
  );

  const createAnomalyTicket = useCallback(
    async (
      input: Omit<AnomalyTicket, "id" | "createdAt" | "status">) => {
      const ticket = await appService.tickets.create(input);
      addAnomalyTicket(ticket);
      return ticket;
    },
    [addAnomalyTicket]
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
      },
      anomalyType: TicketAnomalyType
    ) => {
      const ticket = await appService.tickets.createFromReadings(
        readings,
        anomalyType,
        thresholds
      );
      addAnomalyTicket(ticket);
      return ticket;
    },
    [thresholds, addAnomalyTicket]
  );

  const updateAnomalyTicketStatus = useCallback(
    (id: number, status: TicketStatus) => {
      setAnomalyTickets((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status, synced: false } : t))
      );
      localDBRepository.updateTicketStatus(id, status).catch((err) =>
        console.error("Failed to update ticket status:", err)
      );
    },
    [setAnomalyTickets]
  );

  const addAnomalyTrace = useCallback(
    (trace: AnomalyTrace) => {
      setAnomalyTraces((prev) => [trace, ...prev]);
    },
    [setAnomalyTraces]
  );

  const updateAnomalyTrace = useCallback(
    (trace: AnomalyTrace) => {
      setAnomalyTraces((prev) =>
        prev.map((t) => (t.id === trace.id ? { ...trace, synced: false } : t))
      );
      localDBRepository.saveAnomalyTrace({ ...trace, synced: false }).catch(
        (err) => console.error("Failed to update anomaly trace:", err)
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
      setAnomalyTraces((prev) =>
        prev.map((t) => {
          if (t.id !== traceId) return t;
          return {
            ...appService.traces.updateRootCause(t, rootCause, detail, confidence),
            synced: false,
          };
        })
      );
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
      setAnomalyTraces((prev) =>
        prev.map((t) => {
          if (t.id !== traceId) return t;
          return {
            ...appService.traces.addProcessingStep(t, action, description, operator, beforeStatus, afterStatus),
            synced: false,
          };
        })
      );
    },
    [setAnomalyTraces]
  );

  const updateTraceStatus = useCallback(
    (traceId: number, status: TraceStatus) => {
      setAnomalyTraces((prev) =>
        prev.map((t) => (t.id === traceId ? { ...t, status, synced: false } : t))
      );
    },
    [setAnomalyTraces]
  );

  const markTraceRecovery = useCallback(
    (traceId: number, operator: string) => {
      setAnomalyTraces((prev) =>
        prev.map((t) => {
          if (t.id !== traceId) return t;
          return {
            ...appService.traces.markRecovery(t, operator),
            synced: false,
          };
        })
      );
    },
    [setAnomalyTraces]
  );

  const createOrUpdateTraceFromRecord = useCallback(
    async (
      record: InspectionRecord,
      anomalyType: TicketAnomalyType,
      ticketId?: number
    ): Promise<AnomalyTrace> => {
      const existing = appService.traces.findTraceForRoom(
        anomalyTraces,
        record.roomId,
        anomalyType
      );

      if (existing) {
        const updated = appService.traces.updateOnNewRecord(
          existing,
          record,
          thresholds
        );
        if (ticketId && !updated.linkedTicketIds.includes(ticketId)) {
          updated.linkedTicketIds = [...updated.linkedTicketIds, ticketId];
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
    [anomalyTraces, thresholds, updateAnomalyTrace, createAnomalyTrace]
  );

  const addInspectionPlan = useCallback(
    (plan: InspectionPlan) => {
      setInspectionPlans((prev) => [plan, ...prev]);
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
      setInspectionPlans((prev) =>
        prev.map((p) => (p.id === planId ? { ...p, status, synced: false } : p))
      );
      localDBRepository.updatePlanStatus(planId, status).catch((err) =>
        console.error("Failed to update plan status:", err)
      );
    },
    [setInspectionPlans]
  );

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

  const resetToSampleData = useCallback(async () => {
    await localDBRepository.clearAll();
    await localDBRepository.seedDefaults();
    const data = await localDBRepository.loadAll();
    setThresholdsState(data.thresholds);
    setInspectionRecordsState(data.inspectionRecords);
    setAnomalyTicketsState(data.anomalyTickets);
    setAnomalyTracesState((data as any).anomalyTraces || []);
    setInspectionPlansState(data.inspectionPlans);
    setFiltersState(data.filters);
  }, []);

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
    setWasInitialized(true);
  }, []);

  const syncPending = useCallback(async () => {
    const result = await appService.pushPending();
    const ss = await appService.getSyncStatus();
    setSyncStatusState(ss);
    return result;
  }, []);

  return {
    thresholds,
    inspectionRecords,
    anomalyTickets,
    anomalyTraces,
    inspectionPlans,
    filters,
    syncStatus,
    isLoading,
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
    addInspectionPlan,
    createInspectionPlan,
    updateInspectionPlanStatus,
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
    resetToSampleData,
    clearLocalData,
    syncPending,
  };
}
