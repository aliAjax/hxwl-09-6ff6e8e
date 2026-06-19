import { useState } from "react";
import type { SyncConflict } from "../domain";

interface ConflictResolutionDialogProps {
  open: boolean;
  conflict: SyncConflict | null;
  onResolve: (
    conflictId: number,
    resolution: "keepLocal" | "useRemote"
  ) => Promise<{ success: boolean; errorMessage?: string }>;
  onClose: () => void;
}

const entityTypeLabels: Record<string, string> = {
  inspectionRecord: "巡检记录",
  anomalyTicket: "异常工单",
  inspectionPlan: "巡检计划",
  anomalyTrace: "异常追踪",
  threshold: "阈值配置",
};

function formatDateTime(value?: string): string {
  if (!value) return "-";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return value;
  }
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function ConflictResolutionDialog({
  open,
  conflict,
  onResolve,
  onClose,
}: ConflictResolutionDialogProps) {
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !conflict) return null;

  const handleResolve = async (resolution: "keepLocal" | "useRemote") => {
    setResolving(true);
    setError(null);
    try {
      const result = await onResolve(conflict.id, resolution);
      if (result.success) {
        onClose();
      } else {
        setError(result.errorMessage ?? "解决冲突失败，请重试");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "解决冲突时发生未知错误"
      );
    } finally {
      setResolving(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !resolving) {
      onClose();
    }
  };

  return (
    <div className="confirm-overlay" onClick={handleOverlayClick}>
      <div
        className="conflict-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="conflict-header">
          <h3 className="conflict-title">数据同步冲突</h3>
          {!resolving && (
            <button
              className="conflict-close-btn"
              onClick={onClose}
              aria-label="关闭"
            >
              ×
            </button>
          )}
        </div>

        <div className="conflict-info">
          <div className="conflict-info-row">
            <span className="conflict-info-label">实体类型：</span>
            <span className="conflict-info-value">
              {entityTypeLabels[conflict.entityType] ?? conflict.entityType}
            </span>
          </div>
          <div className="conflict-info-row">
            <span className="conflict-info-label">实体 ID：</span>
            <span className="conflict-info-value conflict-id">
              {String(conflict.entityId)}
            </span>
          </div>
          <div className="conflict-info-row">
            <span className="conflict-info-label">检测时间：</span>
            <span className="conflict-info-value">
              {formatDateTime(conflict.detectedAt)}
            </span>
          </div>
        </div>

        <div className="conflict-hint">
          <span className="conflict-hint-icon">⚠️</span>
          <p className="conflict-hint-text">
            本地数据与远端服务器数据存在版本冲突，请对比两个版本后选择保留哪一方。
            {conflict.errorMessage && (
              <span className="conflict-hint-error">
                错误信息：{conflict.errorMessage}
              </span>
            )}
          </p>
        </div>

        <div className="conflict-compare">
          <div className="conflict-side conflict-side-local">
            <div className="conflict-side-header">
              <span className="conflict-side-badge">本地版本</span>
              <span className="conflict-side-version">
                v{conflict.localVersion ?? "?"}
              </span>
            </div>
            <div className="conflict-side-meta">
              <span className="conflict-meta-label">更新时间：</span>
              <span className="conflict-meta-value">
                {formatDateTime(conflict.localUpdatedAt)}
              </span>
            </div>
            <pre className="conflict-json">{formatJson(conflict.localSnapshot)}</pre>
          </div>

          <div className="conflict-divider" aria-hidden="true">
            <span>VS</span>
          </div>

          <div className="conflict-side conflict-side-remote">
            <div className="conflict-side-header">
              <span className="conflict-side-badge">远端版本</span>
              <span className="conflict-side-version">
                v{conflict.remoteVersion ?? "?"}
              </span>
            </div>
            <div className="conflict-side-meta">
              <span className="conflict-meta-label">更新时间：</span>
              <span className="conflict-meta-value">
                {formatDateTime(conflict.remoteUpdatedAt)}
              </span>
            </div>
            <pre className="conflict-json">{formatJson(conflict.remoteSnapshot)}</pre>
          </div>
        </div>

        {error && (
          <div className="conflict-error">
            <span className="conflict-error-icon">✕</span>
            <span>{error}</span>
          </div>
        )}

        {resolving && (
          <div className="conflict-loading">
            <div className="conflict-spinner" />
            <span>正在解决冲突...</span>
          </div>
        )}

        <div className="conflict-actions">
          <button
            className="conflict-btn conflict-btn-close"
            onClick={onClose}
            disabled={resolving}
          >
            关闭
          </button>
          <button
            className="conflict-btn conflict-btn-keep-local"
            onClick={() => handleResolve("keepLocal")}
            disabled={resolving}
          >
            保留本地版本
          </button>
          <button
            className="conflict-btn conflict-btn-use-remote"
            onClick={() => handleResolve("useRemote")}
            disabled={resolving}
          >
            使用远端版本
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConflictResolutionDialog;
