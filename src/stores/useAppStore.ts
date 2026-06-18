import { useCallback, useEffect, useState } from "react";
import type {
  AnomalyCheckResult,
  AnomalyTicket,
  AnomalyTicketInput,
  AreaThreshold,
  CleanArea,
  FilterConditions,
  InspectionPlan,
  InspectionRecord,
  InspectionRecordInput,
  PlanStatus,
  RecordStatusResult,
  SyncStatus,
  TicketAnomalyType,
  TicketStatus,
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
  inspectionPlans: InspectionPlan[];
  filters: FilterConditions;
  syncStatus: SyncStatus;
  isLoading: boolean;
  wasInitialized: boolean;
  isOnline: boolean;
  setThresholds: (t: Updater<AreaThreshold[]>) => void;
  setInspectionRecords: (r: Updater<InspectionRecord[]>) => void;
  setAnomalyTickets: (t: Updater<AnomalyTicket[]>) => void;
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
  ticketAssignees: () => string[];
  planAreas: () => CleanArea[];
  planRoles: () => string[];
  countTicketsByStatus: () => Record<TicketStatus, number>;
  countPlansByStatus: () => Record<PlanStatus, number>;
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
      .then(async (data) => {
        if (!mounted) return;
        setThresholdsState(data.thresholds);
        setInspectionRecordsState(data.inspectionRecords);
        setAnomalyTicketsState(data.anomalyTickets);
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
      if (result.record) {
        addInspectionRecord(result.record);
      }
      return result as {
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
    inspectionPlans,
    filters,
    syncStatus,
    isLoading,
    wasInitialized,
    isOnline: syncStatus.isOnline,
    setThresholds,
    setInspectionRecords,
    setAnomalyTickets,
    setInspectionPlans,
    setFilters,
    addInspectionRecord,
    submitInspectionRecord,
    addAnomalyTicket,
    createAnomalyTicket,
    createTicketFromRecord,
    updateAnomalyTicketStatus,
    addInspectionPlan,
    createInspectionPlan,
    updateInspectionPlanStatus,
    checkAnomalies,
    getRecordStatus,
    hasTicketForRecord,
    getExistingRoomIds,
    ticketAssignees,
    planAreas,
    planRoles,
    countTicketsByStatus,
    countPlansByStatus,
    exportRecordsCsv,
    exportTicketsCsv,
    exportPlansCsv,
    exportAllJson,
    resetToSampleData,
    clearLocalData,
    syncPending,
  };
}
