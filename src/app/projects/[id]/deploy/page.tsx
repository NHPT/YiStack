'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, ExternalLink, FileClock, Loader2, Plus, RefreshCw, Rocket, RotateCcw, ScrollText, ShieldCheck, Trash2 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { DeploymentDomain, DeploymentEnvironmentInput, DeploymentLogEntry, DeploymentProviderStatus, DeploymentRelease, deploymentApi } from '@/lib/deployment-api';

type EnvironmentRow = DeploymentEnvironmentInput & { id: string };

function statusVariant(status: string) { return status === 'ready' || status === 'verified' ? 'default' as const : status === 'error' ? 'destructive' as const : 'outline' as const; }
function formatReleaseTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString(); }
function currentProductionRelease(releases: DeploymentRelease[]) { for (const release of releases) { if (release.target === 'production' && release.status === 'ready') return release; } return null; }
function environmentPayload(rows: EnvironmentRow[]) { const result: DeploymentEnvironmentInput[] = []; for (const row of rows) { const key = row.key.trim(); if (key !== '') result.push({key,value:row.value}); } return result; }

function materializeEnvironmentRows(rows: EnvironmentRow[], disabled: boolean, update: (id:string,field:'key'|'value',value:string)=>void, remove:(id:string)=>void) {
  const nodes: ReactNode[] = [];
  for (const row of rows) nodes.push(
    <div key={row.id} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_36px] gap-2">
      <Input aria-label="环境变量名" placeholder="KEY" value={row.key} disabled={disabled} onChange={(event)=>update(row.id,'key',event.target.value.toUpperCase())}/>
      <Input aria-label="环境变量值" placeholder="Value" type="password" value={row.value} disabled={disabled} onChange={(event)=>update(row.id,'value',event.target.value)}/>
      <Button type="button" variant="ghost" size="icon" title="删除环境变量" disabled={disabled} onClick={()=>remove(row.id)}><Trash2 className="h-4 w-4"/></Button>
    </div>,
  );
  return nodes;
}

