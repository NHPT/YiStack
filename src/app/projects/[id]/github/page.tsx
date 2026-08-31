'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  Github,
  Link2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Unlink,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  GitHubConnectionStatus,
  GitHubProjectBinding,
  GitHubRepository,
  GitHubSyncResult,
  githubApi,
} from '@/lib/github-api';

function newIdempotencyKey(kind: string, projectId: string) {
  return `${kind}-${projectId}-${crypto.randomUUID()}`;
}

function findGitHubRepository(repositories: GitHubRepository[], repositoryName: string) {
  for (const repository of repositories) {
    if (repository.full_name === repositoryName) {
      return repository;
    }
  }
  return null;
}

function materializeGitHubRepositoryOptions(repositories: GitHubRepository[]) {
  const options: ReactNode[] = [];
  for (const repository of repositories) {
    options.push(
      <option key={repository.id} value={repository.full_name}>
        {repository.full_name}{repository.private ? ' · Private' : ''}
      </option>,
    );
  }
  return options;
}

export default function ProjectGitHubPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [connection, setConnection] = useState<GitHubConnectionStatus | null>(null);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [binding, setBinding] = useState<GitHubProjectBinding | null>(null);
  const [selectedRepository, setSelectedRepository] = useState('');
  const [branch, setBranch] = useState('');
  const [confirmImport, setConfirmImport] = useState(false);
  const [forcePush, setForcePush] = useState(false);
  const [confirmForcePush, setConfirmForcePush] = useState(false);
  const [expectedRemoteSHA, setExpectedRemoteSHA] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<GitHubSyncResult | null>(null);

  const selected = useMemo(
    () => findGitHubRepository(repositories, selectedRepository),
    [repositories, selectedRepository],
  );

  const load = useCallback(async () => {
    setError('');
    const nextConnection = await githubApi.getConnection();
    setConnection(nextConnection);
    if (!nextConnection.connected) {
      setRepositories([]);
      setBinding(null);
      return;
    }
    const nextRepositories = await githubApi.listRepositories();
    setRepositories(nextRepositories);
    try {
      const nextBinding = await githubApi.getBinding(projectId);
      setBinding(nextBinding);
      setSelectedRepository(nextBinding.repository_name);
      setBranch(nextBinding.default_branch);
      setExpectedRemoteSHA(nextBinding.remote_head_sha);
    } catch {
      setBinding(null);
    }
  }, [projectId]);

  useEffect(() => {
    void load().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : 'GitHub 状态加载失败');
    });
  }, [load]);

  const run = async (action: string, operation: () => Promise<GitHubSyncResult>) => {
    setBusyAction(action);
    setError('');
    setResult(null);
    try {
      const nextResult = await operation();
      setResult(nextResult);
      await load();
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : 'GitHub 操作失败');
    } finally {
      setBusyAction('');
    }
  };

  const connect = async () => {
    setBusyAction('connect');
    setError('');
    try {
      const oauth = await githubApi.startOAuth(`/projects/${encodeURIComponent(projectId)}/github`);
      window.location.assign(oauth.authorization_url);
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'GitHub 连接失败');
      setBusyAction('');
    }
  };

  const disconnect = async () => {
    if (!window.confirm('确认断开当前 GitHub 连接？项目绑定会保留，但同步将不可用。')) {
      return;
    }
    setBusyAction('disconnect');
    setError('');
    try {
      await githubApi.disconnect();
      setConnection((current) => current ? { ...current, connected: false } : current);
      setRepositories([]);
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : 'GitHub 断开失败');
    } finally {
      setBusyAction('');
    }
  };

  const importRepository = () => run('import', () => githubApi.importRepository(
    projectId,
    selectedRepository,
    branch || selected?.default_branch || '',
    newIdempotencyKey('import', projectId),
  ));

  const pull = () => run('pull', () => githubApi.pull(
    projectId,
    newIdempotencyKey('pull', projectId),
  ));

  const push = () => run('push', () => githubApi.push(projectId, {
    idempotencyKey: newIdempotencyKey('push', projectId),
    force: forcePush,
    confirmForcePush,
    expectedRemoteSHA,
  }));

  const connected = connection?.connected === true;
  const importReady = connected && selected !== null && selected.permission_admin &&
    confirmImport && busyAction === '';
  const syncReady = connected && binding !== null && busyAction === '';
  const repositoryOptions = materializeGitHubRepositoryOptions(repositories);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild variant="ghost" size="icon" title="返回项目">
              <Link href={`/workspace?project=${encodeURIComponent(projectId)}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Github className="h-5 w-5" />
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold">GitHub 同步</h1>
              <p className="truncate text-xs text-muted-foreground">{projectId}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={busyAction !== ''}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="space-y-4" aria-labelledby="github-account-title">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 id="github-account-title" className="text-sm font-semibold">GitHub 账号</h2>
            <Badge variant={connected ? 'default' : 'outline'}>
              {connected ? '已连接' : connection?.configured ? '未连接' : '未配置'}
            </Badge>
          </div>
          {connected ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{connection?.account_login}</p>
                <p className="truncate text-xs text-muted-foreground">{connection?.account_name || connection?.scopes}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void disconnect()} disabled={busyAction !== ''}>
                <Unlink className="mr-2 h-4 w-4" />
                断开
              </Button>
            </div>
          ) : (
            <Button onClick={() => void connect()} disabled={busyAction !== '' || connection?.configured === false}>
              {busyAction === 'connect' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Github className="mr-2 h-4 w-4" />}
              连接 GitHub
            </Button>
          )}

          <div className="space-y-3 border-t pt-4">
            <label className="block text-xs font-medium" htmlFor="github-repository">仓库</label>
            <select
              id="github-repository"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={selectedRepository}
              onChange={(event) => {
                const name = event.target.value;
                const repository = findGitHubRepository(repositories, name);
                setSelectedRepository(name);
                setBranch(repository?.default_branch ?? '');
              }}
              disabled={!connected || busyAction !== ''}
            >
              <option value="">选择仓库</option>
              {repositoryOptions}
            </select>
            <label className="block text-xs font-medium" htmlFor="github-branch">分支</label>
            <Input id="github-branch" value={branch} onChange={(event) => setBranch(event.target.value)} />
            {selected !== null && !selected.permission_admin && (
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>缺少仓库 Admin 权限</AlertTitle>
                <AlertDescription>无法自动安装受签名保护的 push webhook。</AlertDescription>
              </Alert>
            )}
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={confirmImport} onCheckedChange={(value) => setConfirmImport(value === true)} />
              <span>确认以所选远端分支替换当前 clean worktree，并保留本地 backup ref</span>
            </label>
            <Button onClick={() => void importRepository()} disabled={!importReady}>
              {busyAction === 'import' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
              导入并绑定
            </Button>
          </div>
        </section>

        <section className="space-y-4" aria-labelledby="github-sync-title">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 id="github-sync-title" className="text-sm font-semibold">远端同步</h2>
            <Badge variant="outline">{binding?.default_branch || '未绑定'}</Badge>
          </div>
          <div>
            <p className="text-sm font-medium">{binding?.repository_name || '尚未绑定仓库'}</p>
            <p className="mt-1 break-all text-xs text-muted-foreground">{binding?.remote_head_sha || '无远端 SHA'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void pull()} disabled={!syncReady}>
              <ArrowDownToLine className="mr-2 h-4 w-4" />
              Pull
            </Button>
            <Button onClick={() => void push()} disabled={!syncReady || (forcePush && !confirmForcePush)}>
              <ArrowUpFromLine className="mr-2 h-4 w-4" />
              Push
            </Button>
          </div>
          <div className="space-y-3 border-t pt-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={forcePush} onCheckedChange={(value) => setForcePush(value === true)} />
              <span>使用 force-with-lease</span>
            </label>
            {forcePush && (
              <>
                <Input
                  aria-label="预期远端 SHA"
                  placeholder="预期远端 SHA"
                  value={expectedRemoteSHA}
                  onChange={(event) => setExpectedRemoteSHA(event.target.value)}
                />
                <label className="flex items-start gap-2 text-sm text-destructive">
                  <Checkbox checked={confirmForcePush} onCheckedChange={(value) => setConfirmForcePush(value === true)} />
                  <span>确认覆盖远端历史；远端 SHA 变化时操作仍会被阻断</span>
                </label>
              </>
            )}
          </div>
        </section>

        {(error || result) && (
          <Alert className="lg:col-span-2" variant={error ? 'destructive' : 'default'}>
            <AlertTitle>{error ? '操作失败' : '操作完成'}</AlertTitle>
            <AlertDescription>{error || result?.message}</AlertDescription>
          </Alert>
        )}
      </div>
    </main>
  );
}
