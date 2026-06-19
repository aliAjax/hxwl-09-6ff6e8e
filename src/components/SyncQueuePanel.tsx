import { useMemo, useState } from "react";
import type {
  SyncAction,
  SyncConflict,
  SyncEntityType,
  SyncItemStatus,
  SyncQueueItem,
} from "../domain";

interface SyncQueuePanelProps {
  queue: SyncQueueItem[];
  syncConflicts?: any[];
  isOnline: boolean;
  onSyncAll: () => void;
  onRetryFailed: () => void;
  onRetryItem: (itemId: number) => void;
  onRemoveItem: (itemId: number) => void;
  onClearSynced: () => void;
  onResolveConflict?: (conflictId: number, resolution: "keepLocal" | "useRemote") => Promise<any>;
  onOpenConflictPanel?: () => void;
}

const ENTITY_TYPE_LABELS: Record<SyncEntityType, string> = {
  inspectionRecord: "巡检记录",
  anomalyTicket: "异常工单",
  inspectionPlan: "巡检计划",
  anomalyTrace: "异常追踪",
  threshold: "阈值",
};

const ENTITY_TYPE_COLORS: Record<SyncEntityType, string> = {
  inspectionRecord: "#2563eb",
  anomalyTicket: "#dc2626",
  inspectionPlan: "#059669",
  anomalyTrace: "#7c3aed",
  threshold: "#d97706",
};

const ACTION_LABELS: Record<SyncAction, string> = {
  create: "新增",
  update: "修改",
  delete: "删除",
};

const STATUS_LABELS: Record<SyncItemStatus, string> = {
  pending: "等待同步",
  syncing: "同步中...",
  failed: "同步失败",
  synced: "已同步",
  conflict: "版本冲突",
};

const STATUS_CLASS: Record<SyncItemStatus, string> = {
  pending: "sq-status-pending",
  syncing: "sq-status-syncing",
  failed: "sq-status-failed",
  synced: "sq-status-synced",
  conflict: "sq-status-conflict",
};

type FilterTab = "all" | "pending" | "failed" | "synced" | "conflict";

function getEntitySummary(item: SyncQueueItem): string {
  const snap = item.dataSnapshot as any;
  switch (item.entityType) {
    case "inspectionRecord":
      return `${snap.roomId ?? "?"} · ${snap.area ?? "?"}`;
    case "anomalyTicket":
      return `${snap.roomId ?? "?"} · ${snap.anomalyType ?? "?"}`;
    case "inspectionPlan":
      return `${snap.date ?? "?"} · ${snap.area ?? "?"} · ${snap.inspector ?? "?"}`;
    case "anomalyTrace":
      return `${snap.roomId ?? "?"} · ${snap.anomalyType ?? "?"}`;
    case "threshold":
      return `${snap.area ?? "?"}`;
    default:
      return `#${item.entityId}`;
  }
}

function findConflictForItem(item: SyncQueueItem, conflicts: any[] | undefined): SyncConflict | undefined {
  if (!conflicts) return undefined;
  return conflicts.find(
    (c) => c.entityType === item.entityType && String(c.entityId) === String(item.entityId)
  );
}

