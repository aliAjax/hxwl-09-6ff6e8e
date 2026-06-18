import {
  DEFAULT_THRESHOLDS,
  DEFAULT_TICKETS,
  DEFAULT_FILTERS,
} from "../domain/constants";
import type {
  AreaThreshold,
  AnomalyTicket,
  FilterConditions,
  InspectionRecord,
} from "../domain";

const defaultThresholds: AreaThreshold[] = DEFAULT_THRESHOLDS;
const initialInspectionRecords: InspectionRecord[] = [];
const initialTickets: AnomalyTicket[] = DEFAULT_TICKETS;
const defaultFilters: FilterConditions = DEFAULT_FILTERS;

export {
  defaultThresholds,
  initialInspectionRecords,
  initialTickets,
  defaultFilters,
};
