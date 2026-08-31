# YES Project Foundation Framework

> 本文档定义 YiStack/YES 在项目启动阶段的 Project Foundation（项目基础设计）框架。
>
> 它不要求在业务开发前把所有基础能力全部实现，但要求在进入 MVP 或业务开发前，先完成关键工程决策、扩展口设计和暂缓项登记。
>
> 本文档属于 YES 的前置设计输入，不单独构成 YES Kernel 新层级；它服务于 Principle / Architecture / Execution / Validation 四层的启动阶段落地。
>
> 说明：为避免与前端 Bootstrap UI 框架混淆，本文档默认使用 `Project Foundation` 作为人类可读术语；历史设计和后续系统状态中若继续出现 `bootstrap`，应理解为同一前置设计阶段的内部别名。

---

## 1. 为什么需要 Project Foundation Framework

很多系统不是失败在 MVP 做不出来，而是失败在：

- 先写业务，再补基础
- 先堆功能，再统一状态和契约
- 先让系统跑起来，再回头补权限、配置、日志、安全、生命周期

这些能力若在业务扩张后再补，成本通常远高于启动阶段先做决策。

因此，YES 在项目启动时不应只回答：

- 要做什么业务
- MVP 先做什么

还必须先回答：

- 哪些工程基础必须现在定
- 哪些能力可以后做但现在必须预留边界
- 哪些能力本轮明确暂缓，但要留下演进登记

## 2. Project Foundation Framework 的定位

Project Foundation Framework 位于以下流程中：

`Idea -> Foundation Design -> Plan -> MVP -> Validation -> Iteration`

其中：

- `Idea`：提出业务目标、问题陈述、目标用户和范围
- `Foundation Design`：完成项目级前置设计判断
- `Plan`：形成实施方案、任务拆分和 MVP 边界
- `MVP`：按已批准方案进入实现
- `Validation`：按 YES 门禁检查实现结果
- `Iteration`：根据反馈进入下一轮

Project Foundation Framework 的目标不是拖慢开发，而是降低未来返工成本。

## 3. Foundation 阶段必须产出的四类结果

任何新项目或重大新域启动前，至少应产出以下四类结果：

1. `Foundation Brief`
   - 项目级关键前置决策摘要
2. `Engineering Policy`
   - 团队和 AI 共用的硬规则
3. `Architecture / Lifecycle Spec`
   - 领域模型、状态机、生命周期、接口契约
4. `Deferred Decisions Register`
   - 明确暂缓项、原因、触发条件和后续入口

没有这四类结果时，可以探索，不应进入大规模业务开发。

## 4. 决策分层模型

Foundation 阶段不要求“所有能力都现在做完”，而要求把问题分成三类：

### 4.1 必须现在定

若现在不定，后续返工成本很高，通常包括：

- 用户体系
- 权限模型
- 国际化策略
- 主题与设计 Token
- 状态机和生命周期
- 接口契约和错误模型
- 配置管理与默认值来源
- 数据库 ID / 时区 / 审计字段
- 日志规范
- 运行时生命周期

### 4.2 必须现在预留扩展口

可以后实现，但架构上现在要留边界，通常包括：

- 多租户
- 插件系统
- Skill Registry / Tool Registry / MCP
- Marketplace
- 事件总线
- 成本中心
- 替换式 Provider / Runtime / Storage
- 灰度发布与 Feature Flag

### 4.3 可以明确暂缓

本轮不做，但必须登记：

- 为什么暂缓
- 什么条件下重新打开
- 后续会影响哪些模块

例如：

- MFA
- ABAC
- 蓝绿发布 / Canary
- 复杂计费系统
- 高级成本治理

## 5. Foundation Checklist 的核心域

以下内容应作为 Foundation 阶段的默认检查域。

### 5.1 Product Foundation

- 用户体系
- 权限体系
- 国际化
- 全局主题
- UI 设计规范

### 5.2 Engineering Foundation

- 项目架构
- 配置管理
- 日志体系
- 错误处理
- 数据库规范

### 5.3 Security Foundation

- 身份认证
- Token / Session / API Key / Secret
- 安全开发规范
- 输入输出校验
- Prompt Injection 防护

