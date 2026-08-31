# YiStack Project Foundation System Design

> 本文档定义如何将 `YES Project Foundation Framework` 落地为 YiStack 中可执行、可展示、可门禁的系统能力。
>
> 它回答的不是“Project Foundation 阶段应不应该做”，而是：
>
> - 在 YiStack 中应如何建模
> - 前后端各自落在哪里
> - 产物、状态、门禁如何衔接
> - 应按什么顺序实现
>
> 说明：为避免与前端 Bootstrap UI 框架混淆，本文档默认使用 `Project Foundation / Foundation Stage` 作为人类可读术语；当前设计中的 `bootstrap` 状态名、事件名和文件草案名，可视为内部兼容别名。

---

## 1. 目标

YiStack 当前在“需求 -> 方案 -> 实现”之间，已经开始具备最小编排和工程状态能力。

但在真正进入 `plan` 和 `implementation` 之前，仍缺少一层关键能力：

- 项目级前置设计判断
- 高返工成本问题的先决策
- 可暂缓项的结构化登记
- AI 与人工在前置设计阶段的决策边界

因此，本设计的目标是把 Project Foundation 从文档规则升级为系统能力，使 YiStack 能在生成 MVP 前先完成最小工程基础决策。

## 2. 在 YiStack 中的定位

Project Foundation 不应作为完全独立的旁路流程，而应进入主链路：

`Idea -> Foundation -> Plan -> Implementation -> Validation -> Preview -> Iteration`

其中：

- `Idea`
  - 用户表达目标、背景、约束和预期
- `Foundation`
  - 系统识别高返工成本问题并完成前置设计判断
- `Plan`
  - 输出方案、推荐路径和任务拆分
- `Implementation`
  - 进入具体实现

也就是说，Foundation 是 `plan` 之前的正式阶段，而不是“附加建议”。

## 3. 设计原则

### 3.1 先决策，不要求先全实现

Project Foundation 的第一职责是帮助项目冻结关键基础决策，而不是要求所有基础能力在 Day 1 全部开发完。

### 3.2 高成本问题必须前置

下列问题只要适用，就应优先进入 Foundation：

- 用户体系
- 权限模型
- 国际化
- 主题和 Design Token
- 状态机 / 生命周期
- 契约 / 错误模型 / 配置真源
- 运行时基础
- AI 基础能力边界

### 3.3 暂缓不是忽略

被标记为“可暂缓”的项，必须进入登记，不允许只留在聊天历史里。

### 3.4 Foundation 必须可见

用户应能看到：

- 哪些项已经决定
- 哪些项待确认
- 哪些项已暂缓
- 哪些项仅做了扩展口预留
- 当前阻塞是什么
- 下一步是什么

### 3.5 Foundation 必须影响门禁

若存在“必须现在定”但未定的项，系统不应直接进入 implementation。

## 4. 系统范围

Foundation System 在 YiStack 中包含以下五部分：

1. `Foundation Stage`
   - 主链路正式阶段
2. `Foundation State Model`
   - 结构化状态模型
3. `Foundation Artifacts`
   - 文档与结构化产物
4. `Foundation UI`
   - 工作台中的可见展示与确认入口
5. `Foundation Gate`
   - 与 plan / implementation 衔接的门禁规则

## 5. 状态模型设计

### 5.1 顶层阶段

建议在现有工作流阶段中新增：

- `bootstrap`
- `bootstrap_review`
- `bootstrap_confirmed`

与现有阶段的关系建议为：

- `idea`
- `bootstrap`
- `plan`
- `implementation`
- `validation`
- `preview`
- `iteration`

### 5.2 Foundation 状态（内部类型别名沿用 Bootstrap）

建议新增：

```ts
type BootstrapStatus =
  | 'not_started'
  | 'classifying'
  | 'collecting_decisions'
  | 'awaiting_confirmation'
  | 'documenting'
  | 'completed'
  | 'blocked';
```

### 5.3 Foundation 决策项模型（内部类型别名沿用 Bootstrap）

建议最小模型：

```ts
type BootstrapDecisionBucket = 'must_decide_now' | 'reserve_extension_now' | 'defer_with_record';

type BootstrapDecisionStatus =
  | 'proposed'
  | 'recommended'
  | 'confirmed'
  | 'deferred'
  | 'blocked';

type BootstrapDecisionOwner = 'user' | 'ai' | 'shared';

type BootstrapDecisionItem = {
  id: string;
  domain: string;
  title: string;
  description: string;
  bucket: BootstrapDecisionBucket;
  status: BootstrapDecisionStatus;
  owner: BootstrapDecisionOwner;
  rationale?: string;
  recommended_option?: string;
  selected_option?: string;
  risks_if_unset?: string[];
  followup_actions?: string[];
  artifact_targets?: string[];
};
```

### 5.4 Foundation 工程状态扩展（内部类型别名沿用 Bootstrap）

建议扩展 `EngineeringState`：

```ts
type BootstrapState = {
  status: BootstrapStatus;
  template_id?: string;
  project_type?: string;
  required_decisions: BootstrapDecisionItem[];
  reserved_extensions: BootstrapDecisionItem[];
  deferred_decisions: BootstrapDecisionItem[];
  blockers: string[];
  next_action?: string;
  approval_required: boolean;
  foundation_risk_level?: 'low' | 'medium' | 'high';
};
```

并在顶层工程状态中挂入：

```ts
type EngineeringState = {
  current_stage: 'idea' | 'bootstrap' | 'plan' | 'implementation' | 'validation' | 'preview' | 'iteration';
  bootstrap_state?: BootstrapState;
  ...
};
```

状态消费侧必须通过统一的 Engineering State 快照入口读取 `bootstrap_state`。前端主输入、自动 Plan 生成、手动 Plan 生成、Foundation 面板与后续门禁恢复入口，不应各自从消息文本或局部数组中推断 Foundation 是否完成。

第一版状态持久化采用双层策略：

- `.yistack/foundation/bootstrap_state.json` 作为 Project Foundation 的结构化真源，供门禁、上下文装配与后续生成链路读取
- 持久化 workflow 消息携带 `engineeringState.bootstrap_state`，作为 UI 刷新、项目恢复与阶段展示的最新快照

项目恢复时必须合并后端持久 workflow 状态与本地 session 状态。即使 sessionStorage 中的消息数量更多，也不能覆盖后端更新后的 `engineeringState.bootstrap_state`；持久 workflow 消息中的结构化状态应被补入当前工作台消息流。

项目详情 API 应附加最新 `engineering_state` 快照，作为 UI 初始化时的项目级状态入口。前端拿到后必须将其归一化为 workflow 状态消息，进入统一消息状态流，而不是在页面局部保存一份旁路状态。

