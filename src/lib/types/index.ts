/**
 * YiStack - 核心类型定义
 * 基于道家"道生一，二生三，三生万物"的设计理念
 */

// ============== 用户意图 ==============

/**
 * 用户输入的结构化表示
 * "道生一" - 最简单的输入转化为结构化需求
 */
export interface UserIntent {
  /** 原始输入 */
  rawInput: string;
  
  /** 意图类型 */
  intentType: IntentType;
  
  /** 应用类型 */
  appType: AppType;
  
  /** 功能需求列表 */
  features: FeatureList;
  
  /** 样式偏好 */
  style?: StylePreference;
  
  /** 技术栈偏好 */
  techStack?: TechStack;
  
  /** 附加约束 */
  constraints?: Constraints;
}

/** 意图类型 */
export type IntentType = 
  | 'create'      // 创建新应用
  | 'modify'      // 修改现有应用
  | 'extend'      // 扩展现有应用
  | 'template';   // 基于模板创建

/** 应用类型 */
export type AppType = 
  | 'dashboard'   // 数据仪表盘
  | 'form'        // 表单收集
  | 'landing'     // 落地页
  | 'blog'        // 博客
  | 'crud'        // CRUD 应用
  | 'todo'        // 待办事项
  | 'admin'       // 管理后台
  | 'portfolio'   // 个人作品集
  | 'ecommerce'   // 电商页面
  | 'unknown';    // 未知类型

export type FeatureList = Feature[];
export type FeatureComponent = string;
export type FeatureComponentList = FeatureComponent[];

/** 功能特性 */
export interface Feature {
  /** 功能名称 */
  name: string;
  
  /** 功能描述 */
  description?: string;
  
  /** 功能优先级 */
  priority: 'required' | 'optional' | 'nice-to-have';
  
  /** 关联组件 */
  components?: FeatureComponentList;
}

/** 样式偏好 */
export interface StylePreference {
  /** 主题 */
  theme: 'light' | 'dark' | 'auto';
  
  /** 风格 */
  style: 'modern' | 'minimal' | 'corporate' | 'playful' | 'elegant';
  
  /** 主色调 */
  primaryColor?: string;
  
  /** 字体偏好 */
  fontPreference?: 'sans' | 'serif' | 'mono';
}

/** 技术栈偏好 */
export interface TechStack {
  /** 前端框架 */
  frontend: 'react' | 'vue' | 'svelte' | 'nextjs';
  
  /** UI 框架 */
  uiFramework?: 'tailwind' | 'shadcn' | 'material' | 'antd';
  
  /** 状态管理 */
  stateManagement?: 'zustand' | 'recoil' | 'jotai' | 'context';
  
  /** 是否使用 TypeScript */
  typescript: boolean;
}

export type ConstraintTargetAudience = string;
export type ConstraintTargetAudienceList = ConstraintTargetAudience[];
export type ConstraintDevice = 'desktop' | 'tablet' | 'mobile';
export type ConstraintDeviceList = ConstraintDevice[];

/** 约束条件 */
export interface Constraints {
  /** 预算 */
  budget?: 'free' | 'low' | 'medium' | 'high';
  
  /** 时间要求 */
  timeline?: 'asap' | 'week' | 'month';
  
  /** 目标用户 */
  targetAudience?: ConstraintTargetAudienceList;
  
  /** 设备支持 */
  devices?: ConstraintDeviceList;
}

// ============== 模板相关 ==============

export type TemplateTag = string;
export type TemplateTagList = TemplateTag[];
export type TemplateFileList = TemplateFile[];
export type TemplateVariableList = TemplateVariable[];
export type TemplateExamplePrompt = string;
export type TemplateExamplePromptList = TemplateExamplePrompt[];
export type TemplateFileDependency = string;
export type TemplateFileDependencyList = TemplateFileDependency[];
export type TemplateVariableOption = string;
export type TemplateVariableOptionList = TemplateVariableOption[];

/**
 * 模板定义
 * "二生三" - 从意图到具体模板
 */
export interface Template {
  /** 模板 ID */
  id: string;
  
  /** 模板名称 */
  name: string;
  
  /** 模板描述 */
  description: string;
  
  /** 分类 */
  category: AppType;
  
  /** 标签 */
  tags: TemplateTagList;
  
  /** 缩略图 URL */
  thumbnail?: string;
  
  /** 模板文件结构 */
  files: TemplateFileList;
  
  /** 模板变量 */
  variables: TemplateVariableList;
  
  /** 最小输入要求 */
  minInput?: string;
  
  /** 示例提示词 */
  examples: TemplateExamplePromptList;
  
  /** 是否是高级模板 */
  isPremium: boolean;
  
  /** 最低版本要求 */
  minPlan: 'free' | 'pro' | 'enterprise';
  
  /** 元数据 */
  metadata: {
    author?: string;
    version: string;
    lastUpdated: string;
    downloads: number;
  };
}

