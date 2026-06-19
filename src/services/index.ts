export * from "./ThresholdService";
export * from "./InspectionService";
export * from "./TicketService";
export * from "./AnomalyTraceService";
export * from "./PlanService";
export * from "./ExportService";
export * from "./SyncService";
export * from "./SyncCoordinator";
export * from "./FilterService";
export * from "./AppService";
export * from "./MigrationService";

import { localDBRepository } from "../repositories/LocalDBRepository";
import { apiSyncRepository } from "../repositories/ApiSyncRepository";
import { AppService } from "./AppService";

export const appService = new AppService(localDBRepository, apiSyncRepository);