项目级状态表是存储与治理增强，不是第二套状态语义。后端通过 `project_engineering_states` 保存每个项目的最新 `engineeringState` JSON 快照，并保留 `workflow_stage / workflow_mode / workflow_status` 等最小索引列；`EngineeringStateRecorder` 在写入 workflow 消息时同步 upsert 同一份快照到项目状态表。项目详情读取 `engineering_state` 时应优先读取项目状态表，缺失或不可用时回退持久 workflow 消息反查。该表化能力不改变 `.yistack/foundation/bootstrap_state.json + workflow engineeringState + project engineering_state` 的状态消费边界，UI 仍只消费统一 Engineering State 快照。

### 5.5 Capability Context 与 Skill / MCP 接入边界

Capability Layer 的第一步不是无边界地执行外部工具，而是在编排层冻结“本次主链路准备使用哪些能力”，再通过统一 executor 决定是否执行。`OrchestrationContext` 应预留 `CapabilityProfile`，后端通过 `CapabilityContext` 基于已归一化的 `workflow_stage / workflow_mode` 解析能力计划，并把能力 ID、provider、用途、版本和 `source_note` 作为结构化 step meta 输出。

内置能力 provider 使用 `internal`，用于表达已有的编排上下文、工程状态快照、Foundation 决策整理、方案生成、实现内容生成和 Validation Gate。`skill` 与 `mcp` provider 必须复用同一 `CapabilityContext / CapabilityResolution / CapabilityExecutionAudit / CapabilityExecutionResult` 链路，而不是让 handler、service 或前端各自拼装能力调用。外部能力执行结果如果影响主链路状态，必须回写 `EngineeringState` 或明确的 artifact，不能只停留在聊天文本中。

外部能力声明必须由显式 `CapabilityProfile` 或显式 online context 触发，默认实现链路不得自动追加 Skill / MCP 能力。`/chat/generate` 可携带受控 `capability_profile` 字段并进入 `OrchestrationContext.CapabilityProfile`，空值必须保持默认 profile；普通 UI 不应把该字段当成自动开启外部能力的开关。`implementation-skill-dry-run-capability-profile` 与 `implementation-mcp-dry-run-capability-profile` 仍只追加契约验证能力，例如 `skill.contract_dry_run` 或 `mcp.contract_dry_run`；`GenerateCommand.Online=true` 只能追加可选的 `online_context.search_crawl`。这些能力进入真实执行前仍必须经过 provider registry、execution policy、runner 注入、network allowlist 和审计落库；若外部 provider 未启用，解析阶段必须继续阻断或按可选能力规则跳过。

Capability Provider Registry 负责把能力计划解析到具体 provider，并产出 `CapabilityResolution`。默认 registry 必须显式注册 `internal / skill / mcp` 三类 provider：`internal` 表示当前后端已实现的内置能力；`skill` 和 `mcp` 在真实运行时、权限边界、失败恢复和审计策略接入前应保持禁用。任何能力声明了未注册或未启用的 provider，都必须解析为 `blocked`，并通过 `source_note` 说明原因，不能静默降级到聊天文案或其它 provider。

外部 provider 可用性必须由组合根配置注入。后端配置应提供 `CAPABILITY_ENABLE_SKILL_PROVIDER / CAPABILITY_ENABLE_MCP_PROVIDER`，默认值必须保持关闭；组合根通过 `CapabilityProviderRegistryOptions` 创建 registry 并注入 `GenerateOrchestratorWithOptions`。provider enabled 只表示能力计划可解析到外部 provider，不代表允许真实执行，真实调用仍必须继续经过 execution policy 与 runner 注入门禁。

`capability:resolve` 是能力计划、provider 解析结果、执行前审计与执行结果的最小可观测事件。该事件的 meta 应同时包含 `capability_plan`、`provider_resolution`、`execution_audit` 与 `execution_result`：`capability_plan` 说明本次链路需要哪些能力；`provider_resolution` 说明 provider 可用性；`execution_audit` 说明当前能力是由现有阶段承接、跳过、阻断，还是已解析为外部可执行候选；`execution_result` 由注入的 `CapabilityExecutor` 产出。默认 no-op executor 只冻结内置能力结果；当组合根注入 `ExternalCapabilityExecutor` 且 provider enabled、policy enabled、runner injected 与 network allowlist 全部满足时，`skill-http / mcp-http` 结果代表受控真实 HTTP 调用结果，并继续进入同一审计与恢复链路。

`CapabilityExecutor` 必须通过编排层构造入口注入。默认 no-op executor 只能作为安全回退，用于保持 internal 能力仍由既有阶段承接；真实 Skill / MCP executor 由组合根注入，并复用同一 `CapabilityContext / CapabilityResolution / CapabilityExecutionAudit / CapabilityExecutionResult` 契约。禁止在 handler、service 或前端绕过该 executor 直接调用外部能力。

能力执行审计必须具备独立持久化落点与受控只读查询面。`project_capability_execution_audits` 作为 append-only 审计表，记录 `project_id`、`workflow_stage`、`workflow_mode`、`capability_profile`、执行状态以及 `provider_resolution / execution_audit / execution_result` 三份结构化 JSON。审计写入由组合根注入的 `RecordingCapabilityExecutor` 统一完成，且只能作为观测增强：写入失败不得反向阻断主链路。审计查询必须按 `project_id` 命名空间隔离，并复用项目归属校验；`GET /api/project/:id/capability-audits` 只能返回当前用户有权访问项目的审计记录，支持分页以及 `status / capability_profile` 过滤，响应应把三份 JSON 解析为结构化对象，解析失败时保留 `parse_error / raw` 以便排障。前端调试面板可以读取该接口展示最近能力审计摘要、执行状态与阻断原因，但不得从观测面触发真实 Skill / MCP 执行或绕过 provider / policy / runner / network 门禁。真实 Skill / MCP executor 必须复用同一落库契约完成失败恢复和运维查询。

真实 Skill / MCP 执行必须先经过 provider runner 边界。`ExternalCapabilityExecutor` 只负责把已通过 `CapabilityExecutionAudit` 的外部能力分派给组合根注入的 `CapabilityProviderRunner`；没有注入对应 runner 时，执行结果必须返回 `blocked / provider_runner_unavailable`，不能静默降级到 no-op、聊天文本或其它 provider。默认启动配置可以挂载该 executor 边界，但 provider、policy、runner mode、endpoint、network enabled 与 allowlist 任一条件不满足时都不得发起外部调用。

