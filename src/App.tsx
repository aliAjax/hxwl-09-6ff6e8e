import { useState, useMemo } from "react";
import "./styles.css";
import AnomalyTrendAnalysis from "./AnomalyTrendAnalysis";

type PlanStatus = "未开始" | "进行中" | "已完成";
type CleanArea = "ISO 5" | "ISO 6" | "ISO 7" | "黄光区";
type TicketStatus = "待处理" | "处理中" | "已关闭";
type TicketAnomalyType = "粒子异常" | "压差异常" | "温湿度偏移";
type DeviceStatus = "运行中" | "待机" | "故障";
type RecordStatus = "稳定" | "关注" | "异常";

interface InspectionPlan {
  id: number;
  date: string;
  area: string;
  role: string;
  inspector: string;
  status: PlanStatus;
}

interface ThresholdRange {
  min: number;
  max: number;
}

interface AreaThreshold {
  area: CleanArea;
  particle05um: number;
  particle5um: number;
  pressure: ThresholdRange;
  temperature: ThresholdRange;
  humidity: ThresholdRange;
}

interface SampleRecord {
  id: number;
  roomId: string;
  area: CleanArea;
  particle05um: number;
  particle5um: number;
  pressure: number;
  temperature: number;
  humidity: number;
}

interface InspectionRecord {
  id: number;
  roomId: string;
  area: CleanArea;
  particle05um: number;
  particle5um: number;
  pressure: number;
  temperature: number;
  humidity: number;
  deviceStatus: DeviceStatus;
  remark: string;
  createdAt: string;
  status: RecordStatus;
}

interface AnomalyTicket {
  id: number;
  roomId: string;
  area: CleanArea;
  anomalyType: TicketAnomalyType;
  assignee: string;
  status: TicketStatus;
  remark: string;
  createdAt: string;
  sourceRecordId?: number;
}

const defaultThresholds: AreaThreshold[] = [
  {
    area: "ISO 5",
    particle05um: 3520,
    particle5um: 29,
    pressure: { min: 12, max: 20 },
    temperature: { min: 20, max: 24 },
    humidity: { min: 40, max: 50 },
  },
  {
    area: "ISO 6",
    particle05um: 35200,
    particle5um: 293,
    pressure: { min: 10, max: 18 },
    temperature: { min: 20, max: 25 },
    humidity: { min: 35, max: 55 },
  },
  {
    area: "ISO 7",
    particle05um: 352000,
    particle5um: 2930,
    pressure: { min: 8, max: 15 },
    temperature: { min: 18, max: 26 },
    humidity: { min: 30, max: 60 },
  },
  {
    area: "黄光区",
    particle05um: 35200,
    particle5um: 293,
    pressure: { min: 10, max: 18 },
    temperature: { min: 21, max: 25 },
    humidity: { min: 40, max: 55 },
  },
];

const sampleRecords: SampleRecord[] = [
  { id: 1, roomId: "CR-1201", area: "ISO 5", particle05um: 4200, particle5um: 35, pressure: 15, temperature: 22, humidity: 45 },
  { id: 2, roomId: "CR-2107", area: "ISO 6", particle05um: 28000, particle5um: 200, pressure: 15, temperature: 22, humidity: 48 },
  { id: 3, roomId: "Y-0302", area: "黄光区", particle05um: 30000, particle5um: 250, pressure: 12, temperature: 23, humidity: 54 },
  { id: 4, roomId: "CR-3305", area: "ISO 7", particle05um: 380000, particle5um: 3100, pressure: 7, temperature: 27, humidity: 62 },
  { id: 5, roomId: "CR-1108", area: "ISO 5", particle05um: 2800, particle5um: 20, pressure: 14, temperature: 21, humidity: 42 },
];

const initialPlans: InspectionPlan[] = [
  { id: 1, date: "2026-06-18", area: "ISO 5", role: "巡检员", inspector: "张伟", status: "进行中" },
  { id: 2, date: "2026-06-18", area: "ISO 6", role: "厂务工程师", inspector: "李娜", status: "未开始" },
  { id: 3, date: "2026-06-18", area: "黄光区", role: "班组长", inspector: "王强", status: "已完成" },
  { id: 4, date: "2026-06-18", area: "ISO 7", role: "巡检员", inspector: "赵敏", status: "未开始" },
  { id: 5, date: "2026-06-18", area: "ISO 5", role: "厂务工程师", inspector: "陈磊", status: "已完成" },
];

const initialTickets: AnomalyTicket[] = [
  { id: 1, roomId: "CR-1201", area: "ISO 5", anomalyType: "粒子异常", assignee: "张伟", status: "待处理", remark: "0.5μm和5.0μm粒子均超限", createdAt: "2026-06-18 09:30", sourceRecordId: 1 },
  { id: 2, roomId: "CR-3305", area: "ISO 7", anomalyType: "压差异常", assignee: "李娜", status: "处理中", remark: "压差低于下限，正在排查阀门", createdAt: "2026-06-18 10:15", sourceRecordId: 4 },
  { id: 3, roomId: "CR-3305", area: "ISO 7", anomalyType: "温湿度偏移", assignee: "王强", status: "已关闭", remark: "空调系统已修复，温湿度恢复正常", createdAt: "2026-06-17 14:20", sourceRecordId: 4 },
];

