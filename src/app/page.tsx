/**
 * YiStack - 首页
 * 道生一，二生三，三生万物
 */

'use client';

import type { ComponentType, ReactNode } from 'react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/contexts/auth-context';
import {
  Monitor,
  Smartphone,
  MessageSquare,
  Laptop,
  Sparkles,
  Layers,
  ArrowRight,
  LogIn,
  LogOut,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppPreferenceControls } from '@/components/app-preference-controls';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { projectApi, type User as AuthUser } from '@/lib/api';
import { buildHomeProjectCreateResponseError } from '@/lib/workspace/workspace-business-boundary-errors';
import { buildWorkspaceEntryNavigationSnapshot, WorkspaceEntryNavigationSnapshotStrip } from './workspace/workspace-entry-navigation-snapshot';
import {
  buildHomeEntryLocalStateFailure,
  formatHomeEntryLocalStateCleanupFailure,
  formatHomeEntryLocalStateFailure,
  type HomeEntryLocalStateFailure,
} from '@/lib/workspace/home-entry-local-errors';
import { formatHomePlanningStartFailure } from '@/lib/workspace/home-planning-entry-errors';

type AppType = 'web' | 'mobile' | 'miniprogram' | 'desktop';

const pendingWorkspaceNavigationKey = 'yistack_pending_workspace_navigation';
const homeDraftKey = 'yistack_home_draft';
const homeProjectSnapshotStatusParam = 'home_project_snapshot_status';
const homeProjectSnapshotDetailsParam = 'home_project_snapshot_details';
const homePendingNavigationStatusParam = 'home_pending_navigation_status';
const homePendingNavigationDetailsParam = 'home_pending_navigation_details';
const homeDraftCleanupStatusParam = 'home_draft_cleanup_status';
const homeDraftCleanupDetailsParam = 'home_draft_cleanup_details';

type LocalPersistenceResult =
  | { ok: true }
  | HomeEntryLocalStateFailure<'local_storage' | 'session_storage'>;

type HomeDraft = {
  selectedType?: AppType;
  description?: string;
  projectName?: string;
};

type HomeDraftRestoreResult =
  | { ok: true; draft: HomeDraft | null }
  | HomeEntryLocalStateFailure<'session_storage'>;

type HomeWorkspaceNavigationRouter = {
  replace: (target: string) => void;
};

type HomeWorkspaceNavigationOptions = {
  projectSnapshotFailureDetails?: string;
  homeDraftCleanupFailureDetails?: string;
};

type HomeAppTypeOption = {
  id: AppType;
  name: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
};

type HomeAppTypeOptionList = readonly HomeAppTypeOption[];
type HomeAppTypeOptionNodeList = ReactNode[];
type HomeAppTypeSelectHandler = (appType: AppType) => void;

type HomeTechnologyLabel = string;
type HomeTechnologyLabelList = readonly HomeTechnologyLabel[];
type HomeTechnologyNodeList = ReactNode[];
type HomeDescriptionLine = string;
type HomeDescriptionLineList = readonly HomeDescriptionLine[];
type HomeEmailSegment = string;
type HomeEmailSegmentList = readonly HomeEmailSegment[];

const appTypes: HomeAppTypeOptionList = [
  { id: 'web', name: '网页应用', description: 'Web App', icon: Monitor, color: 'from-blue-500 to-cyan-500' },
  { id: 'mobile', name: '移动应用', description: 'Mobile App', icon: Smartphone, color: 'from-purple-500 to-pink-500' },
  { id: 'miniprogram', name: '小程序', description: 'Mini Program', icon: MessageSquare, color: 'from-green-500 to-emerald-500' },
  { id: 'desktop', name: '桌面应用', description: 'Desktop App', icon: Laptop, color: 'from-orange-500 to-amber-500' },
];

const homeTechnologyLabels: HomeTechnologyLabelList = [
  'React',
  'Vue',
  'Next.js',
  'TypeScript',
  'Tailwind CSS',
  'Node.js',
  'Python',
  'Go',
  'FastAPI',
];

function hasHomeAppTypeOption(
  options: HomeAppTypeOptionList,
  candidate: AppType,
): boolean {
  for (const option of options) {
    if (option.id === candidate) {
      return true;
    }
  }

  return false;
}