第一版 runner 注入应先支持 dry-run 契约模式。后端配置可提供 `CAPABILITY_SKILL_RUNNER_MODE / CAPABILITY_MCP_RUNNER_MODE`，空值表示不注入 runner，`dry-run` 表示注入 `DryRunCapabilityProviderRunner`。dry-run runner 只能返回结构化 `executed` 结果，用于验证 provider enabled、policy enabled、runner injected 三重门禁和审计链路；它不得触网、不得读取外部系统，也不得被描述为真实 Skill / MCP 调用。

具体 client runner 分为本地 contract manifest 与受限 HTTP JSON 两类。后端配置可在 `CAPABILITY_SKILL_RUNNER_MODE / CAPABILITY_MCP_RUNNER_MODE` 中使用 `contract`，并通过 `CAPABILITY_SKILL_RUNNER_MANIFEST / CAPABILITY_MCP_RUNNER_MANIFEST` 显式指向本地 JSON manifest。`ContractCapabilityProviderRunner` 只能按 `capability_id` 从 manifest 读取结构化 `CapabilityProviderRunResult`，用于验证真实 client 的装配、权限门禁、结果映射和审计链路；它不得触网、不得读取未配置路径，也不得把 manifest 结果描述为真实外部系统执行。manifest 缺失、不可读、非法或未声明当前能力时，必须返回结构化 blocked 结果。真实外部调用只能走 `skill-http / mcp-http`，并继续受 execution policy、runner boundary、timeout、network enabled 与 allowlist 约束。

contract manifest 与 Skill / MCP HTTP 协议必须具备示例与自动校验。`docs/contracts/capability/*-contract.example.json` 是 Skill / MCP 本地 contract runner 的示例输入，必须使用 `source_note` 声明来源边界，capability 结果必须包含合法 `status / reason_code / source_note`，artifact 必须包含自身 `source_note`。`docs/contracts/capability/mcp-http-protocol.example.json` 与 `docs/contracts/capability/skill-http-protocol.example.json` 是受限 HTTP runner 的请求/响应协议示例，请求必须包含 `capability_id / capability_name / capability_version / capability_catalog_source / provider / provider_resolution_status / required / reason_code / source_note / workflow_stage / workflow_mode / capability_profile / project_id / user_id`，且 provider 必须分别为 `mcp / skill`；响应必须满足 `CapabilityProviderRunResult` 结构，并且 response metadata 与 artifact metadata 中的 `provider / runner_mode` 必须与协议类型一致，例如 `mcp / mcp-http` 或 `skill / skill-http`。`scripts/validate-capability-contract-manifests.mjs` 应纳入 `pnpm yes:validate`，确保示例 manifest 与 Skill / MCP HTTP 协议在提交前被校验；任何真实 manifest 或 endpoint 接入前也应先满足同一契约。

真实 Skill / MCP client runner 必须经过独立网络边界。后端配置应提供 `CAPABILITY_RUNNER_TIMEOUT_SECONDS / CAPABILITY_RUNNER_NETWORK_ENABLED / CAPABILITY_RUNNER_NETWORK_ALLOWLIST`，默认 timeout 为 30 秒、网络调用关闭、allowlist 为空。`ExternalCapabilityExecutor` 必须把 `CapabilityRunnerBoundary` 注入 runner context，并对每次 runner 执行应用统一 timeout；真实 runner 发起网络调用前必须通过 boundary 校验目标。网络未启用时返回 `blocked / provider_runner_network_disabled`，目标为空或非法时返回 `blocked / provider_runner_network_target_invalid`，目标不在 allowlist 时返回 `blocked / provider_runner_network_target_denied`；只有 allowlist 命中时才允许进入真实 client 调用，并必须在 metadata 中记录目标和 allowlist 来源。

真实 Skill / MCP endpoint 接入前必须具备组合根预检。`buildCapabilityProviderPreflight` 应从 `CapabilityConfig` 生成 Skill / MCP 两类预检项，并输出稳定 `provider / runner_mode / status / severity / reason_code / source_note / next_action / metadata`。空 runner mode 应返回 `skipped / provider_runner_mode_empty`；`dry-run` 与 `contract` 应返回 `ready / provider_runner_preflight_not_required`，因为它们不发起网络调用；`skill-http / mcp-http` 必须先检查 provider/mode 是否匹配，再检查 endpoint 是否配置，并复用 `CapabilityRunnerBoundary.ValidateNetworkTarget` 校验 network enabled、endpoint 合法性与 allowlist 覆盖。`severity` 只能作为只读观测优先级，建议将 `ready` 映射为 `info`、`skipped` 映射为 `warning`、`blocked` 映射为 `critical`，不得替代 `status / reason_code` 或运行时门禁判断。`next_action` 只能基于 reason code 给出下一步排查建议，不得触发自动修复、写配置或真实 endpoint 探测。`metadata.config_keys` 可以列出与当前预检原因相关的环境变量名，例如 runner mode、endpoint、network enabled、allowlist 等，用于定位配置项；该字段不得包含配置值、密钥或可写指令。预检失败只作为装配诊断记录，不得绕过运行时的 provider enabled、policy enabled、runner injected 与 network allowlist 门禁，也不得默认启用真实外部调用。

Provider 预检结果必须具备受控只读观测面。`GET /api/admin/capability/provider-preflight` 应挂在 admin 认证与角色校验之后，只返回当前启动配置下的 Skill / MCP 预检快照，响应必须包含 `generated_at / source_note / items / status_counts`，其中 `source_note` 必须说明该数据是服务启动时生成的配置快照，不代表实时 endpoint 探测。该接口不得触发 runner 执行、不得读取外部 endpoint、不得修改配置，也不得替代运行时门禁。Admin Dashboard 可以读取该接口展示预检摘要、状态计数、完整 provider 明细、blocked 原因、severity 风险等级、下一步排查建议、配置项定位提示、诊断 metadata、快照时间与来源说明；前端可从同一启动快照本地派生 critical / warning / info 优先摘要，并按 `status / severity` 筛选、按 severity 优先级排序，用于快速聚焦 critical / blocked 项，但摘要、筛选与排序不得反向影响后端快照、不得触发重新预检、不得发起 endpoint 探测。Provider preflight 的前端排序、筛选与优先摘要应沉淀为纯派生模型，并纳入 YES 校验，至少覆盖 severity 优先级、同级 provider 排序、组合筛选、原始快照不变性和健康态摘要，避免观测语义在展示迭代中漂移。Provider preflight 观测应收口为独立 Admin 运维诊断组件，Dashboard 页面只负责权限判断、数据获取与布局挂载，筛选、排序、摘要和明细渲染由该组件内部管理，避免页面层继续承载诊断业务细节；该诊断组件应继续保持容器/展示分离，展示子组件只能消费已传入的启动快照派生数据，不得自行请求接口、执行 runner、探测 endpoint 或写入配置。该观测卡只能作为只读诊断卡，不得提供真实执行按钮或配置写入口。诊断 metadata 只能用于解释 endpoint 配置状态、network enabled、allowlist 与 provider/mode 判定来源，不得被前端作为可写配置或真实调用参数。预检观测用于提前发现 endpoint、network、allowlist 与 provider/mode 错配问题，后续前端或运维面板只能把它作为诊断来源。

