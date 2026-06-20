# hxwl-09 半导体洁净室巡检

洁净等级阈值、粒子计数与异常处理看板

## 技术栈

React + Vite + TypeScript + CSS

## 本地运行

```bash
npm install
npm run dev
```

开发端口：5109

## 质量检查流程

日常开发和交付前可使用以下命令进行质量校验，所有命令均在本地直接运行：

| 命令 | 说明 | 适用场景 |
|------|------|----------|
| `npm run typecheck` | TypeScript 类型检查（无输出产物） | 日常编码快速校验类型正确性 |
| `npm run test` | 运行全部单元测试（单次） | 验证核心业务逻辑 |
| `npm run test:watch` | 监听模式运行测试 | TDD / 开发时持续反馈 |
| `npm run build:check` | 类型检查 + 生产构建 | 交付前校验可构建性 |
| `npm run quality` | 类型检查 + 全部测试 + 生产构建 | **交付前完整质量门禁** |

> 建议在提交代码或交付前执行 `npm run quality`，确保类型、测试、构建三项全部通过。

## 测试覆盖范围

当前测试套件共 **144 个用例**，聚焦三大高风险模块：

### 1. 领域规则（domain/rules.test.ts，48 个用例）
- 粒子/压差/温湿度异常判定
- 巡检记录状态分级（稳定/关注/异常）
- 工单备注自动生成
- 巡检输入字段校验
- 阈值调整影响面预估（稳定→关注、关注→稳定等状态跃迁）
- CSV 导出（字段转义、行数校验）
- 工单状态流转（下一个/上一个状态）

### 2. 趋势计算（services/TrendAnalysisService.test.ts，32 个用例）
- 按洁净区域（ISO 5/6/7、黄光区）筛选
- 粒子异常、压差异常、温湿度偏移计数
- 待处理工单单独统计（排除已关闭）
- 空数据 hasData 判定
- 环比趋势（上升/下降/稳定及 changePercent 计算）
- 多类型独立聚合

### 3. 数据迁移（services/MigrationService.test.ts，43 个用例）
- 各实体数据回填（阈值、巡检记录、异常工单、巡检计划、异常追踪、筛选条件）
- 缺失字段默认值补齐
- version / updatedAt 自动生成
- 备份数据校验（完整性、版本兼容警告、缺失字段错误）

### 4. 同步队列（services/SyncService.test.ts，21 个用例）
- 版本号递增 bumpSyncVersion
- 同步指纹构建 buildSyncFingerprint（各实体类型字段覆盖、排序、指纹稳定性）
- 入队去重（相同指纹复用）
- 同实体内容变化时刷新指纹并重置为 pending
- 队列状态统计（pending/syncing/failed/synced/conflict）
- 离线拦截（不处理队列直接返回错误）
- 按 ID 集合标记已同步

## 初始功能

- 领域指标看板
- 角色和分类筛选
- 专业字段录入区
- 示例记录列表
- 可继续扩展 IndexedDB、权限、后端 API 和复杂图表