function materializeHomeAppTypeOptionNodes({
  options,
  selectedType,
  onSelect,
}: {
  options: HomeAppTypeOptionList;
  selectedType: AppType;
  onSelect: HomeAppTypeSelectHandler;
}): HomeAppTypeOptionNodeList {
  const nodes: HomeAppTypeOptionNodeList = [];

  for (const option of options) {
    const isSelected = selectedType === option.id;

    nodes.push(
      <button
        key={option.id}
        type="button"
        onClick={() => onSelect(option.id)}
        className={cn(
          "group relative p-6 rounded-2xl border-2 transition-all duration-200",
          "hover:shadow-lg hover:-translate-y-0.5",
          isSelected === true
            ? "border-primary bg-primary/5 shadow-md"
            : "border-border bg-card hover:border-primary/50"
        )}
      >
        <div className={cn(
          "w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center",
          "bg-gradient-to-br shadow-sm",
          option.color
        )}>
          <option.icon className="w-7 h-7 text-white" />
        </div>
        <h4 className="font-medium mb-1">{option.name}</h4>
        <p className="text-xs text-muted-foreground">{option.description}</p>
        {isSelected === true && (
          <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-primary-foreground" />
          </div>
        )}
      </button>
    );
  }

  return nodes;
}

function materializeHomeTechnologyNodes(
  labels: HomeTechnologyLabelList,
): HomeTechnologyNodeList {
  const nodes: HomeTechnologyNodeList = [];

  for (const label of labels) {
    nodes.push(
      <span
        key={label}
        className="px-3 py-1.5 rounded-full bg-muted text-sm text-muted-foreground hover:text-foreground transition-colors cursor-default"
      >
        {label}
      </span>
    );
  }

  return nodes;
}

function getHomeFirstDescriptionLine(description: string): HomeDescriptionLine | undefined {
  const lines: HomeDescriptionLineList = description.trim().split(/\r?\n/);

  for (const line of lines) {
    return line;
  }

  return undefined;
}

