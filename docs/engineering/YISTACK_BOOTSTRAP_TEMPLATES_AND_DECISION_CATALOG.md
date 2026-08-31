# YiStack Project Foundation Templates and Decision Catalog

> 本文档定义 YiStack Project Foundation System 的第一版模板库、决策项目录和最小门禁规则。
>
> 它的目标是把 Project Foundation 从“抽象框架”推进到“可枚举、可实现、可验证”的输入层。
>
> 说明：为避免与前端 Bootstrap UI 框架混淆，本文档默认使用 `Project Foundation` 作为人类可读术语；文中若保留 `bootstrap` 结构名，视为内部兼容别名。

---

## 1. 文档定位

本文档是以下两份文档的直接补充：

- `docs/engineering/YES_BOOTSTRAP_FRAMEWORK.md`
- `docs/engineering/YISTACK_BOOTSTRAP_SYSTEM_DESIGN.md`

其中：

- `YES_BOOTSTRAP_FRAMEWORK`
  - 定义为什么要做 Project Foundation，以及应检查哪些域
- `YISTACK_BOOTSTRAP_SYSTEM_DESIGN`
  - 定义 Project Foundation 在 YiStack 中如何建模、展示、编排和门禁
- 本文档
  - 定义第一版模板、决策项、默认建议和 gate 规则表

## 2. 目标

本目录解决三个问题：

1. 不同项目类型应该优先问什么
2. 哪些项必须先决策，哪些只需预留边界，哪些可以暂缓
3. 哪些未完成项会阻断进入 implementation

## 3. 决策桶定义

所有 Project Foundation 决策项都应归入以下三类之一：

- `must_decide_now`
  - 现在不定，后续返工成本高
- `reserve_extension_now`
  - 本轮可不实现，但架构上必须预留边界
- `defer_with_record`
  - 本轮明确暂缓，但必须写入暂缓登记

## 4. 决策项标准结构

建议每个目录项至少包含：

```ts
type BootstrapDecisionCatalogItem = {
  id: string;
  domain: string;
  title: string;
  bucket: 'must_decide_now' | 'reserve_extension_now' | 'defer_with_record';
  default_owner: 'user' | 'ai' | 'shared';
  default_recommendation?: string;
  why_now: string;
  gate_level: 'hard_block' | 'warn_only' | 'record_only';
  artifact_targets: string[];
};
```

## 5. 跨模板通用核心决策项

以下项默认适用于大多数项目。

### 5.1 Identity

1. `identity.auth_mode`
   - 标题：身份认证方式
   - 桶：`must_decide_now`
   - 建议：邮箱登录 / 邀请制 / SSO 三选一
   - gate：`hard_block`

2. `identity.user_model`
   - 标题：用户实体与资料模型
   - 桶：`must_decide_now`
   - gate：`hard_block`

3. `identity.user_status`
   - 标题：用户状态机
   - 桶：`must_decide_now`
   - gate：`hard_block`

### 5.2 Authorization

4. `authz.permission_model`
   - 标题：权限模型
   - 桶：`must_decide_now`
   - 建议：RBAC 优先，ABAC 视场景预留
   - gate：`hard_block`

5. `authz.scope_model`
   - 标题：权限作用域
   - 桶：`must_decide_now`
   - gate：`hard_block`

6. `authz.resource_permissions`
   - 标题：资源级权限预留
   - 桶：`reserve_extension_now`
   - gate：`warn_only`

### 5.3 I18n and Theme

7. `ui.i18n_strategy`
   - 标题：国际化策略
   - 桶：`must_decide_now`
   - gate：`hard_block`

8. `ui.default_locale`
   - 标题：默认语言
   - 桶：`must_decide_now`
   - gate：`warn_only`

9. `ui.theme_strategy`
   - 标题：主题策略
   - 桶：`must_decide_now`
   - 建议：light / dark / system
   - gate：`warn_only`

10. `ui.design_tokens`
   - 标题：Design Token 规范
   - 桶：`must_decide_now`
   - gate：`warn_only`

### 5.4 Contract and Config

11. `contract.api_shape`
   - 标题：接口契约规范
   - 桶：`must_decide_now`
   - gate：`hard_block`

12. `contract.error_model`
   - 标题：错误模型与错误码
   - 桶：`must_decide_now`
   - gate：`hard_block`

13. `config.source_of_truth`
   - 标题：配置真源
   - 桶：`must_decide_now`
   - gate：`hard_block`

14. `config.feature_flags`
   - 标题：Feature Flag 预留
   - 桶：`reserve_extension_now`
   - gate：`warn_only`

### 5.5 Lifecycle and State

15. `lifecycle.project_state_machine`
   - 标题：项目状态机
   - 桶：`must_decide_now`
   - gate：`hard_block`

16. `lifecycle.runtime_state_machine`
   - 标题：运行时状态机
   - 桶：`must_decide_now`
   - gate：`hard_block`

17. `lifecycle.recovery_strategy`
   - 标题：恢复与回滚策略
   - 桶：`reserve_extension_now`
   - gate：`warn_only`

### 5.6 Security and Audit

18. `security.secret_management`
   - 标题：密钥与 Secret 管理
   - 桶：`must_decide_now`
   - gate：`hard_block`

19. `security.input_validation`
   - 标题：输入输出校验策略
   - 桶：`must_decide_now`
   - gate：`hard_block`

20. `security.audit_log`
   - 标题：审计日志
   - 桶：`reserve_extension_now`
   - gate：`warn_only`

## 6. 模板一：Admin Console

模板标识：`admin_console`

适用场景：

- 管理后台
- 内部管理面板
- 运营后台
- 企业控制台

### 6.1 优先决策项

#### 必须现在定

