import { useState } from "react";
import type { SyncQueueItem, SyncStatus } from "../domain";
import SyncQueuePanel from "./SyncQueuePanel";

interface SyncStatusBarProps {
  syncStatus: SyncStatus;
  syncQueue: SyncQueueItem[];
  syncConflicts?: any[];
  onSyncNow?: () => void;
  onProcessQueue?: (
    scope?: "all" | "pending" | "failed",
    itemIds?: number[]
  ) => Promise<any>;
  onRetryFailed?: () => void;
  onRetryItem?: (itemId: number) => Promise<any>;
  onRemoveItem?: (itemId: number) => Promise<void>;
  onClearSynced?: () => Promise<void>;
  onResolveConflict?: (conflictId: number, resolution: "keepLocal" | "useRemote") => Promise<any>;
  onOpenConflictPanel?: () => void;
}

export default function SyncStatusBar({
  syncStatus,
  syncQueue,
  syncConflicts,
  onSyncNow,
  onProcessQueue,
  onRetryFailed,
  onRetryItem,
  onRemoveItem,
  onClearSynced,
  onResolveConflict,
  onOpenConflictPanel,
}: SyncStatusBarProps) {
  const [expanded, setExpanded] = useState(false);

  const totalPending = syncStatus.queuePending;
  const totalFailed = syncStatus.queueFailed;
  const totalConflict = syncStatus.queueConflict ?? syncStatus.conflictCount ?? 0;
  const total = totalPending + totalFailed + totalConflict;

  const pendingRecs = syncStatus.pendingRecords + syncStatus.failedRecords;
  const pendingTickets = syncStatus.pendingTickets + syncStatus.failedTickets;
  const pendingPlans = syncStatus.pendingPlans + syncStatus.failedPlans;

  const showQueueBadge = syncStatus.queueTotal > 0;
  const conflictCount = syncStatus.conflictCount ?? 0;

  const handleSyncAll = async () => {
    if (onProcessQueue) {
      await onProcessQueue("all");
    } else if (onSyncNow) {
      onSyncNow();
    }
  };

  return (
    <>
      <div
        className={`sync-status-bar ${syncStatus.isOnline ? "online" : "offline"} ${expanded ? "expanded" : ""}`}
      >
        <div className="sync-indicator">
          <span className={`sync-dot ${syncStatus.isOnline ? "dot-online" : "dot-offline"}`} />
          <span className="sync-text">
            {syncStatus.isOnline ? "在线" : "离线模式 - 所有数据保存在本地"}
          </span>
          {totalFailed > 0 && (
            <span className="sync-failed-badge" title="存在同步失败项">
              {totalFailed} 失败
            </span>
          )}
          {conflictCount > 0 && (
            <span
              className="sync-conflict-badge"
              title="存在同步冲突，需要解决"
              onClick={onOpenConflictPanel}
              style={{ cursor: onOpenConflictPanel ? "pointer" : "default" }}
            >
              {conflictCount} 冲突
            </span>
          )}
        </div>

        <div className="sync-right">
          {showQueueBadge && (
            <button
              className="sync-queue-toggle"
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? "收起同步队列" : "展开同步队列"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"/>
                <line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/>
                <line x1="3" y1="12" x2="3.01" y2="12"/>
                <line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
              <span>
                {syncStatus.queueTotal > 0
                  ? `队列 ${syncStatus.queueTotal}`
                  : "同步队列"}
              </span>
              {totalPending > 0 && (
                <span className="sq-badge sq-badge-warn">{totalPending}</span>
              )}
              {totalFailed > 0 && (
                <span className="sq-badge sq-badge-error">{totalFailed}</span>
              )}
              {totalConflict > 0 && (
                <span className="sq-badge sq-badge-conflict">{totalConflict}</span>
              )}
              <svg
                className={`sq-expand-icon ${expanded ? "rotated" : ""}`}
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
          )}

          {total > 0 && (
            <div className="sync-pending">
              <span className="sync-pending-text">
                待同步: 记录 {pendingRecs} · 工单 {pendingTickets} · 计划 {pendingPlans}
              </span>
              {syncStatus.isOnline && (
                <button
                  className="sync-btn"
                  onClick={handleSyncAll}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-3-6.7L21 8"/>
                    <path d="M21 3v5h-5"/>
                  </svg>
                  立即同步
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div className="sync-queue-panel-wrapper">
          <SyncQueuePanel
            queue={syncQueue}
            isOnline={syncStatus.isOnline}
            onSyncAll={handleSyncAll}
            onRetryFailed={onRetryFailed ?? (() => onProcessQueue?.("failed"))}
            onRetryItem={async (id) => {
              if (onRetryItem) {
                await onRetryItem(id);
              } else if (onProcessQueue) {
                await onProcessQueue("all", [id]);
              }
            }}
            onRemoveItem={async (id) => {
              if (onRemoveItem) await onRemoveItem(id);
            }}
            onClearSynced={async () => {
              if (onClearSynced) await onClearSynced();
            }}
            syncConflicts={syncConflicts}
            onResolveConflict={onResolveConflict}
            onOpenConflictPanel={onOpenConflictPanel}
          />
        </div>
      )}
    </>
  );
}
