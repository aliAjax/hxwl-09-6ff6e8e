import type {
  AreaThreshold,
  CleanArea,
  AnomalyType,
  RecordStatus,
  TicketAnomalyType,
  ThresholdRange,
} from "../domain";
import { checkAnomalies, getRecordStatus, getAnomalyTypes, buildTicketRemark } from "../domain";

type SampleRecord = {
  id: number;
  roomId: string;
  area: CleanArea;
  particle05um: number;
  particle5um: number;
  pressure: number;
  temperature: number;
  humidity: number;
};

const sampleRecords: SampleRecord[] = [
  { id: 1, roomId: "CR-1201", area: "ISO 5", particle05um: 4200, particle5um: 35, pressure: 15, temperature: 22, humidity: 45 },
  { id: 2, roomId: "CR-2107", area: "ISO 6", particle05um: 28000, particle5um: 200, pressure: 15, temperature: 22, humidity: 48 },
  { id: 3, roomId: "Y-0302", area: "黄光区", particle05um: 30000, particle5um: 250, pressure: 12, temperature: 23, humidity: 54 },
  { id: 4, roomId: "CR-3305", area: "ISO 7", particle05um: 380000, particle5um: 3100, pressure: 7, temperature: 27, humidity: 62 },
  { id: 5, roomId: "CR-1108", area: "ISO 5", particle05um: 2800, particle5um: 20, pressure: 14, temperature: 21, humidity: 42 },
];

interface PreviewTableProps {
  thresholds: AreaThreshold[];
  onCreateTicket: (record: SampleRecord, anomalyType: TicketAnomalyType) => Promise<void> | void;
  hasTicketForRecord: (recordId: number, anomalyType: TicketAnomalyType) => boolean;
}

export default function PreviewTable({ thresholds, onCreateTicket, hasTicketForRecord }: PreviewTableProps) {
  return (
    <section className="preview-panel panel">
      <div className="section-heading">
        <div>
          <p>实时判定预览</p>
          <h2>异常标记预览</h2>
        </div>
        <div className="preview-legend">
          <span className="legend-ok">● 正常</span>
          <span className="legend-watch">● 关注</span>
          <span className="legend-danger">● 异常</span>
        </div>
      </div>

      <div className="preview-table-wrap">
        <table className="preview-table">
          <thead>
            <tr>
              <th>房间编号</th>
              <th>洁净等级</th>
              <th>0.5μm粒子</th>
              <th>5.0μm粒子</th>
              <th>压差(Pa)</th>
              <th>温度(°C)</th>
              <th>湿度(%)</th>
              <th>判定</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {sampleRecords.map((record) => {
              const anomalies = checkAnomalies(record, thresholds);
              const status = getRecordStatus(anomalies);
              const anomalyTypes = getAnomalyTypes(anomalies);
              const th = thresholds.find((t) => t.area === record.area);
              return (
                <tr key={record.id}>
                  <td className="preview-room">{record.roomId}</td>
                  <td>{record.area}</td>
                  <td className={anomalies.particle ? "anomaly-cell" : ""}>
                    {record.particle05um.toLocaleString()}
                    {anomalies.particle && <sup>!</sup>}
                  </td>
                  <td className={anomalies.particle ? "anomaly-cell" : ""}>
                    {record.particle5um.toLocaleString()}
                  </td>
                  <td className={anomalies.pressure ? "anomaly-cell" : ""}>
                    {record.pressure}
                    {anomalies.pressure && <sup>!</sup>}
                  </td>
                  <td className={anomalies.temp ? "anomaly-cell" : ""}>
                    {record.temperature}
                    {anomalies.temp && <sup>!</sup>}
                  </td>
                  <td className={anomalies.humidity ? "anomaly-cell" : ""}>
                    {record.humidity}
                    {anomalies.humidity && <sup>!</sup>}
                  </td>
                  <td>
                    <span className={`record-status ${status.cls}`}>{status.label}</span>
                  </td>
                  <td>
                    {anomalyTypes.length > 0 ? (
                      <div className="ticket-create-actions">
                        {anomalyTypes.map((type) => {
                          const hasTicket = hasTicketForRecord(record.id, type);
                          return (
                            <button
                              key={type}
                              className={`ticket-create-btn ${hasTicket ? "disabled" : ""}`}
                              disabled={hasTicket}
                              onClick={async () => {
                                if (!hasTicket) {
                                  const remark = buildTicketRemark(record, type, thresholds);
                                  await onCreateTicket(
                                    { ...record },
                                    type,
                                  );
                                }
                              }}
                              title={hasTicket ? "已有对应工单" : `创建${type}工单`}
                            >
                              {hasTicket ? "已创建" : `+ ${type}`}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="no-action-hint">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