/** 模板文件 */
export interface TemplateFile {
  /** 文件路径 */
  path: string;
  
  /** 文件内容（模板语法） */
  content: string;
  
  /** 文件类型 */
  type: 'component' | 'page' | 'layout' | 'config' | 'style' | 'utility';
  
  /** 依赖关系 */
  dependencies?: TemplateFileDependencyList;
}

/** 模板变量 */
export interface TemplateVariable {
  /** 变量名 */
  name: string;
  
  /** 变量类型 */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  
  /** 默认值 */
  defaultValue?: unknown;
  
  /** 描述 */
  description?: string;
  
  /** 是否必填 */
  required: boolean;
  
  /** 候选值 */
  options?: TemplateVariableOptionList;
}

// ============== 代码生成 ==============

export type GeneratedFileList = GeneratedFile[];
export type PackageInfoList = PackageInfo[];

/**
 * 生成结果
 * "三生万物" - 从模板到完整应用
 */
export interface GenerationResult {
  /** 生成 ID */
  id: string;
  
  /** 原始输入 */
  originalInput: string;
  
  /** 结构化意图 */
  intent: UserIntent;
  
  /** 使用的模板 */
  template?: Template;
  
  /** 生成的文件列表 */
  files: GeneratedFileList;
  
  /** 依赖包 */
  dependencies: PackageInfoList;
  
  /** 生成状态 */
  status: GenerationStatus;
  
  /** 错误信息（如果有） */
  error?: string;
  
  /** 生成耗时（毫秒） */
  duration: number;
  
  /** 创建时间 */
  createdAt: Date;
}

/** 生成的文件 */
export interface GeneratedFile {
  /** 文件路径 */
  path: string;
  
  /** 文件内容 */
  content: string;
  
  /** 文件类型 */
  type: 'component' | 'page' | 'layout' | 'config' | 'style' | 'utility';
  
  /** 文件大小（字节） */
  size: number;
}

/** 生成状态 */
export type GenerationStatus = 
  | 'pending'     // 待处理
  | 'parsing'     // 解析意图中
  | 'matching'    // 匹配模板中
  | 'generating'  // 生成代码中
  | 'validating'  // 验证中
  | 'completed'  // 完成
  | 'failed';     // 失败

/** 包信息 */
export interface PackageInfo {
  /** 包名 */
  name: string;
  
  /** 版本 */
  version: string;
  
  /** 是否是开发依赖 */
  isDev: boolean;
}

// ============== 流式响应 ==============

/**
 * 流式生成进度
 */
export interface GenerationProgress {
  /** 当前阶段 */
  stage: GenerationStatus;
  
  /** 进度百分比 */
  progress: number;
  
  /** 当前步骤描述 */
  message: string;
  
  /** 增量生成的代码 */
  delta?: string;
  
  /** 文件路径 */
  filePath?: string;
}

// ============== 预览相关 ==============

/**
 * 预览信息
 */
export interface PreviewInfo {
  /** 预览 ID */
  id: string;
  
  /** 预览类型 */
  type: 'iframe' | 'codesandbox' | 'stackblitz';
  
  /** 预览 URL */
  url: string;
  
  /** 嵌入代码（如果是 iframe） */
  embedCode?: string;
  
  /** 端口（如果是本地预览） */
  port?: number;
}

// ============== 插件系统 ==============

/**
 * 插件元数据
 */
export interface PluginMetadata {
  /** 插件 ID */
  id: string;
  
  /** 插件名称 */
  name: string;
  
  /** 版本 */
  version: string;
  
  /** 作者 */
  author?: string;
  
  /** 描述 */
  description?: string;
  
  /** 插件类型 */
  type: PluginType;
  
  /** 依赖的引擎版本 */
  engineVersion: string;
}

/** 插件类型 */
export type PluginType = 
  | 'template'     // 模板插件
  | 'component'    // 组件库插件
  | 'model'        // AI 模型插件
  | 'tool'         // 工具插件
  | 'integration'; // 第三方集成插件

// ============== API 相关 ==============

/**
 * 生成请求
 */
export interface GenerateRequest {
  /** 用户输入 */
  input: string;
  
  /** 可选的模板 ID */
  templateId?: string;
  
  /** 可选的配置 */
  options?: GenerateOptions;
}

/** 生成选项 */
export interface GenerateOptions {
  /** 是否流式输出 */
  stream?: boolean;
  
  /** 模型选择 */
  model?: 'deepseek' | 'claude' | 'gpt' | 'ollama';
  
  /** 是否启用优化 */
  optimize?: boolean;
  
  /** 预览类型 */
  previewType?: 'iframe' | 'codesandbox' | 'stackblitz';
}

/**
 * 生成响应（流式）
 */
export interface GenerateResponse {
  /** 进度更新 */
  progress?: GenerationProgress;
  
  /** 完成时的结果 */
  result?: GenerationResult;
  
  /** 错误信息 */
  error?: string;
  
  /** 是否完成 */
  done: boolean;
}