第一版真实 MCP client runner 只能采用受限 HTTP JSON 适配器。后端配置可在 `CAPABILITY_MCP_RUNNER_MODE` 中使用 `mcp-http`，并通过 `CAPABILITY_MCP_RUNNER_ENDPOINT` 显式声明 endpoint；该模式只允许 MCP provider 使用，Skill provider 不得复用。`MCPHTTPCapabilityProviderRunner` 必须先通过 `CapabilityRunnerBoundary` 校验 endpoint，再向 endpoint 发送包含能力身份、catalog 来源、provider resolution、required 标记、workflow stage/mode、capability profile、project id 与 user id 的 JSON POST 请求，并要求响应为结构化 `CapabilityProviderRunResult`。endpoint 缺失时返回 `blocked / provider_runner_endpoint_missing`，endpoint 非法时返回 `blocked / provider_runner_endpoint_invalid`，HTTP 调用失败或非 2xx 时返回 `blocked / provider_runner_http_failed`，响应不是合法 JSON 时返回 `blocked / provider_runner_invalid_response`。该 runner 仍必须同时受 provider enabled、policy enabled、runner injected 和网络 allowlist 约束。

第一版真实 Skill client runner 同样只能采用受限 HTTP JSON 适配器。后端配置可在 `CAPABILITY_SKILL_RUNNER_MODE` 中使用 `skill-http`，并通过 `CAPABILITY_SKILL_RUNNER_ENDPOINT` 显式声明 endpoint；该模式只允许 Skill provider 使用，MCP provider 不得复用。`SkillHTTPCapabilityProviderRunner` 必须复用与 MCP HTTP runner 相同的网络边界、完整请求结构、响应契约和错误分类，向 endpoint 发送包含能力身份、catalog 来源、provider resolution、required 标记、workflow stage/mode、capability profile、project id 与 user id 的 JSON POST 请求，并要求响应为结构化 `CapabilityProviderRunResult`。endpoint 缺失、非法、网络未启用、allowlist 拒绝、HTTP 失败或非法 JSON 响应都必须返回结构化 blocked 结果。该 runner 仍必须同时受 provider enabled、policy enabled、runner injected 和网络 allowlist 约束，默认配置不得启用真实 Skill 调用。

真实 Skill / MCP runner 必须遵守最小结果契约。`CapabilityProviderRunner` 不得直接写聊天文本或绕过编排状态，只能返回结构化 `CapabilityProviderRunResult`，并映射为 `CapabilityExecutionResultItem`。执行结果必须包含稳定 `status / reason_code / source_note`，可选携带 `metadata / artifacts` 作为审计与后续消费边界；artifact 只能描述结构化产物，不得作为隐式外部副作用。映射后的 result metadata 必须保留 `source / capability_version / capability_catalog_source / provider_resolution_status`，runner 返回的 metadata 只能作为补充。runner 返回未知状态必须被归类为 `blocked / provider_runner_invalid_result`；执行 panic 必须被归类为 `blocked / provider_runner_failed`；context 取消或超时必须被归类为 `provider_runner_cancelled / provider_runner_timeout`。dry-run runner 必须遵守同一契约，并通过 metadata/artifact 明确自身只做契约验证、不代表真实外部调用。

外部能力执行还必须受独立执行策略约束。`CapabilityExecutionPolicy` 默认不允许真实调用 `skill / mcp` runner；即使 provider 已启用且 runner 已注入，只要策略未显式允许，对应能力也必须返回 `blocked / external_capability_execution_disabled`。组合根启用真实 Skill / MCP 调用时，必须同时满足 provider enabled、policy enabled、runner injected 三个条件，并在 `source_note` 中说明策略来源。

外部能力执行策略必须从配置层进入组合根。后端配置应提供 `CAPABILITY_ENABLE_SKILL_EXECUTION / CAPABILITY_ENABLE_MCP_EXECUTION / CAPABILITY_EXECUTION_POLICY_NOTE`，默认值必须保持关闭；组合根只负责把 `CapabilityConfig` 映射为 `CapabilityExecutionPolicy`，不得在 orchestration 内直接读取环境变量或绕过配置来源说明。真实 runner 接入后，仍必须保留该配置门禁作为运维层 kill switch。

Capability 执行阻断必须进入统一恢复状态。只要 `execution_result.status=blocked`，`capability:resolve` step 必须以 `failed` 状态输出，并将 `engineeringState.workflow.status` 标记为 `failed`，同时写入 `engineeringState.execution.pause_reason=capability_execution_blocked` 与 `engineeringState.recovery`。恢复状态至少包含 `reason_code / reason_message / resume_stage / resume_mode / can_retry / retry_prompt`，并且后端必须在进入 Prompt 校验、Foundation Gate 或 Generation Stage 前停止主链路，返回可识别的 `ErrCapabilityExecutionBlocked`。

Capability Gate 的 SSE 错误收尾必须保留结构化恢复信息。`CapabilityGateError` 在 stream error payload 中应输出 `code=capability_execution_blocked`、`blocking=true`、完整 `engineeringState` 与结构化 `execution_result`，前端不得只依赖普通 `message / details` 文案判断恢复路径。

前端消费 Capability Gate 错误时必须以 `engineeringState.recovery` 为准生成恢复动作。Implementation 流式错误处理应识别 `code=capability_execution_blocked`，展示阻断原因、当前任务、下一步和恢复阶段，并复用 `retry_workflow_gate` 行为触发重试；禁止把该错误降级成普通“生成失败”文案。

### 5.6 Schema 版本与冻结边界

为避免后续前后端并行开发时反复改字段，Foundation 状态结构建议从第一版起就带版本号：

```ts
type BootstrapStateEnvelope = {
  schema_version: 'v1';
  updated_at: string;
  state: BootstrapState;
};
```

冻结建议：

- `BootstrapState / BootstrapDecisionItem / BootstrapDecisionBucket / BootstrapDecisionStatus`
  - 作为 `v1` 冻结
