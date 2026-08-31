'use client';

import { readUserAuthTokenStorage } from '@/lib/auth-storage';

export type DeploymentProviderStatus = { provider: 'vercel'; configured: boolean; team_configured: boolean };
export type DeploymentRelease = {
  id: string; project_id: string; provider: 'vercel'; provider_deployment_id: string;
  kind: 'deploy' | 'rollback'; target: 'preview' | 'production'; status: string; url: string;
  source_commit_sha: string; artifact_sha256: string; artifact_file_count: number; artifact_size: number;
  previous_provider_deployment_id?: string; environment_keys: string; error_code?: string; error_message?: string;
  created_at: string; updated_at: string; ready_at?: string;
};
export type DeploymentDomain = {
  id: string; domain: string; status: string; verified: boolean;
  verification_type?: string; verification_domain?: string; verification_value?: string;
};
export type DeploymentLogEntry = { type: string; created_at: number; step?: string; status?: string; message: string };
export type DeploymentMutationResult = { release?: DeploymentRelease; domain?: DeploymentDomain; removed_domain?: string; replayed: boolean };
export type DeploymentEnvironmentInput = { key: string; value: string };

type ApiResponse<T> = { success?: boolean; data?: T; error?: string; code?: string };
async function deploymentRequest<T>(path: string, options: { method?: 'GET'|'POST'|'DELETE'; body?: object } = {}): Promise<T> {
  const tokenResult = readUserAuthTokenStorage(); const token = tokenResult.ok ? tokenResult.value : null;
  const response = await fetch(`/api${path}`, { method: options.method ?? 'GET', headers: {'Content-Type':'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {})}, body: options.body ? JSON.stringify(options.body) : undefined });
  const payload = await response.json() as ApiResponse<T>;
  if (!response.ok || payload.success === false || payload.data === undefined) throw new Error(payload.error || payload.code || `Deployment request failed (${response.status})`);
  return payload.data;
}
const key = (kind:string,projectId:string) => `${kind}-${projectId}-${crypto.randomUUID()}`;
export const deploymentApi = {
  provider: (projectId:string) => deploymentRequest<DeploymentProviderStatus>(`/project/${encodeURIComponent(projectId)}/deployment/provider`),
  releases: (projectId:string) => deploymentRequest<DeploymentRelease[]>(`/project/${encodeURIComponent(projectId)}/deployment/releases`),
  deploy: (projectId:string,target:'preview'|'production',environment:DeploymentEnvironmentInput[]) => deploymentRequest<DeploymentMutationResult>(`/project/${encodeURIComponent(projectId)}/deployment/releases`,{method:'POST',body:{target,environment,confirm_deploy:true,idempotency_key:key('deploy',projectId)}}),
  refreshRelease: (projectId:string,releaseId:string) => deploymentRequest<DeploymentRelease>(`/project/${encodeURIComponent(projectId)}/deployment/releases/${encodeURIComponent(releaseId)}`),
  logs: (projectId:string,releaseId:string) => deploymentRequest<DeploymentLogEntry[]>(`/project/${encodeURIComponent(projectId)}/deployment/releases/${encodeURIComponent(releaseId)}/logs`),
  rollback: (projectId:string,targetReleaseId:string,expectedCurrentDeploymentId:string) => deploymentRequest<DeploymentMutationResult>(`/project/${encodeURIComponent(projectId)}/deployment/rollback`,{method:'POST',body:{target_release_id:targetReleaseId,expected_current_deployment_id:expectedCurrentDeploymentId,confirm_rollback:true,idempotency_key:key('rollback',projectId)}}),
  domains: (projectId:string) => deploymentRequest<DeploymentDomain[]>(`/project/${encodeURIComponent(projectId)}/deployment/domains`),
  addDomain: (projectId:string,domain:string) => deploymentRequest<DeploymentMutationResult>(`/project/${encodeURIComponent(projectId)}/deployment/domains`,{method:'POST',body:{domain,confirm:true,idempotency_key:key('domain-add',projectId)}}),
  verifyDomain: (projectId:string,domain:string) => deploymentRequest<DeploymentMutationResult>(`/project/${encodeURIComponent(projectId)}/deployment/domains/verify`,{method:'POST',body:{domain,confirm:true,idempotency_key:key('domain-verify',projectId)}}),
  removeDomain: (projectId:string,domain:string) => deploymentRequest<DeploymentMutationResult>(`/project/${encodeURIComponent(projectId)}/deployment/domains`,{method:'DELETE',body:{domain,confirm:true,idempotency_key:key('domain-remove',projectId)}}),
};
