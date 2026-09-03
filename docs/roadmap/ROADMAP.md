# YiStack Roadmap

[**简体中文**](ROADMAP.md) | [English](ROADMAP.en.md)

> 本文件是公开路线图的中文主版本。中英文内容不一致时，以本文件为准。
>
> 本文档定义 YiStack 的阶段路线图与开发优先级。
>
> 它回答的是“现在应该先做什么、后做什么、哪些事情暂时不要做”。
>
> 面向用户的变更记录由 `docs/CHANGELOG.md` 维护，完成状态必须由可执行门禁
> 验证。详细任务流水、阶段状态和迁移过程属于本地开发资料，不随公开仓库
> 发布。

---

## 1. 当前策略

当前阶段的最高优先级是：

**沿已稳定的生成质量闭环继续建设差异化输入与协作能力。**

本文件是公开仓库唯一的 roadmap 真源。内部开发仍可维护更细的任务流水，
但公开状态与优先级必须同步回本文件。

因此，当前主线顺序调整为：

1. `LT-02R` R1-R7 已完成并通过 Production Gate：生成真实性、项目 Gate、patch/repair、持久 Job/SSE、浏览器 benchmark、平台集成与 Contributor Alpha 仓库门禁均已落地
2. `VIS-001` 已完成：截图/参考图经真实多模态模型提取 `visual_context.v1`，并贯穿方案、消息、持久 Job、SSE 恢复和代码生成
3. `COLLAB-001` 已完成：共享工作区具备持久 presence、SSE cursor replay、后端资源事件审计、SHA-256 并发保护和 dirty buffer 冲突提示
4. GitHub remote、required Actions checks 与 branch protection 已启用；v1.0.0 后继续通过受控 pull request 接受社区贡献
5. 多部署 Provider 真实云端 lifecycle 与首个存量升级 tag 的 migration runner 按既定边界集中验收

`LT-02R` 是对 LT-02 / LT-03 / LT-06 的返修，不新增 `LT-09`，也不改变原 8 个产品阶段编号。

当前主链路体验上，还要同步补齐一项关键目标：

- 让用户能看到 AI 当前真实处于哪个阶段、正在执行哪个任务、为什么阻塞、下一步是什么
- 让用户在批准总体方案后，不必为同一计划下的每个小任务重复输入“继续”

## 2. 当前冻结项

除以下情况外，暂缓新增大型业务功能：

- 阻断主链路的 bug
- 安全问题
- 数据一致性问题
- 明显影响核心体验的问题
- YES 体系建设所需改造

当前不作为优先目标推进：

- Plugin Marketplace
- 与主链路无关的装饰性功能
- 新的 LT-08 readiness-only 细分任务

Deploy、自定义域名、协作和模板不再永久冻结，但只能在 `LT-02R` R5 的项目质量、持久任务和浏览器验收门禁稳定后，按 R6.3 / R6.4 顺序进入。

## 3. 阶段路线图

### Milestone A：YES Engineering Kernel v2

目标：

- 建立 YES Engineering Kernel 的最小闭环
- 让 AI 与人工开发 YiStack 时有明确约束
- 让 YES 不再只是文档集合，而具备最小 Validation 入口
- 把 `AGENTS.md` 从零散规则改为 Kernel 入口

范围：

- Engineering Principles
- Architecture Layer
- Execution Layer
- Validation Layer
- Architecture Rules
- Development Workflow
- AI Development Protocol
- Coding Standard
- Entry Layer

### Milestone B：核心主链路稳定

目标：

- 按新架构图与目标态工程交互流程收敛核心主链路
- 稳定 “需求路由 -> 澄清 -> 设计 -> 实现 -> 验证 -> 预览” 主链路
- 降低工作台回归率
- 收敛主链路 bug
- 让主链路阶段、任务、阻塞与下一步对用户透明
- 让已批准计划下的小任务能默认自动连续推进

范围：

- Workspace
- 需求路由与方案链路
- SSE
- 文件操作
- Git
- 预览
- runtime 稳定性
- YES 规则进入主链路执行过程
- 用户可见的阶段 / 任务 / 进度 / 阻塞信息
- 批准计划后的自动推进与暂停确认边界

### Milestone B-R：核心生成质量返修

目标：

- 消除 LLM 结果解析失败、命令失败和项目验证失败后的伪成功
- 在生成项目容器内执行 stack-aware build / test / lint
- 建立文件级 patch、有限自动修复和失败现场证据
- 让 Generation Job、SSE event 和终态可持久化、可回放、可恢复
- 用浏览器验收和 canonical benchmark 量化生成质量

范围：

- GenerationResult Schema / tool-call
- Project Validation Gate
- File patch / repair loop
- Supabase Job / Attempt / Event
- SSE replay / lease / heartbeat
- Playwright console / network / DOM / screenshot acceptance
- Generation benchmark / eval

### Milestone C：可持续开发能力

目标：

- 让项目可持续迭代，不只是一轮生成
- 让项目在方案和 MVP 前先具备最小工程前置设计能力
- 开始把目标态架构中的编排、状态与技能能力内化进系统
- 把内部编排状态稳定映射为用户可理解的执行透明度

范围：

- Project Foundation Stage / Foundation Artifacts / Foundation Gate
- VIS-001 visual context：图片上传/粘贴、vision capability 门禁、结构化分析与生成约束（Done）
- COLLAB-001 shared workspace collaboration：presence、资源事件、恢复与冲突保护（Done）
- Task Orchestration Layer
- Engineering State Layer
- Execution Transparency Layer
- Skill / MCP 能力接入
- 项目记忆层增强
- 工作台恢复
- 更强的 diff / rollback
- 更可靠的调试与日志

### Milestone D：专业版效率能力

目标：

- 提升单项目开发效率与协作效率

范围：

- Prompt 管理
- 更强模型治理
- 自动备份
- 资源监控
- 更好的 Git 能力

### Milestone E：企业级治理

目标：

- 企业身份、组织、审计、资源治理、私有部署

当前顺序：

- 保持 In Progress 状态，但在 Milestone B-R 的 P0 / P1 完成前不新增 readiness-only 切片
- 只优先处理安全、数据正确性和核心主链路阻断

### Milestone F：产品集成与社区开放

目标：

- 建立 Supabase 应用后端预设、GitHub 导入/同步和至少一个真实部署/域名闭环
- 完成许可证、CI、贡献规范、安全策略、lint-clean、可复现安装和升级边界
- 按 Public Preview -> Contributor Alpha -> Community Beta 分级开放

范围：

- Supabase auth / schema / RLS / storage preset（R6.1 Done）
- GitHub App 或 OAuth 导入与同步
- 部署适配器、自定义域名和回滚
- 最小项目协作和版本化官方模板
- Open source governance / CI / security / upgrade policy

## 4. 路线图约束

- Roadmap 外的能力，默认不优先开发
- 非主链路功能必须说明其所属里程碑
- 若要调整顺序，应先更新本文件，再进入实现
