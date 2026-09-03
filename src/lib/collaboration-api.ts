'use client';

import { readUserAuthTokenStorage } from '@/lib/auth-storage';
import { readAdminTokenStorage } from '@/lib/admin/api';

export type ProjectAccess = { role:'owner'|'editor'|'viewer'; can_read:boolean; can_write:boolean; can_manage:boolean };
export type ProjectMember = { id:string; user_id:string; email:string; username:string; role:'owner'|'editor'|'viewer'; status:string; created_at:string; updated_at:string };
export type CollaborationAudit = { id:string; actor_user_id:string; target_user_id:string; action:string; previous_role?:string; next_role?:string; created_at:string };
export type CollaborationActivity = 'idle'|'viewing'|'editing'|'generating';
export type CollaborationParticipant = {
  session_id:string;
  user_id:string;
  username:string;
  avatar_url?:string;
  role:'owner'|'editor'|'viewer';
  activity:CollaborationActivity;
  current_file?:string;
  is_self:boolean;
  joined_at:string;
  last_seen_at:string;
  expires_at:string;
};
export type CollaborationEvent = {
  sequence:number;
  id:string;
  project_id:string;
  event_type:'presence_joined'|'presence_updated'|'presence_left'|'presence_expired'|'file_saved'|'tree_changed';
  actor_user_id:string;
  actor_username:string;
  session_id?:string;
  resource_path?:string;
  resource_revision?:string;
  metadata?:{
    role?:string;
    source?:string;
    operation?:string;
    previous_path?:string;
  };
  created_at:string;
};
export type CollaborationSnapshot = {
  schema_version:'project_collaboration.v1';
  project_id:string;
  session_id?:string;
  cursor:number;
  participants:CollaborationParticipant[];
  events:CollaborationEvent[];
};
export type OfficialTemplateVersion = { id:string; template_id:string; version:number; status:string; manifest_json:string; checksum_sha256:string; created_by:string; created_at:string };
export type OfficialTemplate = { template:{id:string;slug:string;name:string;description:string;app_type:string;status:string;current_version_id:string}; current_version?:OfficialTemplateVersion };
export type TemplateFileInput = { path:string; content:string };
export type TemplateProject = { project_id:string; name:string; app_type:string };
type ApiResponse<T> = { success?:boolean; data?:T; error?:string; code?:string };

async function request<T>(path:string,options:{method?:'GET'|'POST'|'DELETE';body?:object;admin?:boolean}={}):Promise<T>{
  const tokenResult=options.admin?readAdminTokenStorage():readUserAuthTokenStorage();
  const token=tokenResult.ok?tokenResult.value:null;
  const response=await fetch(`/api${path}`,{method:options.method??'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:options.body?JSON.stringify(options.body):undefined});
  const payload=await response.json() as ApiResponse<T>;
  if(!response.ok||payload.success===false||payload.data===undefined)throw new Error(payload.error||payload.code||`Request failed (${response.status})`);
  return payload.data;
}

async function requestStream(path:string,signal?:AbortSignal):Promise<Response>{
  const tokenResult=readUserAuthTokenStorage();
  const token=tokenResult.ok?tokenResult.value:null;
  const response=await fetch(`/api${path}`,{
    method:'GET',
    headers:{Accept:'text/event-stream',...(token?{Authorization:`Bearer ${token}`}:{})},
    cache:'no-store',
    signal,
  });
  if(!response.ok){
    let message=`Request failed (${response.status})`;
    try{
      const payload=await response.json() as ApiResponse<unknown>;
      message=payload.error||payload.code||message;
    }catch{}
    throw new Error(message);
  }
  return response;
}

export const collaborationApi={
  access:(projectId:string)=>request<ProjectAccess>(`/project/${encodeURIComponent(projectId)}/access`),
  members:(projectId:string)=>request<ProjectMember[]>(`/project/${encodeURIComponent(projectId)}/members`),
  audits:(projectId:string)=>request<CollaborationAudit[]>(`/project/${encodeURIComponent(projectId)}/collaboration-audits`),
  state:(projectId:string,cursor=0,sessionId='')=>{
    const query=new URLSearchParams({cursor:String(cursor)});
    if(sessionId)query.set('session_id',sessionId);
    return request<CollaborationSnapshot>(`/project/${encodeURIComponent(projectId)}/collaboration/state?${query.toString()}`);
  },
  touchPresence:(projectId:string,input:{client_id:string;activity:CollaborationActivity;current_file?:string;after_sequence?:number})=>request<CollaborationSnapshot>(`/project/${encodeURIComponent(projectId)}/collaboration/presence`,{method:'POST',body:input}),
  leavePresence:(projectId:string,clientId:string)=>request<{left:boolean}>(`/project/${encodeURIComponent(projectId)}/collaboration/presence`,{method:'DELETE',body:{client_id:clientId}}),
  streamEvents:(projectId:string,cursor:number,signal?:AbortSignal)=>requestStream(`/project/${encodeURIComponent(projectId)}/collaboration/events?cursor=${encodeURIComponent(String(cursor))}`,signal),
  setMember:(projectId:string,email:string,userId:string,role:'viewer'|'editor')=>request<ProjectMember>(`/project/${encodeURIComponent(projectId)}/members`,{method:'POST',body:{email,user_id:userId,role,confirm:true}}),
  removeMember:(projectId:string,userId:string)=>request<{removed:boolean}>(`/project/${encodeURIComponent(projectId)}/members`,{method:'DELETE',body:{user_id:userId,confirm:true}}),
  templates:()=>request<OfficialTemplate[]>('/project/templates'),
  versions:(templateId:string)=>request<OfficialTemplateVersion[]>(`/project/templates/${encodeURIComponent(templateId)}/versions`),
  createFromTemplate:(slug:string,versionId:string,name:string,description:string)=>request<TemplateProject>('/project/templates/create',{method:'POST',body:{slug,version_id:versionId,name,description,confirm:true}}),
  adminTemplates:()=>request<OfficialTemplate[]>('/admin/project-templates',{admin:true}),
  publishTemplate:(input:{slug:string;name:string;description:string;app_type:string;expected_current_version_id:string;files:TemplateFileInput[]})=>request<OfficialTemplate>('/admin/project-templates',{method:'POST',admin:true,body:{...input,confirm:true}}),
  adminVersions:(templateId:string)=>request<OfficialTemplateVersion[]>(`/admin/project-templates/${encodeURIComponent(templateId)}/versions`,{admin:true}),
  rollbackTemplate:(templateId:string,targetVersionId:string,expectedCurrentVersionId:string)=>request<OfficialTemplate>(`/admin/project-templates/${encodeURIComponent(templateId)}/rollback`,{method:'POST',admin:true,body:{target_version_id:targetVersionId,expected_current_version_id:expectedCurrentVersionId,confirm:true}}),
};
