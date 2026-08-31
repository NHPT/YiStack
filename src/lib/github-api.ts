'use client';

import { readUserAuthTokenStorage } from '@/lib/auth-storage';

export type GitHubConnectionStatus = {
  configured: boolean;
  connected: boolean;
  account_id?: number;
  account_login?: string;
  account_name?: string;
  avatar_url?: string;
  scopes?: string;
  updated_at?: string;
};

export type GitHubRepository = {
  id: number;
  full_name: string;
  html_url: string;
  default_branch: string;
  private: boolean;
  archived: boolean;
  permission_push: boolean;
  permission_admin: boolean;
};

export type GitHubProjectBinding = {
  project_id: string;
  repository_id: number;
  repository_name: string;
  repository_url: string;
  default_branch: string;
  remote_name: string;
  permission_push: boolean;
  webhook_id: number;
  remote_head_sha: string;
};

export type GitHubSyncResult = {
  status: string;
  kind: 'import' | 'pull' | 'push';
  repository_name: string;
  branch: string;
  local_sha?: string;
  remote_sha?: string;
  backup_ref?: string;
  forced: boolean;
  replayed: boolean;
  message: string;
};

type GitHubResponse<T> = {
  success?: boolean;
  data?: T;
  error?: string;
  code?: string;
};

async function githubRequest<T>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'DELETE'; body?: object } = {},
): Promise<T> {
  const tokenResult = readUserAuthTokenStorage();
  const token = tokenResult.ok ? tokenResult.value : null;
  const response = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json() as GitHubResponse<T>;
  if (!response.ok || payload.success === false || payload.data === undefined) {
    throw new Error(payload.error || payload.code || `GitHub request failed (${response.status})`);
  }
  return payload.data;
}

export const githubApi = {
  getConnection: () => githubRequest<GitHubConnectionStatus>('/github/connection'),
  startOAuth: (returnPath: string) => githubRequest<{ authorization_url: string; expires_at: string }>(
    '/github/oauth/start',
    { method: 'POST', body: { return_path: returnPath } },
  ),
  disconnect: () => githubRequest<{ disconnected: boolean }>('/github/connection', { method: 'DELETE' }),
  listRepositories: () => githubRequest<GitHubRepository[]>('/github/repositories'),
  getBinding: (projectId: string) => githubRequest<GitHubProjectBinding>(
    `/project/${encodeURIComponent(projectId)}/github/binding`,
  ),
  importRepository: (
    projectId: string,
    repositoryName: string,
    branch: string,
    idempotencyKey: string,
  ) => githubRequest<GitHubSyncResult>(`/project/${encodeURIComponent(projectId)}/github/import`, {
    method: 'POST',
    body: {
      repository_name: repositoryName,
      branch,
      confirm_replace_workspace: true,
      idempotency_key: idempotencyKey,
    },
  }),
  pull: (projectId: string, idempotencyKey: string) => githubRequest<GitHubSyncResult>(
    `/project/${encodeURIComponent(projectId)}/github/pull`,
    { method: 'POST', body: { confirm_pull: true, idempotency_key: idempotencyKey } },
  ),
  push: (
    projectId: string,
    input: {
      idempotencyKey: string;
      force: boolean;
      confirmForcePush: boolean;
      expectedRemoteSHA: string;
    },
  ) => githubRequest<GitHubSyncResult>(`/project/${encodeURIComponent(projectId)}/github/push`, {
    method: 'POST',
    body: {
      confirm_push: true,
      force: input.force,
      confirm_force_push: input.confirmForcePush,
      expected_remote_sha: input.expectedRemoteSHA,
      idempotency_key: input.idempotencyKey,
    },
  }),
};
