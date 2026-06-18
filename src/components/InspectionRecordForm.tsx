import { useState, useMemo } from "react";
import type {
  AreaThreshold,
  CleanArea,
  DeviceStatus,
  InspectionRecord,
  RecordStatus,
  AnomalyType,
  InspectionRecordInput,
} from "../domain";
import {
  CLEAN_AREAS,
  DEVICE_STATUSES,
  checkAnomalies,
  getRecordStatus,
  validateInspectionInput,
  buildInspectionRecord,
  formatNow,
} from "../domain";

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

interface InspectionRecordFormProps {
  thresholds: AreaThreshold[];
  onSubmit: (record: InspectionRecord) => void;
  existingRoomIds: string[];
}

const project = {
  domain: "洁净室巡检",
};

export default function InspectionRecordForm({ thresholds, onSubmit, existingRoomIds }: InspectionRecordFormProps) {
  const [form, setForm] = useState({
    roomId: "",
    area: CLEAN_AREAS[0] as CleanArea,
    particle05um: "",
    particle5um: "",
    pressure: "",
    temperature: "",
    humidity: "",
    deviceStatus: DEVICE_STATUSES[0] as DeviceStatus,
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
    const input: InspectionRecordInput = {
      roomId: form.roomId,
      area: form.area,
      particle05um: parseFloat(form.particle05um),
      particle5um: parseFloat(form.particle5um),
      pressure: parseFloat(form.pressure),
      temperature: parseFloat(form.temperature),
      humidity: parseFloat(form.humidity),
      deviceStatus: form.deviceStatus,
      remark: form.remark,
    };

    const validationErrors = validateInspectionInput(input, existingRoomIds);

    if (!form.particle05um.trim()) {
      validationErrors.particle05um = "粒子计数不能为空";
    }
    if (!form.particle5um.trim()) {
      validationErrors.particle5um = "粒子计数不能为空";
    }
    if (!form.pressure.trim()) {
      validationErrors.pressure = "压差值不能为空";
    }
    if (!form.temperature.trim()) {
      validationErrors.temperature = "温度不能为空";
    }
    if (!form.humidity.trim()) {
      validationErrors.humidity = "湿度不能为空";
    }

    setErrors(validationErrors as Record<string, string>);
    return Object.keys(validationErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    const input: InspectionRecordInput = {
      roomId: form.roomId.trim(),
      area: form.area,
      particle05um: parseFloat(form.particle05um),
      particle5um: parseFloat(form.particle5um),
      pressure: parseFloat(form.pressure),
      temperature: parseFloat(form.temperature),
      humidity: parseFloat(form.humidity),
      deviceStatus: form.deviceStatus,
      remark: form.remark.trim(),
    };

    const newRecord = buildInspectionRecord(input, thresholds);

    onSubmit(newRecord);

    setForm({
      roomId: "",
      area: CLEAN_AREAS[0],
      particle05um: "",
      particle5um: "",
      pressure: "",
      temperature: "",
      humidity: "",
      deviceStatus: DEVICE_STATUSES[0],
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
            {CLEAN_AREAS.map((a) => (
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
            {DEVICE_STATUSES.map((s) => (
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