const ticketStatusFilters: ("全部" | TicketStatus)[] = ["全部", "待处理", "处理中", "已关闭"];

const ticketAssignees = ["张伟", "李娜", "王强", "赵敏", "陈磊"];

const ticketStatusTagClass: Record<TicketStatus, string> = {
  "待处理": "ticket-tag-pending",
  "处理中": "ticket-tag-active",
  "已关闭": "ticket-tag-closed",
};

const ticketAnomalyTypeClass: Record<TicketAnomalyType, string> = {
  "粒子异常": "ticket-type-particle",
  "压差异常": "ticket-type-pressure",
  "温湿度偏移": "ticket-type-temphum",
};

const statusFilters: ("全部" | PlanStatus)[] = ["全部", "未开始", "进行中", "已完成"];

const planAreas: CleanArea[] = ["ISO 5", "ISO 6", "ISO 7", "黄光区"];
const planRoles = ["巡检员", "厂务工程师", "班组长"];
const deviceStatuses: DeviceStatus[] = ["运行中", "待机", "故障"];

const statusTagClass: Record<PlanStatus, string> = {
  "未开始": "plan-tag-pending",
  "进行中": "plan-tag-active",
  "已完成": "plan-tag-done",
};

type AnomalyType = "particle" | "pressure" | "temp" | "humidity" | "none";

function checkAnomalies(record: SampleRecord, thresholds: AreaThreshold[]): Record<AnomalyType, boolean> {
  const th = thresholds.find((t) => t.area === record.area);
  if (!th) return { particle: false, pressure: false, temp: false, humidity: false, none: true };
  const particleBad = record.particle05um > th.particle05um || record.particle5um > th.particle5um;
  const pressureBad = record.pressure < th.pressure.min || record.pressure > th.pressure.max;
  const tempBad = record.temperature < th.temperature.min || record.temperature > th.temperature.max;
  const humidityBad = record.humidity < th.humidity.min || record.humidity > th.humidity.max;
  return {
    particle: particleBad,
    pressure: pressureBad,
    temp: tempBad,
    humidity: humidityBad,
    none: !particleBad && !pressureBad && !tempBad && !humidityBad,
  };
}

function getRecordStatus(anomalies: Record<AnomalyType, boolean>): { label: RecordStatus; cls: string } {
  const count = ["particle", "pressure", "temp", "humidity"].filter((k) => anomalies[k as AnomalyType]).length;
  if (count === 0) return { label: "稳定", cls: "record-status-ok" };
  if (count === 1) return { label: "关注", cls: "record-status-watch" };
  return { label: "异常", cls: "record-status-danger" };
}

const project = {
  "id": "hxwl-09",
  "port": 5109,
  "title": "半导体洁净室巡检",
  "subtitle": "洁净等级阈值、粒子计数与异常处理看板",
  "stack": "React + Vite + TypeScript + CSS",
  "theme": [
    "#0f766e",
    "#2563eb",
    "#e11d48"
  ],
  "domain": "洁净室巡检",
  "users": [
    "巡检员",
    "厂务工程师",
    "班组长"
  ],
  "metrics": [
    "粒子异常",
    "压差异常",
    "温湿度偏移",
    "待处理"
  ],
  "filters": [
    "ISO 5",
    "ISO 6",
    "ISO 7",
    "黄光区"
  ],
  "fields": [
    "房间编号",
    "洁净等级",
    "粒子计数",
    "温湿度",
    "压差",
    "设备状态",
    "处理备注"
  ],
  "records": [
    [
      "CR-1201",
      "ISO 5",
      "异常",
      "0.5um粒子超限，已通知厂务"
    ],
    [
      "CR-2107",
      "ISO 6",
      "稳定",
      "压差15Pa，温湿度正常"
    ],
    [
      "Y-0302",
      "黄光区",
      "关注",
      "湿度接近上限"
    ]
  ]
};

const statusColors = ["status-ok", "status-watch", "status-danger"];

function MetricCard({ label, value, index }: { label: string; value: string; index: number }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <i className={statusColors[index % statusColors.length]} />
    </article>
  );
}

interface ThresholdConfigProps {
  thresholds: AreaThreshold[];
  onUpdate: (thresholds: AreaThreshold[]) => void;
}

