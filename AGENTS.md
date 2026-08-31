# AGENTS.md

> 本文件是 YiStack 工程体系入口。
>
> AI 或人工在本仓库内开发时，应先读本文件，再按引用文档执行。

---

## 1. 必读顺序

进入开发前，按以下顺序理解约束：

1. `AGENTS.md`
2. `docs/engineering/YES.md`
3. `docs/engineering/PRINCIPLES.md`
4. `docs/engineering/ARCHITECTURE_RULES.md`
5. `docs/engineering/DEVELOPMENT_WORKFLOW.md`
6. `docs/engineering/AI_DEVELOPMENT_PROTOCOL.md`
7. `docs/engineering/CODING_STANDARD.md`
8. `docs/engineering/VALIDATION_LAYER.md`
9. `docs/roadmap/ROADMAP.md`
10. 本机存在 `docs/internal/` 时，读取其中与当前任务相关的内部计划和状态记录
11. 与当前任务直接相关的产品、架构、API、实现文档和代码

## 2. YES Kernel 与 Planning / Delivery 的边界

YES v2 不再只是文档集合，而是 YiStack 的 Engineering Kernel。

YES Kernel 当前包含五层：

1. Entry Layer
2. Principle Layer
3. Architecture Layer
4. Execution Layer
5. Validation Layer

Kernel 文档包括：

- `AGENTS.md`
- `docs/engineering/YES.md`
- `docs/engineering/PRINCIPLES.md`
- `docs/engineering/ARCHITECTURE_RULES.md`
- `docs/engineering/DEVELOPMENT_WORKFLOW.md`
- `docs/engineering/AI_DEVELOPMENT_PROTOCOL.md`
- `docs/engineering/CODING_STANDARD.md`
- `docs/engineering/VALIDATION_LAYER.md`

以下文档受 YES 约束，但不属于 YES Kernel 本体：

- `docs/engineering/YES_SYSTEM_ROADMAP.md`
- `docs/roadmap/ROADMAP.md`
- `docs/CHANGELOG.md`
- 本地私有 roadmap、阶段状态和实施记录（存在时）

它们属于 Planning / Delivery 层。

## 3. 默认开发规则

### 3.1 先分析，后编码

禁止未读上下文直接改代码。

开始开发前，至少要明确：

- 当前任务目标
- 影响范围
- 所属路线图阶段
- 相关模块边界
- 验证方式

### 3.2 非琐碎任务先计划

以下任务不能直接进入大规模编码，必须先给出实施计划并等待确认：

- 跨前后端
- 跨多个核心模块
- 涉及架构边界调整
- 涉及数据库结构、状态机、权限、容器、删除链路
- 存在多个可行方案且差异明显

极小修复可直接执行，但仍需完成最小影响分析与验证。

若任务涉及 runtime、容器、代理、鉴权、WebSocket/SSE、终端、异步任务，还必须先写出一份“真实运行链路清单”，至少说明：

- 请求起点
- 中间转发层
- 最终后端落点
- 关键状态码 / 日志 / 错误表现
- 计划如何验证真实失败点

### 3.3 不允许跳过流程

标准顺序应为：

需求澄清  
↓  
上下文读取  
↓  
影响分析  
↓  
实施计划  
↓  
编码实现  
↓  
验证  
↓  
文档回写  
↓  
完成说明

### 3.4 路线图外能力默认不优先

开发前先确认是否属于 `docs/roadmap/ROADMAP.md` 当前阶段。

若不属于当前优先级范围：

- 先说明原因
- 先更新路线图或任务文档
- 再进入实现

### 3.5 开发阶段默认不保留猜测式兼容

当前处于快速开发和收敛阶段。

- 若没有已确认的存量数据、调用方或迁移窗口，不为历史兼容保留额外常量、分支或默认回退
- 发现默认值、策略或主链路方向错误时，优先直接修到当前目标状态
- 若确实需要兼容，必须写明原因、影响范围和后续清理条件

### 3.6 运行时问题先证据后修复

对于真实环境中的异常、连接失败、状态错乱、容器问题、代理问题：

- 先收集证据，再修改核心逻辑
- 优先使用日志、状态码、运行输出、浏览器报错确认失败点
- 若证据不足，可先加最小诊断手段
- 不允许只凭静态阅读直接断定根因并大改实现

## 4. 架构硬约束

### 后端

- `handler` 只能承载协议层逻辑，不直接堆业务编排
- `service` 负责业务编排
- `repository` 只负责持久化
- `pkg` 只负责通用能力

禁止：

- `handler` 直接串多个 repo 完成完整业务
- `repository` 直接承担 runtime / HTTP / 权限决策
- 把文件、Git、容器、持久化、HTTP 逻辑揉在一个函数里

### 前端

- 页面负责交互组织，不应散落过多协议拼装
- `Workspace` 改动必须特别检查消息流、文件树、编辑器、Git、预览的一致性
- 前端状态不能长期伪造后端真实状态
- 涉及终端、流式任务、长连接、异步操作的 UI，必须补上异常恢复入口，如关闭、重连、重启、重试

### 状态值

新增或修改状态值前，必须同时检查：

- 数据库约束
- 后端状态机
- 前端类型定义
- UI 渲染分支

不允许只改其中一层。

### 连接 / 会话 / 流式任务

新增或修改以下能力时：

- 终端
- WebSocket / SSE
- 长连接任务
- 有持续状态的异步任务

必须显式检查：

- 生命周期是否完整
- tab 切换 / 页面离开时是否符合预期
- 超时、关闭、异常、恢复路径是否完整
- 是否存在重复连接、重复请求、重复订阅

## 5. 文档职责

- `PRODUCT.md`：产品定位、功能边界、版本方向
- `ARCHITECTURE.md`：架构设计与推荐实现
- `docs/engineering/*`：YES Kernel 文档，负责工程原则、架构、执行与验证
- `docs/roadmap/ROADMAP.md`：Planning 层，负责阶段路线图与优先级
- `docs/CHANGELOG.md`：Delivery 层，负责面向用户和贡献者的公开变更记录
- 本地私有文档：负责细粒度任务、阶段状态和实施过程，不进入公开仓库

## 6. 完成前必须检查

任何代码修改后，至少执行一轮基础自检：

- `pnpm yes:validate`

只通过编译不算完成。涉及接口、代理、状态机、异步任务时，还必须检查：

- 错误返回是否仍为结构化 JSON
- 是否引入数据库约束冲突
- 是否引入前后端状态不一致

修改以下链路时，必须做最小回归检查：

- 列表页
- `workspace`
- 容器运行时
- 项目删除链路
- 文件树 / 文件读写
- Git 相关能力

涉及以下改动时，额外必须检查：

- WebSocket / SSE / 终端：真实握手、异常关闭、恢复入口
- runtime / 默认值 / fallback：代码常量、配置文件、SQL 种子、migration、测试是否一致

## 7. 文档同步规则

出现以下情况时，必须同步文档：

- API 新增、修改、删除
- 架构边界变化
- 路线图优先级变化
- 重要工程规范变化
- 关键行为变化或重要修复

## 8. 当前阶段总原则

当前阶段优先级：

1. YES Engineering Kernel v2
2. 核心主链路稳定
3. 工作台可持续开发能力

除阻断主流程、安全、数据正确性问题外，默认暂停扩展性业务功能。