### 5.4 Runtime Foundation

- 项目生命周期
- Workspace / Runtime / Preview / Git / 容器 / 存储
- 资源创建、恢复、回收、清理策略

### 5.5 AI Foundation

- Provider / Model / Prompt / Context / Memory / Knowledge
- Workflow / Tool Registry / Skill Registry / MCP
- Token 成本统计
- Prompt 版本
- AI 审计日志

### 5.6 Development Foundation

- Code Style / Formatter / Linter
- Commit / Branch / Review / CI / Build / Release / Version Strategy

### 5.7 Testing Foundation

- Unit / Integration / E2E / Smoke / Regression / Security / Performance

### 5.8 Observability Foundation

- Logging / Metrics / Tracing / Health Check / Alert / Dashboard

### 5.9 Documentation Foundation

- README / Architecture / API / ADR / RFC / Task / Runbook / Deployment Guide

### 5.10 Extensibility Foundation

- Plugin / Hook / Event Bus / Extension Point / Feature Flag / Provider Replaceability

## 6. 容易被忽略但必须提前设计的内容

以下能力经常在中后期才被意识到，但应纳入 Foundation 阶段：

### 6.1 Domain Model

- Entity
- Value Object
- Aggregate
- Domain Service
- 状态定义
- ID 规范

### 6.2 State Machine

适用于：

- 用户
- 项目
- Workspace
- Runtime
- AI Workflow
- Git / 发布 / 任务

必须明确：

- 哪些状态可进入
- 哪些状态可退出
- 哪些跳转非法
- 哪些状态可恢复

### 6.3 Lifecycle

至少覆盖：

- Create
- Initialize
- Running
- Pause
- Resume
- Stop
- Delete
- Recycle
- Destroy

### 6.4 Contract

- REST / WebSocket / Event / RPC
- JSON Schema
- 错误码
- 返回结构
- 分页 / 排序 / 查询规范

### 6.5 Version / Compatibility

- API / Prompt / Workflow / Skill / Plugin / Template / Config / Data Version
- 向后兼容策略
- 升级窗口
- 回滚策略

### 6.6 Recovery

- Runtime / Container / Git / Workspace / Config 恢复
- 自动重试
- 快照恢复
- 回滚策略

### 6.7 Replaceability

- LLM Provider
- Runtime
- Storage
- Git Provider
- MCP Provider
- Skill Provider

### 6.8 Engineering Policy

例如：

- Handler 不允许承载业务逻辑
- Service 不直接暴露 HTTP 语义
- 所有新增状态必须同步更新前后端和文档
- 所有新增配置必须定义默认值和真源

### 6.9 Context / Memory Governance

AI 开发系统若只依赖聊天上下文，容易出现以下问题：

- 多项目并行时上下文串线
- 长线程压缩后丢失关键前置决策
- 历史摘要覆盖真实代码与真实状态
- 用户一句新的临时描述，意外推翻已冻结工程规则

因此，YES 应明确 Context / Memory 的治理规则：

1. **项目隔离优先**
   - 任何项目级上下文、摘要、决策和工件都必须以项目为命名空间隔离
   - 不允许把 A 项目的上下文默认带入 B 项目

2. **真源优先级固定**
   - 结构化状态与已冻结决策
   - 已确认工件与项目级稳定上下文
   - 当前仓库代码 / 配置 / 文档
   - 当前对话上下文
   - 对话压缩摘要

3. **摘要不可推翻真源**
   - 摘要只能用于恢复阅读效率
   - 摘要不能覆盖结构化状态、冻结决策、已确认方案和当前仓库事实

4. **跨项目复用必须显式声明**
   - 只有“可复用的工程规则、团队偏好、模板策略”才允许进入跨项目层
   - 具体项目的业务结论、临时约束和局部实现细节不得自动上升为全局记忆

5. **高成本决策必须结构化沉淀**
   - 用户体系
   - 权限模型
   - 状态机 / 生命周期
   - 契约 / 错误模型
   - Context Policy / Memory Strategy
   - 这类内容不得只留在聊天历史里