function ThresholdConfig({ thresholds, onUpdate }: ThresholdConfigProps) {
  const [editingArea, setEditingArea] = useState<CleanArea | null>(null);
  const [draft, setDraft] = useState<AreaThreshold | null>(null);

  const startEdit = (area: CleanArea) => {
    const current = thresholds.find((t) => t.area === area);
    if (current) {
      setDraft(JSON.parse(JSON.stringify(current)));
      setEditingArea(area);
    }
  };

  const cancelEdit = () => {
    setEditingArea(null);
    setDraft(null);
  };

  const saveEdit = () => {
    if (!draft) return;
    onUpdate(thresholds.map((t) => (t.area === draft.area ? draft : t)));
    setEditingArea(null);
    setDraft(null);
  };

  const updateDraftField = (field: keyof AreaThreshold, value: number | ThresholdRange, subKey?: "min" | "max") => {
    if (!draft) return;
    if (subKey && typeof value === "number") {
      setDraft({
        ...draft,
        [field]: {
          ...(draft[field] as ThresholdRange),
          [subKey]: value,
        },
      });
    } else {
      setDraft({ ...draft, [field]: value });
    }
  };

  return (
    <section className="threshold-panel panel">
      <div className="section-heading">
        <div>
          <p>厂务工程师配置</p>
          <h2>洁净等级阈值配置</h2>
        </div>
        <div className="threshold-hint">修改阈值后将实时影响下方示例判断结果</div>
      </div>

      <div className="threshold-table-wrap">
        <table className="threshold-table">
          <thead>
            <tr>
              <th rowSpan={2}>洁净区域</th>
              <th colSpan={2}>粒子计数上限 (个/m³)</th>
              <th colSpan={2}>压差 (Pa)</th>
              <th colSpan={2}>温度 (°C)</th>
              <th colSpan={2}>湿度 (%)</th>
              <th rowSpan={2}>操作</th>
            </tr>
            <tr>
              <th>0.5μm</th>
              <th>5.0μm</th>
              <th>最小</th>
              <th>最大</th>
              <th>最小</th>
              <th>最大</th>
              <th>最小</th>
              <th>最大</th>
            </tr>
          </thead>
          <tbody>
            {thresholds.map((t) => (
              <tr key={t.area}>
                <td className="threshold-area">{t.area}</td>
                <td>{t.particle05um.toLocaleString()}</td>
                <td>{t.particle5um.toLocaleString()}</td>
                <td>{t.pressure.min}</td>
                <td>{t.pressure.max}</td>
                <td>{t.temperature.min}</td>
                <td>{t.temperature.max}</td>
                <td>{t.humidity.min}</td>
                <td>{t.humidity.max}</td>
                <td>
                  <button className="threshold-edit-btn" onClick={() => startEdit(t.area)}>
                    编辑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingArea && draft && (
        <div className="threshold-edit-overlay" onClick={cancelEdit}>
          <div className="threshold-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="section-heading">
              <div>
                <p>编辑阈值</p>
                <h2>{draft.area}</h2>
              </div>
            </div>

            <div className="threshold-edit-grid">
              <div className="threshold-edit-group">
                <h4>粒子计数上限</h4>
                <label>
                  <span>0.5μm (个/m³)</span>
                  <input
                    type="number"
                    value={draft.particle05um}
                    onChange={(e) => updateDraftField("particle05um", Number(e.target.value))}
                  />
                </label>
                <label>
                  <span>5.0μm (个/m³)</span>
                  <input
                    type="number"
                    value={draft.particle5um}
                    onChange={(e) => updateDraftField("particle5um", Number(e.target.value))}
                  />
                </label>
              </div>

              <div className="threshold-edit-group">
                <h4>压差范围 (Pa)</h4>
                <label>
                  <span>最小值</span>
                  <input
                    type="number"
                    value={draft.pressure.min}
                    onChange={(e) => updateDraftField("pressure", Number(e.target.value), "min")}
                  />
                </label>
                <label>
                  <span>最大值</span>
                  <input
                    type="number"
                    value={draft.pressure.max}
                    onChange={(e) => updateDraftField("pressure", Number(e.target.value), "max")}
                  />
                </label>
              </div>

              <div className="threshold-edit-group">
                <h4>温度范围 (°C)</h4>
                <label>
                  <span>最小值</span>
                  <input
                    type="number"
                    value={draft.temperature.min}
                    onChange={(e) => updateDraftField("temperature", Number(e.target.value), "min")}
                  />
                </label>
                <label>
                  <span>最大值</span>
                  <input
                    type="number"
                    value={draft.temperature.max}
                    onChange={(e) => updateDraftField("temperature", Number(e.target.value), "max")}
                  />
                </label>
              </div>

              <div className="threshold-edit-group">
                <h4>湿度范围 (%)</h4>
                <label>
                  <span>最小值</span>
                  <input
                    type="number"
                    value={draft.humidity.min}
                    onChange={(e) => updateDraftField("humidity", Number(e.target.value), "min")}
                  />
                </label>
                <label>
                  <span>最大值</span>
                  <input
                    type="number"
                    value={draft.humidity.max}
                    onChange={(e) => updateDraftField("humidity", Number(e.target.value), "max")}
                  />
                </label>
              </div>
            </div>

            <div className="threshold-edit-actions">
              <button onClick={cancelEdit}>取消</button>
              <button className="primary-action" onClick={saveEdit}>
                保存配置
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

interface PreviewTableProps {
  thresholds: AreaThreshold[];
  onCreateTicket: (record: SampleRecord, anomalyType: TicketAnomalyType) => void;
  hasTicketForRecord: (recordId: number, anomalyType: TicketAnomalyType) => boolean;
}

function PreviewTable({ thresholds, onCreateTicket, hasTicketForRecord }: PreviewTableProps) {
  const getAnomalyTypes = (anomalies: Record<AnomalyType, boolean>): TicketAnomalyType[] => {
    const types: TicketAnomalyType[] = [];
    if (anomalies.particle) types.push("粒子异常");
    if (anomalies.pressure) types.push("压差异常");
    if (anomalies.temp || anomalies.humidity) types.push("温湿度偏移");
    return types;
  };

  const getRemarkForType = (record: SampleRecord, anomalyType: TicketAnomalyType, th: AreaThreshold | undefined): string => {
    if (!th) return "";
    switch (anomalyType) {
      case "粒子异常":
        const p05 = record.particle05um > th.particle05um ? `0.5μm(${record.particle05um.toLocaleString()})` : "";
        const p5 = record.particle5um > th.particle5um ? `5.0μm(${record.particle5um.toLocaleString()})` : "";
        return `粒子计数超限：${[p05, p5].filter(Boolean).join("、")}`;
      case "压差异常":
        return `压差${record.pressure < th.pressure.min ? "低于下限" : "高于上限"}：${record.pressure}Pa（范围${th.pressure.min}-${th.pressure.max}Pa）`;
      case "温湿度偏移":
        const t = record.temperature < th.temperature.min ? "温度偏低" : record.temperature > th.temperature.max ? "温度偏高" : "";
        const h = record.humidity < th.humidity.min ? "湿度偏低" : record.humidity > th.humidity.max ? "湿度偏高" : "";
        return `温湿度偏移：${[t, h].filter(Boolean).join("、")}`;
      default:
        return "";
    }
  };

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
                              onClick={() => {
                                if (!hasTicket) {
                                  const remark = getRemarkForType(record, type, th);
                                  onCreateTicket(
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

interface InspectionRecordFormProps {
  thresholds: AreaThreshold[];
  onSubmit: (record: InspectionRecord) => void;
  existingRoomIds: string[];
}

function InspectionRecordForm({ thresholds, onSubmit, existingRoomIds }: InspectionRecordFormProps) {
  const [form, setForm] = useState({
    roomId: "",
    area: planAreas[0] as CleanArea,
    particle05um: "",
    particle5um: "",
    pressure: "",
    temperature: "",
    humidity: "",
    deviceStatus: deviceStatuses[0] as DeviceStatus,
    remark: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccess, setShowSuccess] = useState(false);

  const previewRecord = useMemo(() => {
    const p05 = parseFloat(form.particle05um);
    const p5 = parseFloat(form.particle5um);
    const press = parseFloat(form.pressure);
    const temp = parseFloat(form.temperature);
    const hum = parseFloat(form.humidity);

    if (
      isNaN(p05) || isNaN(p5) || isNaN(press) || isNaN(temp) || isNaN(hum) ||
      p05 < 0 || p5 < 0 || press < 0 || temp < 0 || hum < 0
    ) {
      return null;
    }

    const record: SampleRecord = {
      id: 0,
      roomId: form.roomId,
      area: form.area,
      particle05um: p05,
      particle5um: p5,
      pressure: press,
      temperature: temp,
      humidity: hum,
    };

    const anomalies = checkAnomalies(record, thresholds);
    const status = getRecordStatus(anomalies);
    return { record, anomalies, status };
  }, [form, thresholds]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.roomId.trim()) {
      newErrors.roomId = "房间编号不能为空";
    } else if (existingRoomIds.includes(form.roomId.trim())) {
      newErrors.roomId = "该房间编号已存在巡检记录";
    }

    if (!form.particle05um.trim()) {
      newErrors.particle05um = "粒子计数不能为空";
    } else if (isNaN(parseFloat(form.particle05um)) || parseFloat(form.particle05um) < 0) {
      newErrors.particle05um = "请输入有效的非负数";
    }

    if (!form.particle5um.trim()) {
      newErrors.particle5um = "粒子计数不能为空";
    } else if (isNaN(parseFloat(form.particle5um)) || parseFloat(form.particle5um) < 0) {
      newErrors.particle5um = "请输入有效的非负数";
    }

    if (!form.pressure.trim()) {
      newErrors.pressure = "压差值不能为空";
    } else if (isNaN(parseFloat(form.pressure))) {
      newErrors.pressure = "请输入有效的数值";
    }

    if (!form.temperature.trim()) {
      newErrors.temperature = "温度不能为空";
    } else if (isNaN(parseFloat(form.temperature))) {
      newErrors.temperature = "请输入有效的数值";
    }

    if (!form.humidity.trim()) {
      newErrors.humidity = "湿度不能为空";
    } else if (isNaN(parseFloat(form.humidity)) || parseFloat(form.humidity) < 0 || parseFloat(form.humidity) > 100) {
      newErrors.humidity = "请输入0-100之间的有效数值";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const anomalies = checkAnomalies(
      {
        id: 0,
        roomId: form.roomId.trim(),
        area: form.area,
        particle05um: parseFloat(form.particle05um),
        particle5um: parseFloat(form.particle5um),
        pressure: parseFloat(form.pressure),
        temperature: parseFloat(form.temperature),
        humidity: parseFloat(form.humidity),
      },
      thresholds
    );
    const status = getRecordStatus(anomalies);

    const newRecord: InspectionRecord = {
      id: Date.now(),
      roomId: form.roomId.trim(),
      area: form.area,
      particle05um: parseFloat(form.particle05um),
      particle5um: parseFloat(form.particle5um),
      pressure: parseFloat(form.pressure),
      temperature: parseFloat(form.temperature),
      humidity: parseFloat(form.humidity),
      deviceStatus: form.deviceStatus,
      remark: form.remark.trim(),
      createdAt: dateStr,
      status: status.label,
    };

    onSubmit(newRecord);

    setForm({
      roomId: "",
      area: planAreas[0],
      particle05um: "",
      particle5um: "",
      pressure: "",
      temperature: "",
      humidity: "",
      deviceStatus: deviceStatuses[0],
      remark: "",
    });
    setErrors({});
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2500);
  };

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  return (
    <section className="record-form-panel panel">
      <div className="section-heading">
        <div>
          <p>{project.domain}</p>
          <h2>巡检记录录入</h2>
        </div>
        {showSuccess && <span className="success-toast">✓ 提交成功</span>}
      </div>

      <div className="record-form-grid">
        <label className={errors.roomId ? "has-error" : ""}>
          <span>房间编号</span>
          <input
            placeholder="例如 CR-1201"
            value={form.roomId}
            onChange={(e) => updateField("roomId", e.target.value)}
          />
          {errors.roomId && <em className="error-text">{errors.roomId}</em>}
        </label>

        <label>
          <span>洁净等级</span>
          <select
            value={form.area}
            onChange={(e) => updateField("area", e.target.value)}
          >
            {planAreas.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>

        <label className={errors.particle05um ? "has-error" : ""}>
          <span>0.5μm粒子计数 (个/m³)</span>
          <input
            type="number"
            min="0"
            placeholder="填写0.5μm粒子数"
            value={form.particle05um}
            onChange={(e) => updateField("particle05um", e.target.value)}
          />
          {errors.particle05um && <em className="error-text">{errors.particle05um}</em>}
        </label>

        <label className={errors.particle5um ? "has-error" : ""}>
          <span>5.0μm粒子计数 (个/m³)</span>
          <input
            type="number"
            min="0"
            placeholder="填写5.0μm粒子数"
            value={form.particle5um}
            onChange={(e) => updateField("particle5um", e.target.value)}
          />
          {errors.particle5um && <em className="error-text">{errors.particle5um}</em>}
        </label>

        <label className={errors.pressure ? "has-error" : ""}>
          <span>压差 (Pa)</span>
          <input
            type="number"
            placeholder="填写压差值"
            value={form.pressure}
            onChange={(e) => updateField("pressure", e.target.value)}
          />
          {errors.pressure && <em className="error-text">{errors.pressure}</em>}
        </label>

        <label className={errors.temperature ? "has-error" : ""}>
          <span>温度 (°C)</span>
          <input
            type="number"
            step="0.1"
            placeholder="填写温度值"
            value={form.temperature}
            onChange={(e) => updateField("temperature", e.target.value)}
          />
          {errors.temperature && <em className="error-text">{errors.temperature}</em>}
        </label>

        <label className={errors.humidity ? "has-error" : ""}>
          <span>湿度 (%)</span>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            placeholder="填写湿度值"
            value={form.humidity}
            onChange={(e) => updateField("humidity", e.target.value)}
          />
          {errors.humidity && <em className="error-text">{errors.humidity}</em>}
        </label>

        <label>
          <span>设备状态</span>
          <select
            value={form.deviceStatus}
            onChange={(e) => updateField("deviceStatus", e.target.value)}
          >
            {deviceStatuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <label className="record-form-remark">
          <span>处理备注</span>
          <textarea
            placeholder="填写处理说明或备注信息"
            value={form.remark}
            onChange={(e) => updateField("remark", e.target.value)}
          />
        </label>
      </div>

      {previewRecord && (
        <div className="record-preview">
          <div className="record-preview-title">
            <span>实时判定预览</span>
            <span className={`record-status ${previewRecord.status.cls}`}>
              {previewRecord.status.label}
            </span>
          </div>
          <div className="record-preview-items">
            <div className={`preview-item ${previewRecord.anomalies.particle ? "anomaly" : ""}`}>
              <span>粒子计数</span>
              <strong>{previewRecord.record.particle05um.toLocaleString()} / {previewRecord.record.particle5um.toLocaleString()}</strong>
            </div>
            <div className={`preview-item ${previewRecord.anomalies.pressure ? "anomaly" : ""}`}>
              <span>压差</span>
              <strong>{previewRecord.record.pressure} Pa</strong>
            </div>
            <div className={`preview-item ${previewRecord.anomalies.temp ? "anomaly" : ""}`}>
              <span>温度</span>
              <strong>{previewRecord.record.temperature}°C</strong>
            </div>
            <div className={`preview-item ${previewRecord.anomalies.humidity ? "anomaly" : ""}`}>
              <span>湿度</span>
              <strong>{previewRecord.record.humidity}%</strong>
            </div>
          </div>
        </div>
      )}

      <div className="record-form-actions">
        <button className="primary-action" onClick={handleSubmit}>
          提交巡检记录
        </button>
      </div>
    </section>
  );
}

function InspectionSchedule() {
  const [plans, setPlans] = useState<InspectionPlan[]>(initialPlans);
  const [activeFilter, setActiveFilter] = useState<"全部" | PlanStatus>("全部");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: "2026-06-18", area: planAreas[0], role: planRoles[0], inspector: "" });

  const filtered = activeFilter === "全部" ? plans : plans.filter((p) => p.status === activeFilter);

  const counts = {
    "未开始": plans.filter((p) => p.status === "未开始").length,
    "进行中": plans.filter((p) => p.status === "进行中").length,
    "已完成": plans.filter((p) => p.status === "已完成").length,
  };

  const handleAdd = () => {
    if (!form.inspector.trim()) return;
    const next: InspectionPlan = {
      id: Date.now(),
      date: form.date,
      area: form.area,
      role: form.role,
      inspector: form.inspector.trim(),
      status: "未开始",
    };
    setPlans((prev) => [...prev, next]);
    setForm((prev) => ({ ...prev, inspector: "" }));
    setShowForm(false);
  };

  return (
    <section className="plan-section panel">
      <div className="section-heading">
        <div>
          <p>今日排班</p>
          <h2>巡检计划排班</h2>
        </div>
        <button className="primary-action" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "收起表单" : "新增计划"}
        </button>
      </div>

      <div className="plan-stats">
        {(Object.entries(counts) as [PlanStatus, number][]).map(([label, count]) => (
          <div key={label} className={`plan-stat ${statusTagClass[label]}`}>
            <strong>{count}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="chips muted" style={{ marginBottom: 18 }}>
        {statusFilters.map((f) => (
          <button key={f} className={activeFilter === f ? "chip-active" : ""} onClick={() => setActiveFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="plan-form">
          <label>
            <span>日期</span>
            <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
          </label>
          <label>
            <span>区域</span>
            <select value={form.area} onChange={(e) => setForm((p) => ({ ...p, area: e.target.value as CleanArea }))}>
              {planAreas.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label>
            <span>角色</span>
            <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
              {planRoles.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label>
            <span>巡检员</span>
            <input placeholder="填写巡检员姓名" value={form.inspector} onChange={(e) => setForm((p) => ({ ...p, inspector: e.target.value }))} />
          </label>
          <button className="primary-action" style={{ alignSelf: "end" }} onClick={handleAdd}>
            确认新增
          </button>
        </div>
      )}

      <div className="record-list">
        {filtered.map((plan) => (
          <article key={plan.id} className="record-card plan-card">
            <div className="record-index">{plan.area}</div>
            <div className="plan-card-body">
              <div className="plan-card-top">
                <h3>{plan.inspector}</h3>
                <span className={`plan-tag ${statusTagClass[plan.status]}`}>{plan.status}</span>
              </div>
              <p>{plan.date} · {plan.role}</p>
            </div>
          </article>
        ))}
        {filtered.length === 0 && <p className="plan-empty">暂无匹配的巡检计划</p>}
      </div>
    </section>
  );
}

interface AnomalyTicketManagementProps {
  tickets: AnomalyTicket[];
  onAddTicket: (ticket: Omit<AnomalyTicket, "id" | "createdAt" | "status">) => void;
  onStatusChange: (ticketId: number, status: TicketStatus) => void;
}

function AnomalyTicketManagement({ tickets, onAddTicket, onStatusChange }: AnomalyTicketManagementProps) {
  const [activeFilter, setActiveFilter] = useState<"全部" | TicketStatus>("全部");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    roomId: "",
    area: planAreas[0] as CleanArea,
    anomalyType: "粒子异常" as TicketAnomalyType,
    assignee: ticketAssignees[0],
    remark: "",
  });

  const filtered = activeFilter === "全部" ? tickets : tickets.filter((t) => t.status === activeFilter);

  const counts = {
    "待处理": tickets.filter((t) => t.status === "待处理").length,
    "处理中": tickets.filter((t) => t.status === "处理中").length,
    "已关闭": tickets.filter((t) => t.status === "已关闭").length,
  };

  const handleAdd = () => {
    if (!form.roomId.trim()) return;
    onAddTicket({
      roomId: form.roomId.trim(),
      area: form.area,
      anomalyType: form.anomalyType,
      assignee: form.assignee,
      remark: form.remark.trim(),
    });
    setForm((prev) => ({ ...prev, roomId: "", remark: "" }));
    setShowForm(false);
  };

  const getNextStatus = (current: TicketStatus): TicketStatus | null => {
    if (current === "待处理") return "处理中";
    if (current === "处理中") return "已关闭";
    return null;
  };

  const getPrevStatus = (current: TicketStatus): TicketStatus | null => {
    if (current === "处理中") return "待处理";
    if (current === "已关闭") return "处理中";
    return null;
  };

  return (
    <section className="ticket-section panel">
      <div className="section-heading">
        <div>
          <p>异常跟踪</p>
          <h2>异常处理工单</h2>
        </div>
        <button className="primary-action" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "收起表单" : "新增工单"}
        </button>
      </div>

      <div className="ticket-stats">
        {(Object.entries(counts) as [TicketStatus, number][]).map(([label, count]) => (
          <div key={label} className={`ticket-stat ${ticketStatusTagClass[label]}`}>
            <strong>{count}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="chips muted" style={{ marginBottom: 18 }}>
        {ticketStatusFilters.map((f) => (
          <button key={f} className={activeFilter === f ? "chip-active" : ""} onClick={() => setActiveFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="ticket-form">
          <label>
            <span>房间编号</span>
            <input placeholder="例如 CR-1201" value={form.roomId} onChange={(e) => setForm((p) => ({ ...p, roomId: e.target.value }))} />
          </label>
          <label>
            <span>洁净等级</span>
            <select value={form.area} onChange={(e) => setForm((p) => ({ ...p, area: e.target.value as CleanArea }))}>
              {planAreas.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label>
            <span>异常类型</span>
            <select value={form.anomalyType} onChange={(e) => setForm((p) => ({ ...p, anomalyType: e.target.value as TicketAnomalyType }))}>
              <option value="粒子异常">粒子异常</option>
              <option value="压差异常">压差异常</option>
              <option value="温湿度偏移">温湿度偏移</option>
            </select>
          </label>
          <label>
            <span>负责人</span>
            <select value={form.assignee} onChange={(e) => setForm((p) => ({ ...p, assignee: e.target.value }))}>
              {ticketAssignees.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label className="ticket-form-remark">
            <span>备注</span>
            <input placeholder="异常描述或处理说明" value={form.remark} onChange={(e) => setForm((p) => ({ ...p, remark: e.target.value }))} />
          </label>
          <button className="primary-action" style={{ alignSelf: "end" }} onClick={handleAdd}>
            确认创建
          </button>
        </div>
      )}

      <div className="ticket-list">
        {filtered.map((ticket) => {
          const nextStatus = getNextStatus(ticket.status);
          const prevStatus = getPrevStatus(ticket.status);
          return (
            <article key={ticket.id} className="ticket-card">
              <div className="ticket-card-header">
                <div className="ticket-room-info">
                  <span className="ticket-room-id">{ticket.roomId}</span>
                  <span className="ticket-area">{ticket.area}</span>
                </div>
                <span className={`ticket-status-tag ${ticketStatusTagClass[ticket.status]}`}>{ticket.status}</span>
              </div>
              <div className="ticket-card-body">
                <div className="ticket-anomaly-type">
                  <span className={`ticket-type-badge ${ticketAnomalyTypeClass[ticket.anomalyType]}`}>{ticket.anomalyType}</span>
                </div>
                <div className="ticket-meta">
                  <div className="ticket-meta-item">
                    <span className="ticket-meta-label">负责人</span>
                    <span className="ticket-meta-value">{ticket.assignee}</span>
                  </div>
                  <div className="ticket-meta-item">
                    <span className="ticket-meta-label">创建时间</span>
                    <span className="ticket-meta-value">{ticket.createdAt}</span>
                  </div>
                </div>
                {ticket.remark && (
                  <div className="ticket-remark">
                    <span className="ticket-meta-label">备注</span>
                    <p>{ticket.remark}</p>
                  </div>
                )}
              </div>
              <div className="ticket-actions">
                {prevStatus && (
                  <button className="ticket-action-btn secondary" onClick={() => onStatusChange(ticket.id, prevStatus)}>
                    回退到{prevStatus}
                  </button>
                )}
                {nextStatus && (
                  <button className="ticket-action-btn primary" onClick={() => onStatusChange(ticket.id, nextStatus)}>
                    标记为{nextStatus}
                  </button>
                )}
              </div>
            </article>
          );
        })}
        {filtered.length === 0 && <p className="ticket-empty">暂无匹配的工单</p>}
      </div>
    </section>
  );
}

function App() {
  const [thresholds, setThresholds] = useState<AreaThreshold[]>(defaultThresholds);
  const [tickets, setTickets] = useState<AnomalyTicket[]>(initialTickets);
  const [inspectionRecords, setInspectionRecords] = useState<InspectionRecord[]>([]);

  const handleAddTicket = (ticketData: Omit<AnomalyTicket, "id" | "createdAt" | "status">) => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const newTicket: AnomalyTicket = {
      id: Date.now(),
      status: "待处理",
      createdAt: dateStr,
      ...ticketData,
    };
    setTickets((prev) => [...prev, newTicket]);
  };

  const handleTicketStatusChange = (ticketId: number, status: TicketStatus) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status } : t))
    );
  };

  const handleCreateTicketFromRecord = (record: SampleRecord, anomalyType: TicketAnomalyType) => {
    const th = thresholds.find((t) => t.area === record.area);
    let remark = "";
    switch (anomalyType) {
      case "粒子异常":
        const p05 = record.particle05um > (th?.particle05um ?? 0) ? `0.5μm(${record.particle05um.toLocaleString()})` : "";
        const p5 = record.particle5um > (th?.particle5um ?? 0) ? `5.0μm(${record.particle5um.toLocaleString()})` : "";
        remark = `粒子计数超限：${[p05, p5].filter(Boolean).join("、")}`;
        break;
      case "压差异常":
        remark = `压差${record.pressure < (th?.pressure.min ?? 0) ? "低于下限" : "高于上限"}：${record.pressure}Pa`;
        break;
      case "温湿度偏移":
        const t = record.temperature < (th?.temperature.min ?? 0) ? "温度偏低" : record.temperature > (th?.temperature.max ?? 0) ? "温度偏高" : "";
        const h = record.humidity < (th?.humidity.min ?? 0) ? "湿度偏低" : record.humidity > (th?.humidity.max ?? 0) ? "湿度偏高" : "";
        remark = `温湿度偏移：${[t, h].filter(Boolean).join("、")}`;
        break;
    }
    handleAddTicket({
      roomId: record.roomId,
      area: record.area,
      anomalyType,
      assignee: ticketAssignees[Math.floor(Math.random() * ticketAssignees.length)],
      remark,
      sourceRecordId: record.id,
    });
  };

  const hasTicketForRecord = (recordId: number, anomalyType: TicketAnomalyType): boolean => {
    return tickets.some((t) => t.sourceRecordId === recordId && t.anomalyType === anomalyType);
  };

  const handleAddInspectionRecord = (record: InspectionRecord) => {
    setInspectionRecords((prev) => [record, ...prev]);
  };

  const existingRoomIds = useMemo(() => {
    return inspectionRecords.map((r) => r.roomId);
  }, [inspectionRecords]);

  const metricValues = useMemo(() => {
    const results = sampleRecords.map((r) => checkAnomalies(r, thresholds));
    const particle = results.filter((r) => r.particle).length;
    const pressure = results.filter((r) => r.pressure).length;
    const temphum = results.filter((r) => r.temp || r.humidity).length;
    const total = sampleRecords.length - results.filter((r) => r.none).length;
    return [String(particle), String(pressure), String(temphum), String(total)];
  }, [thresholds]);

  const dynamicRecords = useMemo(() => {
    return sampleRecords.map((record) => {
      const anomalies = checkAnomalies(record, thresholds);
      const status = getRecordStatus(anomalies);
      const tags: string[] = [];
      if (anomalies.particle) tags.push("0.5μm/5.0μm粒子超限");
      if (anomalies.pressure) tags.push("压差异常");
      if (anomalies.temp) tags.push("温度偏移");
      if (anomalies.humidity) tags.push("湿度偏移");
      const note = tags.length > 0 ? tags.join("，") + "，已通知厂务" : "各项指标均在阈值内";
      return [record.roomId, record.area, status.label, note] as [string, string, string, string];
    });
  }, [thresholds]);

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">{project.id} · port {project.port}</p>
          <h1>{project.title}</h1>
          <p className="subtitle">{project.subtitle}</p>
        </div>
        <div className="stack-card">
          <span>技术栈</span>
          <strong>{project.stack}</strong>
        </div>
      </section>

      <section className="metrics-grid">
        {project.metrics.map((metric: string, index: number) => (
          <MetricCard key={metric} label={metric} value={metricValues[index]} index={index} />
        ))}
      </section>

      <AnomalyTrendAnalysis />

      <ThresholdConfig thresholds={thresholds} onUpdate={setThresholds} />

      <PreviewTable thresholds={thresholds} onCreateTicket={handleCreateTicketFromRecord} hasTicketForRecord={hasTicketForRecord} />

      <section className="workspace">
        <aside className="panel narrow">
          <h2>角色</h2>
          <div className="chips">
            {project.users.map((user: string) => (
              <span key={user}>{user}</span>
            ))}
          </div>
          <h2>筛选</h2>
          <div className="chips muted">
            {project.filters.map((filter: string) => (
              <button key={filter}>{filter}</button>
            ))}
          </div>
        </aside>

        <InspectionRecordForm
          thresholds={thresholds}
          onSubmit={handleAddInspectionRecord}
          existingRoomIds={existingRoomIds}
        />
      </section>

      <InspectionSchedule />

      <AnomalyTicketManagement
        tickets={tickets}
        onAddTicket={handleAddTicket}
        onStatusChange={handleTicketStatusChange}
      />

      <section className="records panel">
        <div className="section-heading">
          <div>
            <p>最新提交的巡检记录</p>
            <h2>近期记录</h2>
          </div>
          <div className="record-count-badge">共 {inspectionRecords.length} 条</div>
        </div>
        <div className="record-list">
          {inspectionRecords.length > 0 ? (
            inspectionRecords.map((record, index) => {
              const statusCls =
                record.status === "稳定" ? "record-status-ok" :
                record.status === "关注" ? "record-status-watch" : "record-status-danger";
              return (
                <article key={record.id} className="record-card inspection-record-card">
                  <div className="record-index">{String(index + 1).padStart(2, "0")}</div>
                  <div className="inspection-record-body">
                    <div className="inspection-record-header">
                      <h3>
                        {record.roomId}
                        <span className={`record-status-inline ${statusCls}`}>{record.status}</span>
                      </h3>
                      <span className="record-area-tag">{record.area}</span>
                    </div>
                    <div className="inspection-record-meta">
                      <span>粒子: {record.particle05um.toLocaleString()} / {record.particle5um.toLocaleString()}</span>
                      <span>压差: {record.pressure}Pa</span>
                      <span>温度: {record.temperature}°C</span>
                      <span>湿度: {record.humidity}%</span>
                    </div>
                    <div className="inspection-record-footer">
                      <span className="record-device-status">设备: {record.deviceStatus}</span>
                      <span className="record-time">{record.createdAt}</span>
                    </div>
                    {record.remark && (
                      <div className="inspection-record-remark">
                        <span>备注:</span> {record.remark}
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
    </main>
  );
}

export default App;