- 新增字段
  - 允许，但应保持向后兼容
- 删除字段或修改字段语义
  - 不允许在 `v1` 内直接发生，必须通过 `v2` 升级
- `bootstrap_*` 内部命名
  - 当前允许保留，等真实代码落地稳定后再决定是否统一重命名

## 6. 产物设计

Project Foundation 不应只产出消息，而应产出固定工件。

建议每个项目至少生成以下四份文档：

1. `.yistack/foundation/foundation-brief.md`
2. `.yistack/foundation/engineering-policy.md`
3. `.yistack/foundation/architecture-lifecycle-spec.md`
4. `.yistack/foundation/deferred-decisions.md`

此外，系统内部还应保留一份结构化快照（可继续沿用内部兼容名）：

- `.yistack/foundation/bootstrap_state.json`

它的作用是：

- 供前端稳定消费
- 供 Validation Gate 读取
- 供后续 plan 阶段带入上下文
- 避免只靠 markdown 反解析状态

### 6.1 Source Of Truth

在系统实现层，建议明确以下真源关系：

- `.yistack/foundation/bootstrap_state.json`
  - 结构化真源，供前端、Gate、Orchestrator、Validation 稳定读取
- `.yistack/foundation/foundation-brief.md / .yistack/foundation/engineering-policy.md / .yistack/foundation/architecture-lifecycle-spec.md / .yistack/foundation/deferred-decisions.md`
  - 人类可读工件，用于审阅、协作和留档

也就是说：

- Gate 不应从 markdown 反推状态
- 前端不应把 markdown 解析结果当作唯一状态
- markdown 应由结构化状态和决策结果驱动生成或回写

### 6.2 路径收口策略

当前阶段将 YiStack 内部 Foundation 工件统一收口到 `.yistack/foundation/`：

- 人类可读 Foundation 工件
  - 使用 `.yistack/foundation/*`
- 结构化真源
  - 使用 `.yistack/foundation/bootstrap_state.json`
- 用户要求生成的设计、需求、架构或约束文档
  - 按用户指定路径写入，例如 `docs/`

### 6.3 Context / Memory 防串线设计

YiStack 不应把“记忆”理解为单一聊天历史，而应拆成多层上下文源，并固定优先级。

建议最小上下文层次如下：

1. `.yistack/foundation/bootstrap_state.json`
   - Foundation 结构化真源
2. `.yistack/foundation/foundation-brief.md / .yistack/foundation/engineering-policy.md / .yistack/foundation/architecture-lifecycle-spec.md / .yistack/foundation/deferred-decisions.md`
   - 人类可读工件
3. `.yistack/PROJECT_CONTEXT.md`
   - 项目级稳定上下文
4. 当前仓库代码 / 配置 / 文档
   - 运行时真实事实
5. 项目聊天历史
   - 当前项目对话补充上下文
6. 对话压缩摘要
   - 仅用于恢复阅读效率，不作为高优先级真源

建议固定 Source Priority：

- `.yistack/foundation/bootstrap_state.json / EngineeringState`
  - 高于任何 markdown、聊天历史和摘要
- 已确认 Foundation 工件 / 已确认方案
  - 高于普通对话内容
- 当前仓库事实
  - 高于旧摘要和旧结论
- 当前项目聊天历史
  - 仅作为补充，不可覆盖已冻结状态
- 压缩摘要
  - 最低优先级，只用于恢复上下文

### 6.4 Project Namespace 与记忆隔离

为避免多项目并行开发时上下文串线，YiStack 应明确：

- 所有项目级消息、Foundation 状态、工件、计划摘要、运行时信息
  - 必须按 `project_id` 隔离
- 当前生成链路默认只能读取当前项目命名空间下的稳定上下文
- 跨项目经验若需复用
  - 必须进入显式模板、规范或全局策略层
  - 不允许把其他项目的对话或摘要直接注入当前项目

### 6.5 Summary 使用边界

若未来引入对话压缩摘要，必须遵守以下约束：

- 摘要不是 Source of Truth
- 摘要不得覆盖 `.yistack/foundation/bootstrap_state.json`
- 摘要不得覆盖已确认的 Foundation 工件
- 摘要不得覆盖当前仓库代码、配置和运行时状态
- 当摘要与结构化状态冲突时
  - 应触发冲突提示或确认 Gate

### 6.6 Context Policy / Memory Strategy 作为显式前置决策

对于 AI Agent Platform、复杂 SaaS 或多工作流系统，建议在 Foundation 中把以下项显式列为决策：

- `ai.context_policy`
  - 定义哪些上下文可进入 prompt、哪些只能作为系统状态引用
- `ai.memory_strategy`
  - 定义用户级 / 项目级 / 任务级 / 阶段级记忆边界
- `ai.prompt_versioning`
  - 保证上下文模板可追踪
- `ai.audit_log`
  - 记录关键决策与上下文来源

### 6.7 冲突检测与门禁建议

当以下任一情况发生时，系统不应继续静默推进：

- Foundation 决策与当前代码事实冲突
- `.yistack/PROJECT_CONTEXT.md` 与 `.yistack/foundation/bootstrap_state.json` 冲突
- 对话摘要与已确认工件冲突
- 当前用户输入试图直接越过已冻结 Foundation 决策

建议行为：

- 在 UI 中暴露冲突项
- 将状态置为 `blocked` 或 `awaiting_confirmation`
- 要求用户确认是“更新 Foundation”还是“按既有 Foundation 执行”

当前最小实现还应补齐以下交互约束，以降低修复时的认知负担：

- Context Gate 的修复入口
  - 不应只停留在“打开文件”
  - 应尽量下钻到字段级目标，例如 `.yistack/PROJECT_CONTEXT.md` 的 `项目 ID`、`应用类型`，或 `.yistack/foundation/bootstrap_state.json` 的 `project_type`
  - 聊天失败消息与 Foundation 面板都应展示字段级修复建议，避免用户只能看到笼统阻断文案
- 编辑器导航目标
  - 应支持 `path + searchText + label` 结构
  - 以便 UI 能在打开文件后自动搜索并聚焦到冲突字段附近
- 编辑器修复反馈
  - 在 `setPosition / setSelection / revealLineInCenter` 之外，建议补一层短暂高亮
  - 让用户在聊天区或 Foundation 面板点击修复后，能一眼看见当前需要修改的位置

也就是说，Context / Memory Gate 的闭环不只是“检测出冲突”，还包括：

`结构化阻断 -> 字段级修复建议 -> 打开文件并自动定位 -> 短暂高亮提示 -> 用户修复后重试`