6. **上下文冲突必须阻断推进**
   - 若“当前摘要 / 当前对话”与“结构化状态 / 已确认工件 / 代码事实”冲突
   - 系统应优先暴露冲突并进入确认，而不是默默继续生成
- 所有新增接口必须更新契约文档

## 7. 建议补充纳入 YES 的八类治理内容

除上述清单外，YES 还应长期纳入以下治理视角：

1. 数据治理与合规
2. 备份与灾备
3. 性能与容量规划
4. 可访问性
5. 供应链安全
6. 数据迁移与回填
7. SLO / 事件响应
8. 人工接管与 Kill Switch

这些不一定都在首轮实现，但应在 Foundation 阶段至少做一次决策分类。

## 8. AI 与人工的决策边界

Foundation 阶段必须显式定义决策归属。

### 8.1 必须人工确认的内容

- 业务目标与范围
- 权限模型选择
- 数据保留与合规边界
- 租户 / 组织 / Workspace 模型
- 安全策略等级
- 是否接受兼容成本和迁移成本
- 成本上限与资源配额

### 8.2 AI 可默认建议并推进的内容

- 文档结构建议
- 模块拆分建议
- 默认目录结构
- 契约模板
- 生命周期模板
- 测试与验证清单
- 暂缓项登记模板

### 8.3 必须记录 Decision Ownership 的内容

每个关键决策至少要说明：

- 谁拍板
- 哪些变更必须再次确认
- 哪些可以在同一批准计划下自动推进
- 哪些变更必须同步更新文档 / 状态机 / 契约 / 测试

## 9. Foundation 阶段的最小完成定义

一个项目只有在以下条件满足后，才算通过 Foundation 阶段：

1. 已形成 `Foundation Brief`
2. 已明确“必须现在定 / 必须预留扩展口 / 明确暂缓”三类结果
3. 已定义至少一份领域模型或核心对象清单
4. 已定义关键生命周期对象的状态机
5. 已定义基础契约、错误模型和配置真源
6. 已定义基础安全和验证要求
7. 已建立 `Deferred Decisions Register`
8. 已明确 AI 与人工的决策边界

若只形成功能列表，没有形成上述结果，不视为通过 Foundation。

## 10. 与 YES 现有文档的关系

Project Foundation Framework 不替代现有文档，而是作为其前置输入：

- `PRINCIPLES.md`
  - 定义最高原则
- `ARCHITECTURE_RULES.md`
  - 定义分层与调用方向
- `DEVELOPMENT_WORKFLOW.md`
  - 定义执行顺序和开发流程
- `VALIDATION_LAYER.md`
  - 定义最小验证门禁

Project Foundation Framework 负责在它们之前回答：

- 这个项目有哪些关键前置决策
- 哪些边界必须先冻结
- 哪些能力虽然不立刻做，但必须从 Day 1 预留

## 11. 对 YiStack 的直接启发

对 YiStack/YES 而言，Project Foundation Framework 的价值不在于增加一份文档，而在于把以下能力前置化：

- 项目启动前先回答用户体系、权限模型、国际化、主题和运行时生命周期
- 在方案生成前先建立工程前置决策层，而不是只生成业务功能方案
- 让 AI 在输出 MVP 方案时，同时输出“已决定 / 已预留 / 已暂缓”的工程基础摘要
- 为后续 Validation Gate、Engineering State、Execution Transparency 提供结构化输入

## 12. 推荐落地方式

YES 在产品化时，建议把 Project Foundation Framework 落成如下交付物：

1. `Foundation Brief`
2. `Engineering Policy`
3. `Architecture / Lifecycle Spec`
4. `Deferred Decisions Register`

在系统流程上，建议放入：

`Idea -> Foundation Design -> Plan -> MVP -> Validation -> Iteration`

而不是：

`Idea -> 直接 Plan -> 直接编码`

---

## 13. 最终原则

业务开发应建立在明确的工程基础决策之上。

YES 不要求所有基础能力都在 Day 1 实现，但要求：

- 关键能力必须在 Day 1 决策
- 高成本能力必须在 Day 1 预留边界
- 暂缓能力必须在 Day 1 留下登记

只有这样，MVP 才不是“把问题后移”，而是真正可演进的最小闭环。
