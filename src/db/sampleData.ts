import {
  DEFAULT_THRESHOLDS,
  DEFAULT_TICKETS,
  DEFAULT_FILTERS,
  DEFAULT_TRACES,
} from "../domain/constants";
import type {
  AreaThreshold,
  AnomalyTicket,
  FilterConditions,
  InspectionRecord,
  AnomalyTrace,
} from "../domain";

const defaultThresholds: AreaThreshold[] = DEFAULT_THRESHOLDS;
const initialInspectionRecords: InspectionRecord[] = [];
const initialTickets: AnomalyTicket[] = DEFAULT_TICKETS;
const defaultFilters: FilterConditions = DEFAULT_FILTERS;
const initialTraces: AnomalyTrace[] = DEFAULT_TRACES;

export {
  defaultThresholds,
  initialInspectionRecords,
  initialTickets,
  defaultFilters,
  initialTraces,
};
