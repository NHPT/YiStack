# YES System Roadmap

> 本文档定义 YES 如何从当前的工程体系，逐步演进为可执行、可验证、可交付的工程系统。
>
> 本文档不是 YES Kernel 本体的一部分，而是 YES 的演进路线说明。

---

## 1. 当前定位

当前阶段应明确：

- **YES**：工程体系为主，带最小系统化雏形
- **YiStack**：当前真实运行的软件系统

因此，当前不应把 YES 误判为“已经完整落地的工程系统”。

当前更准确的关系是：

- YiStack 遵循 YES
- YES 约束 YiStack 的开发方式
- YiStack 将逐步把 YES 内化为系统能力

## 2. 最终目标

YES 的最终目标不是只保留为文档体系，而是演进为：

**Specification + Execution Engine + Validation Engine + Delivery Engine + Feedback Loop**

当这些能力都以软件形式被承载时，YES 才能从工程体系演进为工程系统。

## 3. 当前缺少的能力层

### 3.1 Task Orchestration Layer

缺少内容：

- Project Foundation Stage（项目启动前置设计阶段，内部别名 bootstrap）
- 任务阶段状态机
- 阶段推进器
- 输入产物 / 输出产物约束
- 已批准计划下的自动连续推进策略
- 自动推进的暂停条件与升级确认边界

作用：

- 让“想法 -> Foundation -> 方案 -> 实现 -> 验证”形成稳定主链路
- 让“需求 -> 分析 -> 实现 -> 验证 -> 发布”不再只靠人工或 AI 自觉遵守
- 让用户批准一次总体计划后，不必为同一计划下的每个小任务重复确认

### 3.2 Engineering State Layer

缺少内容：

- 任务状态
- 验证状态
- 发布状态
- 上线状态
- 缺陷回流状态
- 用户可见的阶段状态
- 用户可见的当前任务、已完成项、阻塞项与下一步

作用：

- 让系统知道当前任务进行到哪一步，而不是只靠聊天上下文和文档推断

### 3.3 Execution Transparency Layer

缺少内容：

- 可面向用户展示的阶段清单
- 可面向用户展示的任务清单
- 当前阶段 / 当前任务 / 进度 / 阻塞原因 / 下一步动作的结构化快照
- 从系统内部状态到用户可读信息的稳定映射

作用：

- 让用户不必靠猜测理解 AI 当前做到哪一步
- 让“AI 正在做什么”从黑盒过程变成可观察过程
- 让用户能在阶段、任务和阻塞层面给出更有效的反馈

### 3.3A Context Governance / Memory Isolation Layer

缺少内容：

- 项目级记忆命名空间
- 用户级 / 项目级 / 任务级 / 阶段级上下文分层
- Source of Truth 优先级规则
- 对话压缩摘要的使用边界
- 上下文冲突检测与升级确认

作用：

- 让系统在多项目并行时不依赖“模型自己分辨”
- 让摘要只承担恢复阅读效率，而不是覆盖真实状态
- 让结构化状态、已确认工件和当前仓库事实成为稳定真源

### 3.4 Policy & Gate Layer

缺少内容：

- 规则引擎
- 自动阻断
- 阶段门禁

作用：

- 让 YES 的规则能被自动执行，而不是只停留在原则与提示

### 3.5 Validation Automation Layer

缺少内容：

- 架构边界扫描
- 配置一致性扫描
- 状态机一致性扫描
- 文档同步检查
- 关键链路回归脚本

作用：

- 让验证结果成为系统状态，而不是零散人工结论

### 3.6 Release & Delivery Layer

缺少内容：

- 版本号管理
- 发布流程
- 上线流程
- 回滚机制

作用：

- 让 YES 不只约束开发和验证，还能覆盖交付闭环

### 3.7 Runtime Feedback Layer

缺少内容：

- 发布后监控
- 错误采集
- 巡检结果回流

作用：

- 让发布后的问题能回到工程系统，而不是落在对话或手工排查中

### 3.8 Iteration Loop Layer

缺少内容：

- 新需求进入后的影响分析
- 缺陷回流后的下一轮任务编排
- 迭代历史与演进轨迹

作用：

- 让 YES 覆盖持续迭代，而不是只覆盖单次实现

## 4. 推荐演进阶段

### Phase 1：YES Engineering Kernel

目标：

- 稳定 Entry / Principle / Architecture / Execution / Validation 五层结构
- 让 YES 先成为一套稳定可执行的工程体系

当前状态：

- 进行中

### Phase 2：Execution System

目标：

- 把项目启动前置设计从文档建议推进为系统阶段
- 把任务推进和阶段状态从文档与对话中抽离出来
- 建立任务状态机与阶段推进器
- 让阶段、任务和阻塞状态能够被稳定地展示给用户

关键能力：

- Project Foundation Stage / Foundation Artifacts / Foundation Gate
- Task Orchestration Layer
- Engineering State Layer
- Execution Transparency Layer
- Context Governance / Memory Isolation Layer

补充要求：

- 已批准计划下的小任务默认自动推进
- 只有关键决策点、风险点、门禁阻断或需求分歧时才暂停确认

### Phase 3：Validation System

目标：

- 把规范检查从“建议 + 手工验证”升级为“自动门禁 + 自动阻断”

关键能力：

- Policy & Gate Layer
- Validation Automation Layer

### Phase 4：Delivery System

目标：

- 让 YES 覆盖版本、发布、上线、回滚和交付闭环

关键能力：

- Release & Delivery Layer

### Phase 5：Closed-loop Engineering System

目标：

- 形成“需求 -> 分析 -> 实现 -> 验证 -> 审计 -> 发布 -> 上线 -> 反馈 -> 下一轮迭代”的持续闭环

关键能力：

- Runtime Feedback Layer
- Iteration Loop Layer

## 5. 当前优先级建议

当前最值得优先补的软件能力不是发布系统，而是：

1. `Task Orchestration Layer`
2. `Engineering State Layer`
3. `Execution Transparency Layer`
4. `Validation Automation Layer`

原因：

- 没有任务编排，YES 仍主要靠人工和 AI 记流程
- 没有工程状态，系统无法知道任务当前进行到哪
- 没有透明展示，用户无法知道 AI 当前正在做什么、为什么阻塞、下一步是什么
- 没有验证自动化，YES 仍然很难形成真正的门禁

## 6. 当前结论

因此，当前阶段应坚持以下表述：

- YES 现在主要是工程体系
- YiStack 现在是遵循 YES 的软件系统
- YES 的未来方向，是逐步内化为 YiStack 的 Engineering Kernel 子系统