function materializeReleases(releases: DeploymentRelease[], current: DeploymentRelease|null, busy: string, refresh:(id:string)=>void, logs:(id:string)=>void, rollback:(release:DeploymentRelease)=>void) {
  const nodes: ReactNode[] = [];
  for (const release of releases) nodes.push(
    <div key={release.id} className="border-b py-4 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Badge variant={statusVariant(release.status)}>{release.status}</Badge><span className="text-sm font-medium">{release.kind === 'rollback' ? 'Rollback' : release.target}</span></div>
        <span className="text-xs text-muted-foreground">{formatReleaseTime(release.created_at)}</span>
      </div>
      <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{release.artifact_sha256}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={busy!==''} onClick={()=>refresh(release.id)}><RefreshCw className="mr-2 h-4 w-4"/>刷新</Button>
        <Button variant="outline" size="sm" disabled={busy!==''} onClick={()=>logs(release.id)}><ScrollText className="mr-2 h-4 w-4"/>日志</Button>
        {release.url && <Button asChild variant="outline" size="sm"><a href={release.url} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4"/>打开</a></Button>}
        {release.status === 'ready' && release.provider_deployment_id !== current?.provider_deployment_id && <Button variant="outline" size="sm" disabled={busy!=='' || current===null} onClick={()=>rollback(release)}><RotateCcw className="mr-2 h-4 w-4"/>回滚到此版本</Button>}
      </div>
    </div>,
  );
  return nodes;
}

function materializeDomains(domains: DeploymentDomain[], busy:string, verify:(domain:string)=>void, remove:(domain:string)=>void) {
  const nodes: ReactNode[] = [];
  for (const domain of domains) nodes.push(
    <div key={domain.id} className="border-b py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{domain.domain}</span><Badge variant={statusVariant(domain.status)}>{domain.status}</Badge></div>
      {!domain.verified && domain.verification_value && <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{domain.verification_type} {domain.verification_domain} = {domain.verification_value}</p>}
      <div className="mt-2 flex gap-2">{!domain.verified && <Button size="sm" variant="outline" disabled={busy!==''} onClick={()=>verify(domain.domain)}><ShieldCheck className="mr-2 h-4 w-4"/>验证</Button>}<Button size="icon" variant="ghost" title="移除域名" disabled={busy!==''} onClick={()=>remove(domain.domain)}><Trash2 className="h-4 w-4"/></Button></div>
    </div>,
  );
  return nodes;
}

function materializeLogs(logs: DeploymentLogEntry[]) { const nodes: ReactNode[]=[]; for (const log of logs) nodes.push(<div key={`${log.created_at}-${nodes.length}`} className="border-b py-2 font-mono text-xs last:border-b-0"><span className="text-muted-foreground">{log.step || log.type}</span><pre className="mt-1 whitespace-pre-wrap break-words">{log.message}</pre></div>); return nodes; }

export default function ProjectDeploymentPage() {
  const params=useParams<{id:string}>(); const projectId=params.id;
  const [provider,setProvider]=useState<DeploymentProviderStatus|null>(null); const [releases,setReleases]=useState<DeploymentRelease[]>([]); const [domains,setDomains]=useState<DeploymentDomain[]>([]);
  const [target,setTarget]=useState<'preview'|'production'>('preview'); const [environment,setEnvironment]=useState<EnvironmentRow[]>([]); const [confirmDeploy,setConfirmDeploy]=useState(false); const [domain,setDomain]=useState('');
  const [logs,setLogs]=useState<DeploymentLogEntry[]>([]); const [busy,setBusy]=useState(''); const [error,setError]=useState(''); const [message,setMessage]=useState('');
  const load=useCallback(async()=>{ setError(''); const [nextProvider,nextReleases,nextDomains]=await Promise.all([deploymentApi.provider(projectId),deploymentApi.releases(projectId),deploymentApi.domains(projectId)]); setProvider(nextProvider); setReleases(nextReleases); setDomains(nextDomains); },[projectId]);
  useEffect(()=>{ void load().catch((value:unknown)=>setError(value instanceof Error?value.message:'部署状态加载失败')); },[load]);
  const run=async(action:string,operation:()=>Promise<void>)=>{ setBusy(action);setError('');setMessage('');try{await operation();await load();}catch(value){setError(value instanceof Error?value.message:'部署操作失败');}finally{setBusy('');}};
  const updateEnvironment=(id:string,field:'key'|'value',value:string)=>{ const next:EnvironmentRow[]=[]; for(const row of environment) next.push(row.id===id?{...row,[field]:value}:row); setEnvironment(next); };
  const removeEnvironment=(id:string)=>{ const next:EnvironmentRow[]=[]; for(const row of environment) if(row.id!==id) next.push(row); setEnvironment(next); };
  const deploy=()=>run('deploy',async()=>{const result=await deploymentApi.deploy(projectId,target,environmentPayload(environment));setEnvironment([]);setConfirmDeploy(false);setMessage(result.replayed?'已返回相同发布请求的持久结果':'发布已创建');});
  const refresh=(id:string)=>run(`refresh-${id}`,async()=>{await deploymentApi.refreshRelease(projectId,id);setMessage('发布状态已刷新');});
  const showLogs=(id:string)=>run(`logs-${id}`,async()=>{setLogs(await deploymentApi.logs(projectId,id));setMessage('构建日志已加载');});
  const current=currentProductionRelease(releases);
  const rollback=(release:DeploymentRelease)=>{if(!current||!window.confirm(`确认将生产环境回滚到 ${release.provider_deployment_id}？`))return;void run(`rollback-${release.id}`,async()=>{await deploymentApi.rollback(projectId,release.id,current.provider_deployment_id);setMessage('生产环境已回滚');});};
  const addDomain=()=>{if(!domain.trim())return;void run('domain-add',async()=>{await deploymentApi.addDomain(projectId,domain);setDomain('');setMessage('域名已添加');});};
  const verifyDomain=(value:string)=>void run(`domain-verify-${value}`,async()=>{await deploymentApi.verifyDomain(projectId,value);setMessage('域名状态已刷新');});
  const removeDomain=(value:string)=>{if(!window.confirm(`确认移除域名 ${value}？`))return;void run(`domain-remove-${value}`,async()=>{await deploymentApi.removeDomain(projectId,value);setMessage('域名已移除');});};
  const configured=provider?.configured===true; const deployReady=configured&&confirmDeploy&&busy==='';
  const environmentNodes=materializeEnvironmentRows(environment,busy!=='',updateEnvironment,removeEnvironment); const releaseNodes=materializeReleases(releases,current,busy,refresh,showLogs,rollback); const domainNodes=materializeDomains(domains,busy,verifyDomain,removeDomain); const logNodes=materializeLogs(logs);
  return <main className="min-h-screen bg-background text-foreground">
    <header className="border-b bg-card"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6"><div className="flex min-w-0 items-center gap-3"><Button asChild variant="ghost" size="icon" title="返回项目"><Link href={`/workspace?project=${encodeURIComponent(projectId)}`}><ArrowLeft className="h-4 w-4"/></Link></Button><Rocket className="h-5 w-5"/><div className="min-w-0"><h1 className="truncate text-base font-semibold">发布与域名</h1><p className="truncate text-xs text-muted-foreground">{projectId}</p></div></div><Button variant="outline" size="sm" onClick={()=>void load()} disabled={busy!==''}><RefreshCw className="mr-2 h-4 w-4"/>刷新</Button></div></header>
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="space-y-4" aria-labelledby="deploy-title"><div className="flex items-center justify-between border-b pb-3"><h2 id="deploy-title" className="text-sm font-semibold">Vercel 发布</h2><Badge variant={configured?'default':'outline'}>{configured?'已配置':'未配置'}</Badge></div>
        <div className="inline-flex border"><Button type="button" variant={target==='preview'?'default':'ghost'} size="sm" onClick={()=>setTarget('preview')}>Preview</Button><Button type="button" variant={target==='production'?'default':'ghost'} size="sm" onClick={()=>setTarget('production')}>Production</Button></div>
        <div className="space-y-2"><div className="flex items-center justify-between"><label className="text-xs font-medium">环境变量</label><Button type="button" variant="ghost" size="icon" title="添加环境变量" onClick={()=>setEnvironment((currentRows)=>[...currentRows,{id:crypto.randomUUID(),key:'',value:''}])}><Plus className="h-4 w-4"/></Button></div>{environmentNodes}</div>
        <label className="flex items-start gap-2 text-sm"><Checkbox checked={confirmDeploy} onCheckedChange={(value)=>setConfirmDeploy(value===true)}/><span>确认发布当前 clean commit，并重新执行 Validation Gate</span></label>
        <Button disabled={!deployReady} onClick={()=>void deploy()}>{busy==='deploy'?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Rocket className="mr-2 h-4 w-4"/>}创建发布</Button>
      </section>
      <section className="space-y-4" aria-labelledby="release-title"><div className="flex items-center justify-between border-b pb-3"><h2 id="release-title" className="text-sm font-semibold">发布记录</h2><Badge variant="outline">{releases.length}</Badge></div>{releaseNodes.length>0?releaseNodes:<p className="text-sm text-muted-foreground">暂无发布</p>}</section>
      <section className="space-y-4" aria-labelledby="domain-title"><div className="flex items-center justify-between border-b pb-3"><h2 id="domain-title" className="text-sm font-semibold">自定义域名</h2><Badge variant="outline">{domains.length}</Badge></div><div className="flex gap-2"><Input aria-label="自定义域名" placeholder="app.example.com" value={domain} onChange={(event)=>setDomain(event.target.value.toLowerCase())}/><Button size="icon" title="添加域名" disabled={!configured||!domain.trim()||busy!==''} onClick={()=>addDomain()}><Plus className="h-4 w-4"/></Button></div>{domainNodes}</section>
      <section className="space-y-4" aria-labelledby="logs-title"><div className="flex items-center justify-between border-b pb-3"><h2 id="logs-title" className="text-sm font-semibold">构建日志</h2><FileClock className="h-4 w-4 text-muted-foreground"/></div><div className="max-h-80 overflow-auto">{logNodes.length>0?logNodes:<p className="text-sm text-muted-foreground">选择发布记录查看日志</p>}</div></section>
      {(error||message)&&<Alert className="lg:col-span-2" variant={error?'destructive':'default'}><AlertTitle>{error?'操作失败':'操作完成'}</AlertTitle><AlertDescription className="flex items-center gap-2">{!error&&<Check className="h-4 w-4"/>}{error||message}</AlertDescription></Alert>}
    </div>
  </main>;
}
