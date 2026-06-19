import { useState, useMemo } from "react";
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
  onExportTeamReview: (params: {
    area: CleanArea | "全部";
    startDate: string;
    endDate: string;
  }) => { success: boolean; message?: string };
}

function isValidDateStr(s: string): boolean {
  if (!s) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export default function DataExportPanel({
  onExportRecords,
  onExportTickets,
  onExportPlans,
  onExportAll,
  onExportTeamReview,
}: DataExportPanelProps) {
  const [areaFilter, setAreaFilter] = useState<CleanArea | "全部">("全部");
  const [reportArea, setReportArea] = useState<CleanArea | "全部">("全部");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [lastMessage, setLastMessage] = useState<string>("");

  const dateError = useMemo<string>(() => {
    if (startDate && !isValidDateStr(startDate)) {
      return "开始日期格式无效";
    }
    if (endDate && !isValidDateStr(endDate)) {
      return "结束日期格式无效";
    }
    if (startDate && endDate && startDate > endDate) {
      return "开始日期不能晚于结束日期";
    }
    return "";
  }, [startDate, endDate]);

  const showMessage = (msg: string, duration = 2500) => {
    setLastMessage(msg);
    setTimeout(() => setLastMessage(""), duration);
  };

  const handleExport = (
    fn: (area: CleanArea | "全部") => { success: boolean; message?: string }
  ) => {
    const result = fn(areaFilter);
    if (!result.success && result.message) {
      showMessage(result.message, 3500);
    } else {
      showMessage("导出成功");
    }
  };

  const handleExportAll = () => {
    const result = onExportAll();
    if (!result.success && result.message) {
      showMessage(result.message, 3500);
    } else {
      showMessage("全量数据导出成功");
    }
  };

  const handleExportTeamReview = () => {
    if (dateError) {
      showMessage(dateError, 3500);
      return;
    }
    const result = onExportTeamReview({
      area: reportArea,
      startDate,
      endDate,
    });
    if (!result.success && result.message) {
      showMessage(result.message, 3500);
    } else {
      showMessage("班组复盘综合报告导出成功");
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

      <div className="export-section">
        <h3 className="export-subtitle">单项数据导出 (CSV)</h3>
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
          <button className="export-btn" onClick={handleExportAll}>
            💾 导出全量数据 (JSON)
          </button>
        </div>
      </div>

      <div className="export-section export-section-team">
        <h3 className="export-subtitle">
          📊 班组复盘综合报告 (JSON)
          <span className="export-subtitle-hint">
            包含巡检记录、异常工单、异常追踪、根因判断、未关闭风险和阈值快照
          </span>
        </h3>
        <div className="export-controls">
          <div className="export-filter-group">
            <span className="export-filter-label">洁净等级</span>
            <div className="chips muted">
              <button
                className={reportArea === "全部" ? "chip-active" : ""}
                onClick={() => setReportArea("全部")}
              >
                全部
              </button>
              {CLEAN_AREAS.map((area) => (
                <button
                  key={area}
                  className={reportArea === area ? "chip-active" : ""}
                  onClick={() => setReportArea(area)}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>
          <div className="export-filter-group">
            <span className="export-filter-label">时间范围</span>
            <div className="date-range-group">
              <label className="date-input-label">
                开始：
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`date-input ${
                    startDate && !isValidDateStr(startDate) ? "date-input-error" : ""
                  }`}
                />
              </label>
              <label className="date-input-label">
                结束：
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`date-input ${
                    endDate && !isValidDateStr(endDate) ? "date-input-error" : ""
                  }`}
                />
              </label>
              <span className="date-range-hint">留空表示不限</span>
            </div>
            {dateError && (
              <div className="date-error">{dateError}</div>
            )}
          </div>
        </div>

        <div className="export-buttons">
          <button
            className={`export-btn primary-action team-report-btn ${
              dateError ? "export-btn-disabled" : ""
            }`}
            onClick={handleExportTeamReview}
            disabled={!!dateError}
          >
            📤 导出班组复盘综合报告
          </button>
        </div>
      </div>

      {lastMessage && <p className="export-message">{lastMessage}</p>}
    </section>
  );
}