在此基础上，当前最小实现还应把以下语义并入统一工作流状态，而不是继续分散在错误分支或临时文案里：

- `recovery.blocked`
  - 标识当前是否处于可恢复阻断态
- `recovery.reason_code / reason_message`
  - 标识阻断原因，避免 UI 只能从失败文案反推
- `recovery.resume_stage / resume_mode`
  - 标识修复完成后应恢复到哪个阶段、哪种工作模式
- `recovery.can_retry / retry_label / retry_prompt`
  - 标识是否允许重试，以及 UI 应提供什么重试入口
- `validation.failure_items`
  - Validation Gate 不应只保留最后一行失败摘要
  - 应输出结构化失败项，至少包含 `title / detail / severity / suggestion`
  - 当校验输出包含源码位置时，应进一步提供 `file_path / line_number / column / search_text`
  - UI 应基于这些字段展示修复建议与源码位置，提供“打开修复位置”入口，并复用编辑器定位与短暂高亮能力
- `foundation_gate_blocked`
  - Project Foundation 未完成时，不应允许直接进入 Implementation
  - 当 `.yistack/foundation/bootstrap_state.json` 缺失、未完成、存在 blocker，或 `must_decide_now` 决策未确认时，应返回 `block`
  - 阻断状态应写入 `bootstrap_state.gate_result` 与 `engineeringState.recovery`
- `retry_workflow_gate`
  - UI 不应把修复后重试仅实现为普通 `send_prompt`
  - 应作为显式恢复动作，携带 `resume_stage / resume_mode` 回到原阻断阶段继续执行
  - Context Gate、Validation Gate 与后续 Foundation Gate 都应复用该恢复动作，而不是各自实现一套重试分支

这样，Gate 闭环才真正进入：

`检测 -> 阻断 -> 修复 -> 恢复 -> 重试`

而不是只做到：

`检测 -> 报错`

同时，Plan 入口也必须服从 Foundation-first 约束：

- 用户从 Idea 发起普通输入时，如果当前项目没有 `bootstrap_state.status=completed`，应先进入 Foundation
- 自动或手动 Plan 生成请求不得绕过 Foundation
- 当 Plan 请求发生在 Foundation 未完成状态时，UI 应提示先启动 Project Foundation，而不是静默生成方案
- 后端 Plan 编排入口也必须执行 `foundation-before-plan` 门禁，不能只依赖前端 guard；若 `.yistack/foundation/bootstrap_state.json` 缺失、未完成、存在 blocker，或 `must_decide_now` 决策未确认，应返回 `foundation_gate_blocked`
- Plan 流收到 `foundation_gate_blocked` 后，应把结构化 `engineeringState` 写回当前 Plan 消息，并引导用户回到 Project Foundation review
- Plan 失败收尾不应把 Foundation Gate 阻断呈现为普通“生成技术方案失败”；应展示 Foundation 阻断原因，并提供 `retry_workflow_gate` 恢复动作

## 7. 模板化策略

Project Foundation 不应对所有项目都问同样的问题。

建议先提供模板化分类：

- `saas_app`
- `admin_console`
- `ai_agent_platform`
- `internal_tool`
- `content_platform`
- `developer_platform`

模板作用：

- 决定优先追问哪些高成本域
- 决定哪些项可以默认建议
- 决定默认文档骨架

例如：

- `admin_console`
  - 优先：SSO、RBAC、菜单权限、审计日志、国际化、主题
- `ai_agent_platform`
  - 优先：Provider、Model、Prompt、Context、Memory、Tool Registry、成本治理
- `saas_app`
  - 优先：用户体系、多租户、计费、权限、组织模型、数据隔离

## 8. 后端落点

### 8.1 Orchestration

后端编排层已落地第一版最小入口：

- `workspace_bootstrap_orchestrator.go`
- `workspace_engineering_state.go`
- `workspace_foundation_gate.go`

当前职责边界：

- `BootstrapOrchestrator`
  - 负责阶段推进与结构化事件输出
- `EngineeringState / BootstrapState`
  - 负责 Foundation 状态归一化与事件 payload
- `GenerateOrchestrator`
  - 负责在 `bootstrap / bootstrap_review / bootstrap_confirmed` 阶段路由到 Foundation 编排入口
- `Foundation Gate`
  - 负责阻断进入 Plan / Implementation 的条件判断

后续如果需要更细粒度的模板注册、决策 patch 与工件管理，可再把当前文件拆分为独立 `bootstrap_templates.go / bootstrap_state.go / bootstrap_gate.go`，但第一版不应另起与主链路并行的编排入口。

### 8.2 指令模型

建议新增：

- `BootstrapCommand`
- `BootstrapDecisionPatch`
- `BootstrapArtifactPayload`

与现有 `GenerateCommand / PlanCommand` 平行，而不是混进普通 prompt 结构。

### 8.3 事件模型

编排层应输出结构化事件。第一版已落地：

- `bootstrap_started`
- `bootstrap_template_selected`
- `bootstrap_decision_proposed`
- `bootstrap_artifact_generated`
- `bootstrap_completed`

后续更细的决策级交互可继续扩展：

- `bootstrap_decision_confirmed`
- `bootstrap_decision_deferred`
- `bootstrap_blocked`

这样前端展示真实状态，不必靠猜消息文案。

### 8.4 最小事件契约

除事件名本身外，建议第一版统一事件 envelope：

```ts
type BootstrapEventEnvelope = {
  event_name: string;
  event_version: 'v1';
  project_id: string;
  stage: 'bootstrap';
  timestamp: string;
  request_id?: string;
  payload: Record<string, unknown>;
};
```

第一版要求：

- 所有 Foundation 事件都必须带 `event_version`
- 同一次编排链路的事件应尽量复用同一个 `request_id`
- `payload` 可按事件类型扩展，但顶层 envelope 不应随意变化

## 9. 前端落点

### 9.1 Workspace Stage 展示

建议在 Workspace 的阶段视图中新增 `Foundation` 段。

用户应至少能看到：

- 当前模板
- 已确认前置决策
- 待确认高成本决策
- 已暂缓项
- 已预留扩展口
- 当前阻塞
- 下一步动作

### 9.2 Foundation 面板

建议新增 `Foundation Panel`，包含四个区域：

1. `核心前置决策`
2. `状态机与生命周期`
3. `延后项登记`
4. `风险与下一步`

### 9.3 交互原则

- 不一次性把几十个问题全抛给用户
- 先由模板分类和 AI 预判生成建议
- 仅对高成本 / 高分歧 / 必须人工确认项进行追问
- 用户确认总体方向后，低风险项可默认自动推进

