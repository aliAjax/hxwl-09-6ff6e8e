import { useState, useEffect, useCallback } from "react";
import {
  loadAllData,
  saveAllThresholds,
  saveAllInspectionRecords,
  saveAllAnomalyTickets,
  saveFilterConditions,
  clearAllData,
  seedSampleData,
} from "./indexedDB";
import type {
  AreaThreshold,
  InspectionRecord,
  AnomalyTicket,
  FilterConditions,
} from "./types";

type Updater<T> = T | ((prev: T) => T);

interface UsePersistenceReturn {
  thresholds: AreaThreshold[];
  inspectionRecords: InspectionRecord[];
  anomalyTickets: AnomalyTicket[];
  filters: FilterConditions;
  isLoading: boolean;
  wasInitialized: boolean;
  setThresholds: (t: Updater<AreaThreshold[]>) => void;
  setInspectionRecords: (r: Updater<InspectionRecord[]>) => void;
  setAnomalyTickets: (t: Updater<AnomalyTicket[]>) => void;
  setFilters: (f: Updater<FilterConditions>) => void;
  addInspectionRecord: (r: InspectionRecord) => void;
  addAnomalyTicket: (t: AnomalyTicket) => void;
  updateAnomalyTicketStatus: (id: number, status: AnomalyTicket["status"]) => void;
  resetToSampleData: () => Promise<void>;
  clearLocalData: () => Promise<void>;
}

function resolveUpdater<T>(updater: Updater<T>, prev: T): T {
  return typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater;
}

function usePersistence(): UsePersistenceReturn {
  const [thresholds, setThresholdsState] = useState<AreaThreshold[]>([]);
  const [inspectionRecords, setInspectionRecordsState] = useState<InspectionRecord[]>([]);
  const [anomalyTickets, setAnomalyTicketsState] = useState<AnomalyTicket[]>([]);
  const [filters, setFiltersState] = useState<FilterConditions>({
    planStatusFilter: "全部",
    ticketStatusFilter: "全部",
    trendAreaFilter: "全部",
    trendTypeFilter: "粒子异常",
    activeRole: "巡检员",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [wasInitialized, setWasInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;

    loadAllData()
      .then((data) => {
        if (!mounted) return;
        setThresholdsState(data.thresholds);
        setInspectionRecordsState(data.inspectionRecords);
        setAnomalyTicketsState(data.anomalyTickets);
        setFiltersState(data.filters);
        setWasInitialized(data.wasEmpty);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load data from IndexedDB:", err);
        setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const setThresholds = useCallback((t: Updater<AreaThreshold[]>) => {
    setThresholdsState((prev) => {
      const next = resolveUpdater(t, prev);
      saveAllThresholds(next).catch((err) =>
        console.error("Failed to save thresholds:", err)
      );
      return next;
    });
  }, []);

  const setInspectionRecords = useCallback((r: Updater<InspectionRecord[]>) => {
    setInspectionRecordsState((prev) => {
      const next = resolveUpdater(r, prev);
      saveAllInspectionRecords(next).catch((err) =>
        console.error("Failed to save inspection records:", err)
      );
      return next;
    });
  }, []);

  const setAnomalyTickets = useCallback((t: Updater<AnomalyTicket[]>) => {
    setAnomalyTicketsState((prev) => {
      const next = resolveUpdater(t, prev);
      saveAllAnomalyTickets(next).catch((err) =>
        console.error("Failed to save anomaly tickets:", err)
      );
      return next;
    });
  }, []);

  const setFilters = useCallback((f: Updater<FilterConditions>) => {
    setFiltersState((prev) => {
      const next = resolveUpdater(f, prev);
      saveFilterConditions(next).catch((err) =>
        console.error("Failed to save filter conditions:", err)
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

  const addAnomalyTicket = useCallback(
    (ticket: AnomalyTicket) => {
      setAnomalyTickets((prev) => [...prev, ticket]);
    },
    [setAnomalyTickets]
  );

  const updateAnomalyTicketStatus = useCallback(
    (id: number, status: AnomalyTicket["status"]) => {
      setAnomalyTickets((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status } : t))
      );
    },
    [setAnomalyTickets]
  );

  const resetToSampleData = useCallback(async () => {
    await seedSampleData();
    const data = await loadAllData();
    setThresholdsState(data.thresholds);
    setInspectionRecordsState(data.inspectionRecords);
    setAnomalyTicketsState(data.anomalyTickets);
    setFiltersState(data.filters);
  }, []);

  const clearLocalData = useCallback(async () => {
    await clearAllData();
    await seedSampleData();
    const data = await loadAllData();
    setThresholdsState(data.thresholds);
    setInspectionRecordsState(data.inspectionRecords);
    setAnomalyTicketsState(data.anomalyTickets);
    setFiltersState(data.filters);
    setWasInitialized(true);
  }, []);

  return {
    thresholds,
    inspectionRecords,
    anomalyTickets,
    filters,
    isLoading,
    wasInitialized,
    setThresholds,
    setInspectionRecords,
    setAnomalyTickets,
    setFilters,
    addInspectionRecord,
    addAnomalyTicket,
    updateAnomalyTicketStatus,
    resetToSampleData,
    clearLocalData,
  };
}

export default usePersistence;
