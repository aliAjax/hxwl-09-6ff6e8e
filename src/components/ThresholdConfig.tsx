import { useState } from "react";
import type { AreaThreshold, CleanArea, ThresholdRange } from "../domain";

const planAreas = ["ISO 5", "ISO 6", "ISO 7", "黄光区"] as const;

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

export default ThresholdConfig;