export default function SyncQueuePanel({
  queue,
  syncConflicts,
  isOnline,
  onSyncAll,
  onRetryFailed,
  onRetryItem,
  onRemoveItem,
  onClearSynced,
  onResolveConflict,
  onOpenConflictPanel,
}: SyncQueuePanelProps) {
  const [filter, setFilter] = useState<FilterTab>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [conflictDialogItemId, setConflictDialogItemId] = useState<number | null>(null);
  const [resolving, setResolving] = useState(false);

  const stats = useMemo(() => {
    let pending = 0;
    let syncing = 0;
    let failed = 0;
    let synced = 0;
    let conflict = 0;
    for (const item of queue) {
      if (item.status === "pending") pending++;
      else if (item.status === "syncing") syncing++;
      else if (item.status === "failed") failed++;
      else if (item.status === "synced") synced++;
      else if (item.status === "conflict") conflict++;
    }
    return { total: queue.length, pending, syncing, failed, synced, conflict };
  }, [queue]);

  const filteredItems = useMemo(() => {
    if (filter === "all") return queue;
    return queue.filter((i) => i.status === filter);
  }, [queue, filter]);

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "全部", count: stats.total },
    { key: "pending", label: "待同步", count: stats.pending + stats.syncing },
    { key: "conflict", label: "冲突", count: stats.conflict },
    { key: "failed", label: "失败", count: stats.failed },
    { key: "synced", label: "已同步", count: stats.synced },
  ];

  const hasPendingOrFailed = stats.pending + stats.syncing + stats.failed + stats.conflict > 0;
  const hasFailed = stats.failed > 0;
  const hasSynced = stats.synced > 0;

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const openConflictDialog = (itemId: number) => {
    setConflictDialogItemId(itemId);
  };

  const closeConflictDialog = () => {
    setConflictDialogItemId(null);
  };

  const handleResolveConflict = async (resolution: "keepLocal" | "useRemote") => {
    if (conflictDialogItemId === null || !onResolveConflict) return;
    const item = queue.find((i) => i.id === conflictDialogItemId);
    if (!item) return;
    const conflict = findConflictForItem(item, syncConflicts);
    if (!conflict) return;
    try {
      setResolving(true);
      await onResolveConflict(conflict.id, resolution);
    } finally {
      setResolving(false);
      setConflictDialogItemId(null);
    }
  };

  const activeDialogItem = conflictDialogItemId !== null ? queue.find((i) => i.id === conflictDialogItemId) : null;
  const activeConflict = activeDialogItem ? findConflictForItem(activeDialogItem, syncConflicts) : null;

  return (
    <div className="sync-queue-panel">
      <div className="sq-header">
        <div className="sq-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-3-6.7L21 8"/>
            <path d="M21 3v5h-5"/>
          </svg>
          <span>同步队列</span>
        </div>

        <div className="sq-toolbar">
          <button
            className={`sq-btn sq-primary ${!isOnline || !hasPendingOrFailed ? "disabled" : ""}`}
            onClick={onSyncAll}
            disabled={!isOnline || !hasPendingOrFailed}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-3-6.7L21 8"/>
              <path d="M21 3v5h-5"/>
            </svg>
            同步全部
          </button>

          <button
            className={`sq-btn sq-warn ${!isOnline || !hasFailed ? "disabled" : ""}`}
            onClick={onRetryFailed}
            disabled={!isOnline || !hasFailed}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            重试失败项 {hasFailed ? `(${stats.failed})` : ""}
          </button>

          <button
            className={`sq-btn sq-ghost ${!hasSynced ? "disabled" : ""}`}
            onClick={onClearSynced}
            disabled={!hasSynced}
          >
            清理已同步
          </button>
        </div>
      </div>

      <div className="sq-stats-row">
        <div className="sq-stat sq-stat-pending">
          <span className="sq-stat-num">{stats.pending + stats.syncing}</span>
          <span className="sq-stat-label">待同步</span>
        </div>
        <div className="sq-stat sq-stat-conflict">
          <span className="sq-stat-num">{stats.conflict}</span>
          <span className="sq-stat-label">冲突</span>
        </div>
        <div className="sq-stat sq-stat-failed">
          <span className="sq-stat-num">{stats.failed}</span>
          <span className="sq-stat-label">失败</span>
        </div>
        <div className="sq-stat sq-stat-synced">
          <span className="sq-stat-num">{stats.synced}</span>
          <span className="sq-stat-label">已同步</span>
        </div>
        <div className="sq-stat sq-stat-total">
          <span className="sq-stat-num">{stats.total}</span>
          <span className="sq-stat-label">总计</span>
        </div>
      </div>

      <div className="sq-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`sq-tab ${filter === t.key ? "active" : ""}`}
            onClick={() => setFilter(t.key)}
          >
            {t.label}
            <span className="sq-tab-count">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="sq-list">
        {filteredItems.length === 0 ? (
          <div className="sq-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <p>暂无{filter === "all" ? "" : STATUS_LABELS[filter as SyncItemStatus]}记录</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isExpanded = expandedId === item.id;
            const canRetry = (item.status === "failed" || item.status === "pending" || item.status === "conflict") && isOnline;
            const conflict = findConflictForItem(item, syncConflicts);
            return (
              <div
                key={item.id}
                className={`sq-item ${STATUS_CLASS[item.status]} ${isExpanded ? "expanded" : ""}`}
              >
                <div className="sq-item-row" onClick={() => toggleExpand(item.id)}>
                  <div
                    className="sq-item-type-badge"
                    style={{ backgroundColor: ENTITY_TYPE_COLORS[item.entityType] }}
                  >
                    {ENTITY_TYPE_LABELS[item.entityType]}
                  </div>

                  <div className="sq-item-main">
                    <div className="sq-item-title">
                      <span className={`sq-item-action sq-action-${item.action}`}>
                        {ACTION_LABELS[item.action]}
                      </span>
                      <span className="sq-item-summary">{getEntitySummary(item)}</span>
                      <span className="sq-item-id">#{item.entityId}</span>
                    </div>
                    <div className="sq-item-meta">
                      <span className={`sq-status-badge ${STATUS_CLASS[item.status]}`}>
                        {item.status === "syncing" && (
                          <span className="sq-spinner" />
                        )}
                        {STATUS_LABELS[item.status]}
                      </span>
                      <span className="sq-item-time">创建 {item.createdAt}</span>
                      {item.retryCount > 0 && (
                        <span className="sq-item-retry">重试 {item.retryCount} 次</span>
                      )}
                      {item.lastAttemptAt && (
                        <span className="sq-item-time">上次尝试 {item.lastAttemptAt}</span>
                      )}
                      {item.syncedAt && (
                        <span className="sq-item-time">完成 {item.syncedAt}</span>
                      )}
                    </div>
                  </div>

                  <div className="sq-item-actions" onClick={(e) => e.stopPropagation()}>
                    {item.status === "conflict" && onResolveConflict && (
                      <button
                        className="sq-icon-btn sq-icon-conflict"
                        title="解决冲突"
                        onClick={() => openConflictDialog(item.id)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="12" y1="8" x2="12" y2="12"/>
                          <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                      </button>
                    )}
                    {canRetry && (
                      <button
                        className="sq-icon-btn sq-icon-retry"
                        title="重试"
                        onClick={() => onRetryItem(item.id)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 4v6h-6"/>
                          <path d="M1 20v-6h6"/>
                          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                        </svg>
                      </button>
                    )}
                    {item.status === "synced" && (
                      <button
                        className="sq-icon-btn sq-icon-remove"
                        title="移除"
                        onClick={() => onRemoveItem(item.id)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
                    )}
                    <svg
                      className={`sq-expand-arrow ${isExpanded ? "rotated" : ""}`}
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                </div>

                {isExpanded && (
                  <div className="sq-item-detail">
                    {item.errorMessage && (
                      <div className="sq-error-block">
                        <div className="sq-error-title">失败原因</div>
                        <div className="sq-error-content">{item.errorMessage}</div>
                      </div>
                    )}

                    {item.status === "conflict" && conflict && (
                      <div className="sq-conflict-block">
                        <div className="sq-conflict-title">版本冲突信息</div>
                        <div className="sq-conflict-compare">
                          <div className="sq-conflict-side sq-conflict-local">
                            <div className="sq-conflict-side-title">
                              <span className="sq-conflict-side-dot" />
                              本地版本
                              {conflict.localVersion !== undefined && (
                                <span className="sq-conflict-version">v{conflict.localVersion}</span>
                              )}
                            </div>
                            {conflict.localUpdatedAt && (
                              <div className="sq-conflict-side-time">{conflict.localUpdatedAt}</div>
                            )}
                            <pre className="sq-conflict-json">
                              {JSON.stringify(conflict.localSnapshot, null, 2)}
                            </pre>
                          </div>
                          <div className="sq-conflict-vs">VS</div>
                          <div className="sq-conflict-side sq-conflict-remote">
                            <div className="sq-conflict-side-title">
                              <span className="sq-conflict-side-dot" />
                              远端版本
                              {conflict.remoteVersion !== undefined && (
                                <span className="sq-conflict-version">v{conflict.remoteVersion}</span>
                              )}
                            </div>
                            {conflict.remoteUpdatedAt && (
                              <div className="sq-conflict-side-time">{conflict.remoteUpdatedAt}</div>
                            )}
                            <pre className="sq-conflict-json">
                              {JSON.stringify(conflict.remoteSnapshot, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="sq-detail-section">
                      <div className="sq-detail-title">数据快照</div>
                      <pre className="sq-data-json">
                        {JSON.stringify(item.dataSnapshot, null, 2)}
                      </pre>
                    </div>

                    {item.status !== "syncing" && item.status !== "synced" && (
                      <div className="sq-detail-actions">
                        {item.status === "conflict" && onResolveConflict && (
                          <>
                            <button
                              className="sq-btn sq-warn"
                              onClick={() => handleResolveConflict("keepLocal")}
                              disabled={resolving}
                            >
                              保留本地
                            </button>
                            <button
                              className="sq-btn sq-primary"
                              onClick={() => handleResolveConflict("useRemote")}
                              disabled={resolving}
                            >
                              使用远端
                            </button>
                          </>
                        )}
                        {canRetry && (
                          <button
                            className="sq-btn sq-primary"
                            onClick={() => onRetryItem(item.id)}
                          >
                            重试此项
                          </button>
                        )}
                        <button
                          className="sq-btn sq-danger-ghost"
                          onClick={() => onRemoveItem(item.id)}
                        >
                          从队列中移除
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {activeDialogItem && activeConflict && (
        <div className="sq-conflict-overlay" onClick={closeConflictDialog}>
          <div className="sq-conflict-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sq-conflict-modal-header">
              <h3>解决版本冲突</h3>
              <button className="sq-conflict-close" onClick={closeConflictDialog} disabled={resolving}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="sq-conflict-modal-body">
              <div className="sq-conflict-modal-summary">
                <span className="sq-item-type-badge" style={{ backgroundColor: ENTITY_TYPE_COLORS[activeDialogItem.entityType] }}>
                  {ENTITY_TYPE_LABELS[activeDialogItem.entityType]}
                </span>
                <span className="sq-conflict-modal-name">{getEntitySummary(activeDialogItem)}</span>
              </div>
              <div className="sq-conflict-compare">
                <div className="sq-conflict-side sq-conflict-local">
                  <div className="sq-conflict-side-title">
                    <span className="sq-conflict-side-dot" />
                    本地版本
                    {activeConflict.localVersion !== undefined && (
                      <span className="sq-conflict-version">v{activeConflict.localVersion}</span>
                    )}
                  </div>
                  {activeConflict.localUpdatedAt && (
                    <div className="sq-conflict-side-time">{activeConflict.localUpdatedAt}</div>
                  )}
                  <pre className="sq-conflict-json">
                    {JSON.stringify(activeConflict.localSnapshot, null, 2)}
                  </pre>
                </div>
                <div className="sq-conflict-vs">VS</div>
                <div className="sq-conflict-side sq-conflict-remote">
                  <div className="sq-conflict-side-title">
                    <span className="sq-conflict-side-dot" />
                    远端版本
                    {activeConflict.remoteVersion !== undefined && (
                      <span className="sq-conflict-version">v{activeConflict.remoteVersion}</span>
                    )}
                  </div>
                  {activeConflict.remoteUpdatedAt && (
                    <div className="sq-conflict-side-time">{activeConflict.remoteUpdatedAt}</div>
                  )}
                  <pre className="sq-conflict-json">
                    {JSON.stringify(activeConflict.remoteSnapshot, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
            <div className="sq-conflict-modal-actions">
              <button
                className="sq-btn sq-danger-ghost"
                onClick={closeConflictDialog}
                disabled={resolving}
              >
                取消
              </button>
              <button
                className="sq-btn sq-warn"
                onClick={() => handleResolveConflict("keepLocal")}
                disabled={resolving}
              >
                保留本地版本
              </button>
              <button
                className="sq-btn sq-primary"
                onClick={() => handleResolveConflict("useRemote")}
                disabled={resolving}
              >
                使用远端版本
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
