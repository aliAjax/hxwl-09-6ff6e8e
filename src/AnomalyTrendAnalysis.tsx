import { useMemo } from "react";
import {
  calculateAllTrendData,
  anomalyTypeColors,
  areaFilters,
  trendAnomalyTypes,
  type AnomalyTrendData,
  type TrendDataPoint,
} from "./services/TrendAnalysisService";
import type {
  AnomalyTicket,
  AreaThreshold,
  CleanArea,
  InspectionRecord,
  TrendAnomalyType,
} from "./domain";

function TrendChart({
  data,
  color,
}: {
  data: TrendDataPoint[];
  color: string;
}) {
  const width = 680;
  const height = 280;
  const padding = { top: 24, right: 24, bottom: 36, left: 48 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const values = data.map((d) => d.value);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const valueRange = maxValue - minValue || 1;
  const yPadding = valueRange * 0.15;
  const yMax = maxValue + yPadding;
  const yMin = Math.max(0, minValue - yPadding);
  const yRange = yMax - yMin;

  const getX = (index: number) =>
    padding.left + (index / (data.length - 1)) * chartWidth;
  const getY = (value: number) =>
    padding.top + chartHeight - ((value - yMin) / yRange) * chartHeight;

  const points = data.map((d, i) => ({
    x: getX(i),
    y: getY(d.value),
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const areaPath =
    linePath +
    ` L ${points[points.length - 1].x} ${padding.top + chartHeight}` +
    ` L ${points[0].x} ${padding.top + chartHeight} Z`;

  const yTickCount = 5;
  const yTicks = Array.from({ length: yTickCount }, (_, i) => {
    const value = yMin + (yRange * i) / (yTickCount - 1);
    return {
      value: Math.round(value),
      y: padding.top + chartHeight - (i / (yTickCount - 1)) * chartHeight,
    };
  });

  const gradientId = `trend-gradient-${color.replace("#", "")}`;

  return (
    <div className="trend-chart-container">
      <svg viewBox={`0 0 ${width} ${height}`} className="trend-chart">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              y1={tick.y}
              x2={width - padding.right}
              y2={tick.y}
              stroke="#e2e8f0"
              strokeDasharray="4 4"
            />
            <text
              x={padding.left - 8}
              y={tick.y + 4}
              textAnchor="end"
              fill="#94a3b8"
              fontSize="12"
            >
              {tick.value}
            </text>
          </g>
        ))}

        <path
          d={areaPath}
          fill={`url(#${gradientId})`}
          className="chart-area"
        />

        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="chart-line"
        />

        {points.map((p, i) => (
          <g key={i} className="chart-point-group">
            <circle
              cx={p.x}
              cy={p.y}
              r="4"
              fill="#ffffff"
              stroke={color}
              strokeWidth="2"
              className="chart-point"
            />
            <circle
              cx={p.x}
              cy={p.y}
              r="10"
              fill="transparent"
              className="chart-point-hit"
            />
            <text
              x={p.x}
              y={p.y - 12}
              textAnchor="middle"
              fill={color}
              fontSize="12"
              fontWeight="600"
              className="chart-point-value"
            >
              {data[i].value}
            </text>
          </g>
        ))}

        {data.map((d, i) => (
          <text
            key={i}
            x={getX(i)}
            y={height - padding.bottom + 20}
            textAnchor="middle"
            fill="#64748b"
            fontSize="12"
          >
            {d.date}
          </text>
        ))}
      </svg>
    </div>
  );
}

function SummaryMetricCard({
  label,
  value,
  subValue,
  trend,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: "up" | "down" | "stable";
  color: string;
  icon?: string;
}) {
  const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
  const trendCls = trend === "up"
    ? "trend-up"
    : trend === "down"
    ? "trend-down"
    : "trend-stable";

  return (
    <div className="trend-metric-card">
      <div className="trend-metric-header">
        <span className="trend-metric-label">{label}</span>
        {icon && <span className="trend-metric-icon">{icon}</span>}
      </div>
      <strong className="trend-metric-value" style={{ color }}>
        {value}
      </strong>
      {subValue && (
        <div className={`trend-metric-sub ${trendCls}`}>
          <span>{trendIcon}</span>
          <span>{subValue}</span>
        </div>
      )}
    </div>
  );
}

interface AnomalyTrendAnalysisProps {
  selectedArea: CleanArea | "全部";
  selectedType: TrendAnomalyType;
  onAreaChange: (area: CleanArea | "全部") => void;
  onTypeChange: (type: TrendAnomalyType) => void;
  inspectionRecords: InspectionRecord[];
  anomalyTickets: AnomalyTicket[];
  thresholds: AreaThreshold[];
}

function AnomalyTrendAnalysis({
  selectedArea,
  selectedType,
  onAreaChange,
  onTypeChange,
  inspectionRecords,
  anomalyTickets,
  thresholds,
}: AnomalyTrendAnalysisProps) {

  const allTrendDataMap = useMemo(() => {
    return calculateAllTrendData(
      inspectionRecords,
      anomalyTickets,
      thresholds,
      selectedArea,
      7
    );
  }, [inspectionRecords, anomalyTickets, thresholds, selectedArea]);

  const allTrendData = useMemo(() => {
    return trendAnomalyTypes.map((type) => ({
      type,
      data: allTrendDataMap[type],
    }));
  }, [allTrendDataMap]);

  const hasAnyData = useMemo(() => {
    return allTrendData.some((t) => t.data.hasData);
  }, [allTrendData]);

  const currentTrendData = useMemo(() => {
    return allTrendData.find((t) => t.type === selectedType)
      ?.data as AnomalyTrendData;
  }, [allTrendData, selectedType]);

  const chartColor = anomalyTypeColors[selectedType];

  const formatChangePercent = (percent: number, trend: "up" | "down" | "stable") => {
    if (trend === "stable") return "持平";
    const sign = percent > 0 ? "+" : "";
    return `${sign}${percent}%`;
  };

  return (
    <section className="trend-section panel">
      <div className="section-heading">
        <div>
          <p>数据分析</p>
          <h2>异常趋势分析</h2>
        </div>
        <div className="trend-hint">近7天数据趋势 · 基于本地巡检记录</div>
      </div>

      <div className="trend-filters">
        <div className="trend-filter-group">
          <span className="trend-filter-label">筛选区域</span>
          <div className="chips muted">
            {areaFilters.map((area) => (
              <button
                key={area}
                className={selectedArea === area ? "chip-active" : ""}
                onClick={() => onAreaChange(area)}
              >
                {area}
              </button>
            ))}
          </div>
        </div>

        <div className="trend-filter-group">
          <span className="trend-filter-label">异常类型</span>
          <div className="chips">
            {trendAnomalyTypes.map((type) => (
              <button
                key={type}
                className={selectedType === type ? "chip-active" : ""}
                onClick={() => onTypeChange(type)}
                style={selectedType === type ? {
                  background: anomalyTypeColors[type],
                  borderColor: anomalyTypeColors[type],
                } : {}}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {hasAnyData ? (
        <>
          <div className="trend-metrics-grid">
            {allTrendData.map(({ type, data }) => (
              <SummaryMetricCard
                key={type}
                label={type}
                value={data.summary.current}
                subValue={formatChangePercent(
                  data.summary.changePercent,
                  data.summary.trend
                )}
                trend={data.summary.trend}
                color={anomalyTypeColors[type]}
              />
            ))}
          </div>

          <div className="trend-chart-section">
            <div className="trend-chart-header">
              <div>
                <h3 className="trend-chart-title">
                  {selectedArea === "全部" ? "全区域" : selectedArea} · {selectedType}趋势
                </h3>
                <p className="trend-chart-subtitle">近7天每日{selectedType}数量变化</p>
              </div>
              <div className="trend-chart-summary">
                <div className="trend-summary-item">
                  <span className="trend-summary-label">最高</span>
                  <strong style={{ color: chartColor }}>
                    {currentTrendData.summary.max}
                  </strong>
                </div>
                <div className="trend-summary-item">
                  <span className="trend-summary-label">最低</span>
                  <strong style={{ color: "#64748b" }}>
                    {currentTrendData.summary.min}
                  </strong>
                </div>
                <div className="trend-summary-item">
                  <span className="trend-summary-label">平均</span>
                  <strong style={{ color: "#0f766e" }}>
                    {currentTrendData.summary.avg}
                  </strong>
                </div>
              </div>
            </div>

            <TrendChart data={currentTrendData.data} color={chartColor} />
          </div>

          <div className="trend-insights">
            <h4 className="trend-insights-title">数据洞察</h4>
            <div className="trend-insights-grid">
              <div className="trend-insight-card">
                <div className="trend-insight-dot" style={{ background: chartColor }} />
                <div>
                  <p className="trend-insight-label">当前趋势</p>
                  <p className="trend-insight-value">
                    {currentTrendData.summary.trend === "up" && "呈上升趋势，需重点关注"}
                    {currentTrendData.summary.trend === "down" && "呈下降趋势，状况有所改善"}
                    {currentTrendData.summary.trend === "stable" && "保持平稳，持续监控中"}
                  </p>
                </div>
              </div>
              <div className="trend-insight-card">
                <div className="trend-insight-dot" style={{ background: "#0f766e" }} />
                <div>
                  <p className="trend-insight-label">周环比变化</p>
                  <p className="trend-insight-value">
                    {currentTrendData.summary.trend === "up" && (
                      <span style={{ color: "#e11d48" }}>
                        较上周上升 {Math.abs(currentTrendData.summary.changePercent)}%
                      </span>
                    )}
                    {currentTrendData.summary.trend === "down" && (
                      <span style={{ color: "#16a34a" }}>
                        较上周下降 {Math.abs(currentTrendData.summary.changePercent)}%
                      </span>
                    )}
                    {currentTrendData.summary.trend === "stable" && (
                      <span style={{ color: "#64748b" }}>
                        与上周基本持平
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="trend-empty-state">
          <div className="trend-empty-icon">📊</div>
          <h3 className="trend-empty-title">暂无趋势数据</h3>
          <p className="trend-empty-desc">
            当前筛选条件下没有找到近7天的巡检记录或异常工单。
            <br />
            请先录入巡检记录或创建异常工单后再查看趋势分析。
          </p>
        </div>
      )}
    </section>
  );
}

export default AnomalyTrendAnalysis;