function getHomeProjectNameCandidate(description: string): string | null {
  const firstLine = getHomeFirstDescriptionLine(description);
  if (firstLine === undefined) {
    return null;
  }

  const projectNameCandidate = firstLine
    .trim()
    .replace(/^[\s,.;:!?，。；：！？、'"`()\[\]{}<>《》【】]+|[\s,.;:!?，。；：！？、'"`()\[\]{}<>《》【】]+$/g, '');

  if (projectNameCandidate.length === 0) {
    return null;
  }

  return projectNameCandidate;
}

function deriveProjectName(description: string, appType: AppType): string {
  const projectNameCandidate = getHomeProjectNameCandidate(description);
  if (projectNameCandidate !== null) {
    return Array.from(projectNameCandidate).slice(0, 18).join('');
  }

  const fallbackMap: Record<AppType, string> = {
    web: '未命名网页应用',
    mobile: '未命名移动应用',
    miniprogram: '未命名小程序',
    desktop: '未命名桌面应用',
  };

  return fallbackMap[appType];
}

function getHomeFirstEmailSegment(email: string): HomeEmailSegment | undefined {
  const emailSegments: HomeEmailSegmentList = email.split('@');

  for (const segment of emailSegments) {
    return segment;
  }

  return undefined;
}

function getHomeUserTextValue(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return null;
  }

  return trimmedValue;
}

function getHomeUserEmailLocalPart(email: string): string | null {
  const firstEmailSegment = getHomeFirstEmailSegment(email);
  return getHomeUserTextValue(firstEmailSegment);
}

function getHomeAuthenticatedUserLabel(user: AuthUser | null): string {
  if (user === null) {
    return '用户';
  }

  const username = getHomeUserTextValue(user.username);
  if (username !== null) {
    return username;
  }

  const emailLocalPart = getHomeUserEmailLocalPart(user.email);
  if (emailLocalPart !== null) {
    return emailLocalPart;
  }

  return '用户';
}

function buildWorkspaceTarget(
  projectId: string,
  options?: {
    projectSnapshotFailureDetails?: string;
    pendingNavigationFailureDetails?: string;
    homeDraftCleanupFailureDetails?: string;
  },
) {
  const params = new URLSearchParams({ projectId });
  if (options?.projectSnapshotFailureDetails) {
    params.set(homeProjectSnapshotStatusParam, 'failed');
    params.set(homeProjectSnapshotDetailsParam, options.projectSnapshotFailureDetails);
  }
  if (options?.pendingNavigationFailureDetails) {
    params.set(homePendingNavigationStatusParam, 'failed');
    params.set(homePendingNavigationDetailsParam, options.pendingNavigationFailureDetails);
  }
  if (options?.homeDraftCleanupFailureDetails) {
    params.set(homeDraftCleanupStatusParam, 'failed');
    params.set(homeDraftCleanupDetailsParam, options.homeDraftCleanupFailureDetails);
  }
  return `/workspace?${params.toString()}`;
}

function markPendingWorkspaceNavigation(projectId: string, target: string): LocalPersistenceResult {
  if (typeof window === 'undefined') return { ok: true };

  try {
    sessionStorage.setItem(pendingWorkspaceNavigationKey, JSON.stringify({
      projectId,
      target,
      createdAt: Date.now(),
    }));
    return { ok: true };
  } catch (error) {
    return buildHomeEntryLocalStateFailure(
      error,
      'session_storage',
      '浏览器拒绝写入 Workspace 跳转保护状态',
    );
  }
}

function navigateToWorkspace(
  projectId: string,
  router: HomeWorkspaceNavigationRouter,
  options?: HomeWorkspaceNavigationOptions,
) {
  let target = buildWorkspaceTarget(projectId, {
    projectSnapshotFailureDetails: options?.projectSnapshotFailureDetails,
    homeDraftCleanupFailureDetails: options?.homeDraftCleanupFailureDetails,
  });
  if (typeof window === 'undefined') {
    router.replace(target);
    return;
  }

  const pendingNavigationResult = markPendingWorkspaceNavigation(projectId, target);
  if (!pendingNavigationResult.ok) {
    target = buildWorkspaceTarget(projectId, {
      projectSnapshotFailureDetails: options?.projectSnapshotFailureDetails,
      pendingNavigationFailureDetails: pendingNavigationResult.details,
      homeDraftCleanupFailureDetails: options?.homeDraftCleanupFailureDetails,
    });
  }
  router.replace(target);
}

function persistHomeWorkspaceProjectSnapshot(project: {
  projectId: string;
  projectName: string;
  description: string;
  appType: AppType;
}): LocalPersistenceResult {
  try {
    localStorage.setItem('yistack_current_project', JSON.stringify({
      projectId: project.projectId,
      projectName: project.projectName,
      description: project.description,
      appType: project.appType,
      isPersisted: true,
      initialMessage: '正在分析你的需求并规划技术方案...',
      pendingPlanSelection: true,
    }));
    return { ok: true };
  } catch (error) {
    return buildHomeEntryLocalStateFailure(
      error,
      'local_storage',
      '浏览器拒绝写入首页项目快照',
    );
  }
}

function readHomeDraft(): HomeDraftRestoreResult {
  try {
    const rawDraft = sessionStorage.getItem(homeDraftKey);
    if (!rawDraft) return { ok: true, draft: null };

    const draft = JSON.parse(rawDraft) as HomeDraft;
    return { ok: true, draft };
  } catch (error) {
    try {
      sessionStorage.removeItem(homeDraftKey);
      return buildHomeEntryLocalStateFailure(
        error,
        'session_storage',
        '首页草稿格式无效',
      );
    } catch (cleanupError) {
      return buildHomeEntryLocalStateFailure(
        error,
        'session_storage',
        '首页草稿格式无效',
        {
          error: cleanupError,
          fallback: '浏览器拒绝清理首页草稿',
        },
      );
    }
  }
}

function persistHomeDraft(draft: Required<HomeDraft>): LocalPersistenceResult {
  try {
    sessionStorage.setItem(homeDraftKey, JSON.stringify(draft));
    return { ok: true };
  } catch (error) {
    return buildHomeEntryLocalStateFailure(
      error,
      'session_storage',
      '浏览器拒绝写入首页草稿',
    );
  }
}

function clearHomeDraft(): LocalPersistenceResult {
  try {
    sessionStorage.removeItem(homeDraftKey);
    return { ok: true };
  } catch (error) {
    return buildHomeEntryLocalStateFailure(
      error,
      'session_storage',
      '浏览器拒绝清理首页草稿',
    );
  }
}

export default function HomePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout, authStorageNotice } = useAuth();
  const [selectedType, setSelectedType] = useState<AppType>('web');
  const [description, setDescription] = useState('');
  const [projectName, setProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [homeDraftRestoreNotice, setHomeDraftRestoreNotice] = useState<string | null>(null);
  const [homeDraftPersistenceNotice, setHomeDraftPersistenceNotice] = useState<string | null>(null);
  const [hasLoadedHomeDraft, setHasLoadedHomeDraft] = useState(false);
  const projectCreateInFlightRef = useRef(false);
  const descriptionValue = description.trim();
  const hasDescriptionValue = descriptionValue.length > 0;
  const hasHomeDraftRestoreIssue = homeDraftRestoreNotice !== null;
  const hasHomeDraftPersistenceIssue = homeDraftPersistenceNotice !== null;
  const hasHomeCreateError = planError !== null;
  const canCreateHomeProject = hasDescriptionValue === true && isCreating === false && isLoading === false;
  const entryNavigationSnapshot = buildWorkspaceEntryNavigationSnapshot({
    surface: 'home',
    isAuthenticated,
    authLoading: isLoading,
    isBusy: isCreating,
    hasDraftRestoreIssue: hasHomeDraftRestoreIssue,
    hasDraftPersistenceIssue: hasHomeDraftPersistenceIssue,
    hasCreateError: hasHomeCreateError,
    hasTargetProject: hasDescriptionValue,
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    router.prefetch('/workspace');
    router.prefetch('/projects');
  }, [isAuthenticated, router]);

  useEffect(() => {
    const result = readHomeDraft();
    if (!result.ok) {
      const cleanupSuffix = result.cleanupError
        ? `；损坏草稿清理也失败：${formatHomeEntryLocalStateCleanupFailure(result, '浏览器拒绝清理首页草稿')}`
        : '';
      setHomeDraftRestoreNotice(`首页草稿恢复失败：${formatHomeEntryLocalStateFailure(result, '草稿格式无效')}。已尝试清理损坏的本地草稿；如果你返回首页后输入没有恢复，请重新填写需求${cleanupSuffix}。`);
      setHasLoadedHomeDraft(true);
      return;
    }
    const draft = result.draft;
    if (!draft) {
      setHasLoadedHomeDraft(true);
      return;
    }
    if (draft.selectedType !== undefined && hasHomeAppTypeOption(appTypes, draft.selectedType)) {
      setSelectedType(draft.selectedType);
    }
    if (draft.description !== undefined) setDescription(draft.description);
    if (draft.projectName !== undefined) setProjectName(draft.projectName);
    setHasLoadedHomeDraft(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedHomeDraft) return;
    const result = persistHomeDraft({
      selectedType,
      description,
      projectName,
    });
    if (result.ok) {
      setHomeDraftPersistenceNotice(null);
    } else {
      setHomeDraftPersistenceNotice(`首页草稿保存失败：${formatHomeEntryLocalStateFailure(result, '浏览器拒绝写入首页草稿')}。当前输入仍保留在页面内，但刷新、关闭或离开首页后可能无法自动恢复。`);
    }
  }, [description, hasLoadedHomeDraft, projectName, selectedType]);

  const handleCreate = useCallback(async () => {
    if (canCreateHomeProject === false) return;
    if (projectCreateInFlightRef.current === true) return;
    
    projectCreateInFlightRef.current = true;
    setIsCreating(true);
    
    // 如果未登录，跳转到登录页面
    if (!isAuthenticated) {
      router.push('/auth?redirect=/');
      projectCreateInFlightRef.current = false;
      setIsCreating(false);
      return;
    }
    
    try {
      setPlanError(null);
      const generatedName = projectName.trim() || deriveProjectName(description, selectedType);
      const createdProject = await projectApi.create({
        name: generatedName,
        description,
        app_type: selectedType,
      });
      const projectId = createdProject.project_id;

      if (!projectId) {
        throw buildHomeProjectCreateResponseError(createdProject, {
          name: generatedName,
          appType: selectedType,
          description,
        });
      }

      const projectSnapshotResult = persistHomeWorkspaceProjectSnapshot({
        projectId,
        projectName: createdProject.name || generatedName,
        description,
        appType: selectedType,
      });
      const homeDraftCleanupResult = clearHomeDraft();

      navigateToWorkspace(projectId, router, {
        projectSnapshotFailureDetails: projectSnapshotResult.ok ? undefined : projectSnapshotResult.details,
        homeDraftCleanupFailureDetails: homeDraftCleanupResult.ok ? undefined : homeDraftCleanupResult.details,
      });
    } catch (error) {
      console.error('初始化规划会话失败:', error);
      setPlanError(`开始规划失败: ${formatHomePlanningStartFailure(error)}`);
    } finally {
      projectCreateInFlightRef.current = false;
      setIsCreating(false);
    }
  }, [canCreateHomeProject, description, selectedType, projectName, router, isAuthenticated]);
  const appTypeOptionNodes = materializeHomeAppTypeOptionNodes({
    options: appTypes,
    selectedType,
    onSelect: setSelectedType,
  });
  const homeTechnologyNodes = materializeHomeTechnologyNodes(homeTechnologyLabels);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* 顶部导航 */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/25">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">YiStack</h1>
              <p className="text-xs text-muted-foreground">一栈生成应用</p>
            </div>
          </div>
          <nav className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/projects" prefetch={isAuthenticated}>
                我的项目
              </Link>
            </Button>
            <Button variant="ghost">文档</Button>
            <AppPreferenceControls />
            
            {/* 用户状态 */}
            {isLoading ? (
              <Spinner className="w-8 h-8" />
            ) : isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <User className="w-4 h-4" />
                    {getHomeAuthenticatedUserLabel(user)}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => router.push('/projects')}>
                    我的项目
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/settings')}>
                    设置
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="default" size="sm" onClick={() => router.push('/auth')}>
                <LogIn className="w-4 h-4 mr-2" />
                登录
              </Button>
            )}
          </nav>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Hero 区域 */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm mb-6">
            <Sparkles className="w-4 h-4" />
            <span>AI 驱动的应用生成平台</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
            一站式生成、运行和迭代应用
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            从最简单的想法，生成无限可能的应用。只需描述你的需求，AI 将为你构建完整的可运行应用。
          </p>
        </div>

        {/* 应用类型选择 */}
        <div className="mb-8">
          <h3 className="text-center text-sm font-medium text-muted-foreground mb-4">
            选择你想要创建的应用类型
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {appTypeOptionNodes}
          </div>
        </div>

        {/* 描述输入 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            描述你想要构建的应用
          </label>
          <Textarea
            placeholder="例如：帮我创建一个待办事项管理应用，包含任务列表、分类标签、截止日期提醒等功能..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[120px] resize-none text-base"
          />
        </div>

        {/* 项目名称（可选） */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            项目名称（可选）
          </label>
          <input
            type="text"
            placeholder="我的待办应用"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-full h-11 px-4 rounded-lg border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* 创建按钮 */}
        <div className="text-center">
          <div className="mb-4">
            <WorkspaceEntryNavigationSnapshotStrip snapshot={entryNavigationSnapshot} />
          </div>
          <Button
            type="button"
            size="lg"
            onClick={handleCreate}
            disabled={canCreateHomeProject === false}
            className="h-12 px-8 text-base gap-2"
          >
            {isCreating ? (
              <>
                <Spinner className="w-5 h-5" />
                正在创建...
              </>
            ) : !isAuthenticated ? (
              <>
                <LogIn className="w-5 h-5" />
                登录后创建
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                开始创建
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            {isAuthenticated 
              ? '创建后将进入工作台，在对话区展示 AI 规划方案供你选择'
              : '登录后即可开始创建应用'
            }
          </p>
          {planError && (
            <p className="text-sm text-destructive mt-2">{planError}</p>
          )}
          {homeDraftRestoreNotice && (
            <p role="status" className="text-sm text-amber-600 mt-2">{homeDraftRestoreNotice}</p>
          )}
          {homeDraftPersistenceNotice && (
            <p role="status" className="text-sm text-amber-600 mt-2">{homeDraftPersistenceNotice}</p>
          )}
          {authStorageNotice && (
            <p role="status" className="text-sm text-amber-600 mt-2">{authStorageNotice}</p>
          )}
        </div>

        {/* 技术栈预览 */}
        <div className="mt-16 pt-12 border-t">
          <h3 className="text-center text-sm font-medium text-muted-foreground mb-6">
            支持的主流技术栈
          </h3>
          <div className="flex flex-wrap justify-center gap-3">
            {homeTechnologyNodes}
          </div>
        </div>
      </main>

      {/* 底部 */}
      <footer className="border-t py-8 mt-auto">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>YiStack - 基于自然语言的应用生成平台</p>
          <p className="mt-1">Apache 2.0 开源协议</p>
        </div>
      </footer>
    </div>
  );
}