## 10. 与 Plan / Implementation 的衔接

### 10.1 Foundation -> Plan

`plan` 阶段应直接读取：

- `.yistack/foundation/bootstrap_state.json`
- `.yistack/foundation/foundation-brief.md`
- `.yistack/foundation/engineering-policy.md`

Plan 不再从零假设这些基础条件，而是在已决策约束下生成方案。

### 10.2 Foundation -> Implementation

Implementation 阶段应读取：

- 已确认的架构与生命周期约束
- 已冻结的工程策略
- 已登记的暂缓项

这样 AI 在实现时不会重新发明基础规则。

## 11. Validation Gate 规则

Foundation 必须和 Validation / Gate 联动。

建议最小门禁规则如下：

### 11.1 阻断进入 Implementation 的条件

若满足任一条件，应阻断：

- 存在 `must_decide_now` 且状态不是 `confirmed`
- 基础安全策略未定
- 核心生命周期对象未定义状态机
- 契约 / 错误模型 / 配置真源未冻结

### 11.2 允许进入 Plan 但保留警告的条件

以下可允许继续进入 plan，但必须显式提示：

- 存在 `reserve_extension_now` 尚未写入边界说明
- 存在高风险暂缓项但已登记

### 11.3 暂缓项要求

若项被标记为 `defer_with_record`，则至少必须写入：

- 暂缓原因
- 后续触发条件
- 影响模块
- 建议回收时间点

### 11.4 Gate 返回结果语义

为避免前端、编排层和 Validation 对 gate 结果各自解释，建议冻结最小返回结构：

```ts
type BootstrapGateResult = {
  decision: 'allow' | 'warn' | 'block';
  reasons: string[];
  blocking_items?: string[];
  warning_items?: string[];
  next_action?: string;
};
```

语义约束：

- `allow`
  - 可继续进入下一阶段，无需额外确认
- `warn`
  - 可继续，但必须显式展示风险与未完成项
- `block`
  - 不可继续，必须先补齐关键前置决策

## 12. AI 与人工协作规则

### 12.1 AI 默认可推进的内容

- 模板分类
- 决策项初筛
- 建议选项
- 工件草稿生成
- 暂缓项登记初稿

### 12.2 必须人工确认的内容

- 用户体系
- 权限模型
- 租户 / 组织 / Workspace 模型
- 合规边界
- 成本上限
- 高风险安全策略
- 是否接受兼容与迁移成本

### 12.3 自动推进边界

当用户已确认总体 Foundation 方向后：

- AI 可继续补齐低风险文档和工件
- AI 可继续生成 `plan` 输入
- 只有遇到高风险 / 高分歧 / 门禁阻断时才暂停确认

状态展示必须来自统一 `EngineeringState.execution`，而不是前端临时字符串阶段。聊天面板应展示：

- `auto_progress_enabled` 对应的自动推进状态
- `awaiting_confirmation` 对应的等待确认状态
- `pause_reason / approval_boundary` 对应的暂停原因与确认边界
- `current_task / next_action` 对应的当前任务与下一步

批准计划后的自动推进必须有显式编排交接点。第一版使用 `plan-approved` 作为方案确认后的 workflow stage：

- 用户手动确认方案，或倒计时结束自动确认推荐方案后，前端应先写入带 `engineeringState.execution.auto_progress_enabled=true` 的 workflow 状态消息
- 随后的实现请求应携带 `conversation_stage=plan-approved`，由后端归一化为 `WorkflowMode=implement`
- `conversation_stage / mode` 只作为 API 兼容输入；后端进入主链路前必须归一化为 `OrchestrationContext.WorkflowStage / WorkflowMode`，并在下传 service 时使用归一化后的 Context 阶段与模式
- service 层如因兼容结构仍接收 `ConversationStage / Mode` 字段，内部必须通过 workflow stage/mode 访问器消费已归一化语义，禁止重新把旧字段当作阶段真源或提示词阶段判断入口
- 后端 `EngineeringState.execution.approval_boundary` 应写为 `approved_plan`，表示当前自动推进只在同一已批准计划范围内有效
- 前端 `plan-approved` 状态应补充 `approval_source / approval_scope / approved_plan_id / approved_plan_name`，让 Workspace 能展示确认来源、已批准方案和自动推进范围
- Workspace 状态条应以中文展示确认边界与自动推进范围，避免用户只能看到 `approved_plan` 这类内部编码
- 自动推进遇到 Foundation Gate、Validation Gate、运行时异常、高风险变更或新的确认边界时，必须停止并写入 `pause_reason / recovery`

编排层阶段推进必须产出结构化 `step` 事件，并携带当前 `engineeringState`。对于 Plan / Generate 这类主阶段，至少应成对输出：

- `running`：进入阶段，说明当前任务与下一步
- `done`：阶段完成，说明可进入的下一阶段
- `failed`：阶段失败，写入暂停原因与恢复边界

Runtime 内部更细粒度的文件写入、命令执行和环境准备事件，可继续作为子任务事件保留，但不应替代编排层主阶段事件。

后端 Generate 主链路也必须保持阶段单元边界。`GenerateOrchestrator.Generate` 只应表达归一化、bootstrap 阶段路由、Foundation Gate、生成阶段、Validation Gate 等阶段顺序；bootstrap 阶段自身的权限检查、Prompt 校验、Foundation 编排调用和状态持久化应沉入独立 bootstrap stage 模块；生成阶段自身的 service request 组装、`running / done / failed` 事件、失败暂停状态应沉入独立 generation stage 模块；Validation Gate 的 `running / done / failed` 状态推进、失败项解析、恢复状态与状态记录应沉入独立 validation stage 模块，避免重新退回“主函数串接全部细节”的形态。

service 内部也必须保持子阶段边界。`GeneratorService.Generate` 不应同时承载项目上下文读取、Context Gate 冲突处理、runtime readiness、LLM 内容流、文件应用与完成事件拼装；项目上下文读取、Context Gate 冲突处理与 runtime readiness 应沉入独立 runtime/context stage 模块；LLM 内容流的 prompt / chat request 构建、reasoning flush、stream chunk 消费、取消草稿和失败处理应沉入独立 content stage 模块；artifacts apply、assistant 消息持久化、guidance 构建与 done payload 发送应沉入独立 artifacts stage 模块。

