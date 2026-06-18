import type { SyncStatus } from "../domain";

interface SyncStatusBarProps {
  syncStatus: SyncStatus;
  onSyncNow?: () => void;
}

export default function SyncStatusBar({
  syncStatus,
  onSyncNow,
}: SyncStatusBarProps) {
  const total =
    syncStatus.pendingRecords +
    syncStatus.pendingTickets +
    syncStatus.pendingPlans;

  return (
    <div className={`sync-status-bar ${syncStatus.isOnline ? "online" : "offline"}`}>
      <div className="sync-indicator">
        <span className={`sync-dot ${syncStatus.isOnline ? "dot-online" : "dot-offline"}`} />
        <span className="sync-text">
          {syncStatus.isOnline ? "在线" : "离线模式 - 所有数据保存在本地"}
        </span>
      </div>
      {total > 0 && (
        <div className="sync-pending">
          <span>
            待同步: 记录 {syncStatus.pendingRecords} · 工单{" "}
            {syncStatus.pendingTickets} · 计划 {syncStatus.pendingPlans}
          </span>
          {onSyncNow && syncStatus.isOnline && (
            <button className="sync-btn" onClick={onSyncNow}>
              立即同步
            </button>
          )}
        </div>
      )}
    </div>
  );
}
