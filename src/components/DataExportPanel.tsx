import { useState } from "react";
import type { CleanArea } from "../domain";
import { CLEAN_AREAS } from "../domain";

interface DataExportPanelProps {
  onExportRecords: (area: CleanArea | "全部") => {
    success: boolean;
    message?: string;
  };
  onExportTickets: (area: CleanArea | "全部") => {
    success: boolean;
    message?: string;
  };
  onExportPlans: (area: CleanArea | "全部") => {
    success: boolean;
    message?: string;
  };
  onExportAll: () => { success: boolean; message?: string };
}

export default function DataExportPanel({
  onExportRecords,
  onExportTickets,
  onExportPlans,
  onExportAll,
}: DataExportPanelProps) {
  const [areaFilter, setAreaFilter] = useState<CleanArea | "全部">("全部");
  const [lastMessage, setLastMessage] = useState<string>("");

  const handleExport = (
    fn: (area: CleanArea | "全部") => { success: boolean; message?: string }
  ) => {
    const result = fn(areaFilter);
    if (!result.success && result.message) {
      setLastMessage(result.message);
      setTimeout(() => setLastMessage(""), 3000);
    } else {
      setLastMessage("导出成功");
      setTimeout(() => setLastMessage(""), 2000);
    }
  };

  const handleExportAll = () => {
    const result = onExportAll();
    if (!result.success && result.message) {
      setLastMessage(result.message);
      setTimeout(() => setLastMessage(""), 3000);
    } else {
      setLastMessage("全量数据导出成功");
      setTimeout(() => setLastMessage(""), 2000);
    }
  };

  return (
    <section className="export-panel panel">
      <div className="section-heading">
        <div>
          <p>数据管理</p>
          <h2>数据导出</h2>
        </div>
        <div className="export-hint">支持 CSV 和 JSON 格式，离线可用</div>
      </div>

      <div className="export-controls">
        <div className="export-filter-group">
          <span className="export-filter-label">筛选区域</span>
          <div className="chips muted">
            <button
              className={areaFilter === "全部" ? "chip-active" : ""}
              onClick={() => setAreaFilter("全部")}
            >
              全部
            </button>
            {CLEAN_AREAS.map((area) => (
              <button
                key={area}
                className={areaFilter === area ? "chip-active" : ""}
                onClick={() => setAreaFilter(area)}
              >
                {area}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="export-buttons">
        <button
          className="export-btn"
          onClick={() => handleExport(onExportRecords)}
        >
          📋 导出巡检记录 (CSV)
        </button>
        <button
          className="export-btn"
          onClick={() => handleExport(onExportTickets)}
        >
          🎫 导出异常工单 (CSV)
        </button>
        <button
          className="export-btn"
          onClick={() => handleExport(onExportPlans)}
        >
          📅 导出巡检计划 (CSV)
        </button>
        <button className="export-btn primary-action" onClick={handleExportAll}>
          💾 导出全量数据 (JSON)
        </button>
      </div>

      {lastMessage && <p className="export-message">{lastMessage}</p>}
    </section>
  );
}
