import type { InspectionRecord, TicketAnomalyType } from "../domain";
import { checkAnomalies } from "../domain";

interface InspectionRecordsListProps {
  records: InspectionRecord[];
  thresholds?: any;
  onViewTrace?: (record: InspectionRecord, anomalyType: TicketAnomalyType) => void;
}

export default function InspectionRecordsList({
  records,
  thresholds = [],
  onViewTrace,
}: InspectionRecordsListProps) {
  const getStatusCls = (status: string) =>
    status === "稳定"
      ? "record-status-ok"
      : status === "关注"
      ? "record-status-watch"
      : "record-status-danger";

  return (
    <section className="records panel">
      <div className="section-heading">
        <div>
          <p>最新提交的巡检记录</p>
          <h2>近期记录</h2>
        </div>
        <div className="record-count-badge">共 {records.length} 条</div>
      </div>
      <div className="record-list">
        {records.length > 0 ? (
          records.map((record, index) => {
            const statusCls = getStatusCls(record.status);
            return (
              <article
                key={record.id}
                className="record-card inspection-record-card"
              >
                <div className="record-index">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="inspection-record-body">
                  <div className="inspection-record-header">
                    <h3>
                      {record.roomId}
                      <span className={`record-status-inline ${statusCls}`}>
                        {record.status}
                      </span>
                    </h3>
                    <span className="record-area-tag">{record.area}</span>
                  </div>
                  <div className="inspection-record-meta">
                    <span>
                      粒子: {record.particle05um.toLocaleString()} /{" "}
                      {record.particle5um.toLocaleString()}
                    </span>
                    <span>压差: {record.pressure}Pa</span>
                    <span>温度: {record.temperature}°C</span>
                    <span>湿度: {record.humidity}%</span>
                  </div>
                  <div className="inspection-record-footer">
                    <span className="record-device-status">
                      设备: {record.deviceStatus}
                    </span>
                    <span className="record-time">{record.createdAt}</span>
                  </div>
                  {record.remark && (
                    <div className="inspection-record-remark">
                      <span>备注:</span> {record.remark}
                    </div>
                  )}
                  {onViewTrace && record.status !== "稳定" && (
                    <div className="record-trace-entry">
                      <button
                        className="record-trace-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          const anomalies = checkAnomalies(record, thresholds);
                          let primaryType: TicketAnomalyType = "粒子异常";
                          if (anomalies.particle) primaryType = "粒子异常";
                          else if (anomalies.pressure) primaryType = "压差异常";
                          else if (anomalies.temp || anomalies.humidity)
                            primaryType = "温湿度偏移";
                          onViewTrace(record, primaryType);
                        }}
                      >
                        🔍 查看根因追踪
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })
        ) : (
          <div className="empty-records">
            <p>暂无巡检记录</p>
            <p className="empty-hint">请在上方表单中填写并提交巡检记录</p>
          </div>
        )}
      </div>
    </section>
  );
}