- `identity.auth_mode`
- `authz.permission_model`
- `authz.scope_model`
- `authz.menu_permissions`
- `authz.button_permissions`
- `security.audit_log_scope`
- `ui.i18n_strategy`
- `ui.theme_strategy`
- `contract.error_model`

#### 必须预留扩展口

- `identity.sso_oidc`
- `identity.organization_model`
- `authz.data_permissions`
- `ui.brand_theme`
- `observability.admin_operations_metrics`

#### 可暂缓但必须登记

- `security.mfa`
- `release.canary_strategy`
- `accessibility.screen_reader_support`

### 6.2 默认建议

- 认证：后台登录 + 预留 SSO
- 权限：RBAC
- 菜单权限：开启
- 按钮权限：开启
- API 权限：开启
- 审计日志：关键管理动作必须记录

## 7. 模板二：AI Agent Platform

模板标识：`ai_agent_platform`

适用场景：

- Agent 平台
- 多模型 AI 工作台
- Tool / Skill / MCP 平台

### 7.1 优先决策项

#### 必须现在定

- `ai.provider_registry`
- `ai.model_registry`
- `ai.prompt_versioning`
- `ai.workflow_state_machine`
- `ai.tool_registry_contract`
- `ai.context_policy`
- `ai.audit_log`
- `cost.token_cost_model`
- `security.prompt_injection_policy`

#### 必须预留扩展口

- `ai.skill_registry`
- `ai.mcp_provider`
- `ai.memory_strategy`
- `ai.knowledge_strategy`
- `runtime.provider_replaceability`
- `billing.project_cost_center`

#### 可暂缓但必须登记

- `ai.marketplace`
- `ai.fine_tuning`
- `ai.multi_agent_collaboration_policy`

### 7.2 默认建议

- Provider 与 Model 分离管理
- Prompt 必须版本化
- Tool / Skill / MCP 契约独立
- Token 成本必须可统计到项目维度

## 8. 模板三：SaaS App

模板标识：`saas_app`

适用场景：

- 面向终端客户的 Web SaaS
- 多租户业务平台

### 8.1 优先决策项

#### 必须现在定

- `identity.user_model`
- `identity.tenant_model`
- `identity.organization_model`
- `authz.permission_model`
- `authz.project_scope`
- `billing.quota_model`
- `contract.api_shape`
- `config.source_of_truth`
- `data.audit_fields`

#### 必须预留扩展口

- `billing.subscription_model`
- `billing.invoice_model`
- `feature_flags.rollout_strategy`
- `observability.customer_metrics`

#### 可暂缓但必须登记

- `billing.usage_billing`
- `release.blue_green_strategy`
- `security.advanced_mfa`

### 8.2 默认建议

- 优先支持 tenant + organization 的最小模型
- 权限先用 RBAC，数据权限做扩展口
- 配额至少到 tenant / project 两级

## 9. 模板四：Internal Tool

模板标识：`internal_tool`

适用场景：

- 内部效率工具
- 部门级辅助系统

### 9.1 优先决策项

#### 必须现在定

- `identity.auth_mode`
- `authz.permission_model`
- `contract.error_model`
- `config.source_of_truth`
- `ui.i18n_strategy`

#### 必须预留扩展口

- `identity.sso_oidc`
- `authz.audit_log`
- `observability.health_check`

#### 可暂缓但必须登记

- `ui.brand_theme`
- `release.canary_strategy`

### 9.2 默认建议

- 优先最小 SSO/企业登录兼容
- 权限先做 RBAC-lite
- 重点控制配置真源和错误模型，不要让内部工具失控长大

## 10. Gate 规则表

### 10.1 Hard Block

以下类型默认属于 `hard_block`：

- 身份认证方式未定
- 权限模型未定
- 核心状态机未定
- 契约规范未定
- 错误模型未定
- 配置真源未定
- Secret 管理未定
- AI 平台中的 Provider / Prompt / Tool 契约未定

### 10.2 Warn Only

以下类型默认属于 `warn_only`：

- 主题策略
- Design Token
- 资源级权限扩展口
- Feature Flag 扩展口
- 恢复策略
- 品牌主题
- 观测指标扩展口

### 10.3 Record Only

以下类型默认属于 `record_only`：

- MFA 暂缓
- Canary / Blue-Green 暂缓
- Marketplace 暂缓
- Fine-tuning 暂缓
- 高级计费体系暂缓

## 11. 产物映射建议

不同决策项应写入不同工件：

- `foundation-brief.md`
  - 当前模板、总体范围、核心前置决策摘要
- `engineering-policy.md`
  - 权限、配置、错误、日志、AI 执行硬规则
- `architecture-lifecycle-spec.md`
  - 状态机、生命周期、契约、运行时基础
- `deferred-decisions.md`
  - 所有暂缓项和触发条件

## 12. 第一版实现建议

若只做第一版，建议先把以下内容做成可落地数据源：

1. 四个模板
2. 二十个跨模板通用决策项
3. 每个模板 8-12 个高优先级项
4. 三档 gate 规则

这样前端可以先展示，后端可以先编排，Validation 可以先读状态，不需要一开始就覆盖所有项目类型。

## 13. 后续扩展方向

后续可继续补：

- `content_platform`
- `developer_platform`
- `mobile_app`
- `mini_program`
- 行业模板（金融 / 教育 / 医疗 / 企业 IT）
- 合规模板（PII / 审计 / 数据驻留）

---

## 14. 结论

Project Foundation 真正能否落地，不取决于有没有框架，而取决于有没有：

- 可枚举的模板
- 可执行的决策目录
- 可判断的 gate 规则

本文档的作用，就是把这三者的第一版基线先建立起来。