前端消费 SSE 时也必须保持同一协议边界：Response 读取、SSE buffer 拆包、事件解析与 handler 分发应由共享 runner 承接；`step` 事件的基础解释应先归一化为 workflow step、状态行与文件操作类型，再由 Plan / Implementation 各自处理消息 patch、文件刷新和业务副作用。Plan / Implementation 的 step 副作用应独立沉入 step effects 模块；消息形态包装、错误事件处理和完成态收尾应继续下沉到专用 events / finalization 模块；完成态涉及生成文件应用、关联 commit 刷新等副作用时，应继续拆入 effects 模块；失败态涉及 Gate 阻断消息、恢复动作和失败 patch 时，也应独立沉入 failure effects 模块。流消费函数只保留事件表与最小状态变量。

Runtime readiness 也必须进入同一状态入口。第一版采用 `runtime-readiness` workflow 消息表达运行时准备状态：

- 容器启动、状态轮询、恢复等待、ready 与 failed 都应写入 `engineeringState.runtime`
- 当前任务、下一步、自动推进、失败暂停与恢复边界应写入 `engineeringState.execution`
- `setGenerationStage(...)` 可继续作为兼容展示文案，但不能作为 runtime readiness 的唯一状态源
- Workspace 应以最新 workflow 消息中的 `engineeringState` 作为当前工程状态来源，避免刷新或恢复后只能从临时字符串推断 runtime 进度

方案选择状态也必须进入同一状态入口。第一版采用 `engineeringState.plan_selection` 表达候选方案与用户选择：

- 方案生成完成后应写入 `available_plan_ids / recommended_plan_id / ready / countdown_seconds / source_message_id`
- 用户手动确认、自动确认推荐方案、倒计时停止或重新规划时，应同步更新 `selected_plan_id / ready / countdown_seconds`
- `engineeringState.execution` 应表达“等待方案确认 / 已确认实现方案 / 准备方案选择”等当前任务与下一步
- `plan-options` 消息中的 `plans / recommendedPlanId / selectedPlanId / planStreamComplete` 只作为展示字段与历史兼容 fallback，新链路恢复方案选择状态时应优先读取 `engineeringState.plan_selection`

用户可见阶段任务也必须进入同一状态入口。第一版采用 `engineeringState.phase` 表达 Workspace 顶部可展示的阶段快照：

- `current_phase` 表达用户可理解的当前阶段，如 Foundation、方案分析、方案选择、运行时准备、实现阶段
- `current_task` 表达当前正在处理的具体任务；`next_action` 表达下一步动作
- `completed_tasks` 表达已完成项；`blockers` 表达阻塞项、门禁失败项或恢复原因
- 后端编排事件应从 `workflow / execution / validation / runtime / bootstrap / recovery` 归一化输出 `phase`
- 前端自生成的 `plan-selection / plan-approved / runtime-readiness` 状态也必须写入 `phase`
- Workspace 展示真实进度时应优先读取 `engineeringState.phase`，旧快照缺少该字段时才从 `engineeringState.execution` 兼容展示

## 13. 实施顺序建议

建议按五步落地，而不是一次做满：

### Phase A：文档与状态先行

- 定义 `BootstrapState`
- 定义 4 份产物
- 定义模板与最小决策分类

### Phase B：前端展示与确认

- 在 Workspace 中展示 Foundation 阶段
- 增加 `Foundation Panel`
- 支持确认 / 暂缓 / 预留扩展口

### Phase C：后端正式编排

- 建立 `bootstrap_orchestrator`
- 输出结构化 Foundation 阶段事件（内部事件名沿用 `bootstrap_*`）
- 与工程状态回写打通

### Phase D：门禁接入

- 把 Foundation Gate 接到 plan / implementation 之间
- 未完成关键前置决策时阻断 implementation

### Phase E：模板化与自动分类增强

- 接入项目类型模板
- 基于输入自动推荐 Foundation 模板
- 增加更强的行业和产品类型策略

## 14. 最小 MVP 建议

若只做第一版，建议先覆盖这六个域：

1. 用户体系
2. 权限体系
3. 国际化
4. 全局主题
5. 生命周期 / 状态机
6. 配置 / 错误 / 契约

原因：

- 这六类最容易在后期造成系统级返工
- 同时它们又最适合形成结构化状态和文档产物

## 15. 风险与反模式

### 15.1 反模式：把 Foundation 做成大问卷

后果：

- 用户疲劳
- AI 一次追问过多
- 流程变重

正确方式：

- 模板优先
- 高成本问题优先
- 低风险项默认建议

### 15.2 反模式：只出 markdown，不落状态

后果：

- 无法做门禁
- 无法稳定展示
- 后续阶段无法可靠复用

正确方式：

- 文档 + 结构化状态双轨

### 15.3 反模式：把 Foundation 变成可跳过的建议

后果：

- 仍然回到“先做业务，后补基础”

正确方式：

- Foundation 进入主链路
- 关键项未完成时触发 gate

## 16. 与现有路线的关系

Foundation System 最适合被视为以下能力的前置补全：

- `Task Orchestration Layer`
- `Engineering State Layer`
- `Execution Transparency Layer`
- `Policy & Gate Layer`

它不是与这些层平行的新系统，而是它们在项目启动阶段的第一落点。

## 17. 结论

YiStack 若要真正把 YES 从工程规则推进为工程系统，不能只覆盖：

- 计划
- 实现
- 验证

还必须覆盖：

- 在业务开发前，哪些工程基础问题必须先决策

因此，Project Foundation 最终应成为 YiStack 主链路中的正式阶段、正式状态、正式工件和正式门禁，而不是只停留在文档或聊天建议中。

## 18. 本轮冻结建议

若以当前版本进入后续实现，建议冻结以下范围：

1. 术语口径
   - 人类可读层统一使用 `Project Foundation / Foundation Stage`
   - 内部兼容名暂保留 `bootstrap_*`
2. 状态骨架
   - 冻结 `BootstrapState` 与 `BootstrapDecisionItem` 的 `v1` 字段集合
3. 工件集合
   - 冻结 4 份 Foundation 文档 + 1 份结构化状态快照
4. 事件骨架
   - 冻结 `bootstrap_*` 事件族和 `event_version = v1`
5. Gate 语义
   - 冻结 `allow / warn / block` 三档结果

本轮不冻结的内容：

- 更细的模板枚举扩展
- 行业专用决策项
- 是否最终彻底移除 `bootstrap_*` 内部兼容命名
- 更细粒度的 payload 字段

---

## 18. 相关实现输入文档

在真正进入代码实现前，还应继续参考：

- `docs/engineering/YISTACK_BOOTSTRAP_TEMPLATES_AND_DECISION_CATALOG.md`

它负责补齐：

- 第一版模板库
- 第一版决策项目录
- 第一版 gate 规则表

也就是说：

- 本文档回答“系统怎么做”
- `Templates and Decision Catalog` 回答“系统拿什么来做”
