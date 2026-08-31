import { NextRequest } from 'next/server';
import { buildBackendProxyErrorBody, proxyBackendRequest } from '@/app/api/_utils/backend-proxy';
export async function POST(request:NextRequest,{params}:{params:Promise<{templateId:string}>}){const {templateId}=await params;return proxyBackendRequest(request,{method:'POST',backendPath:`/api/admin/project-templates/${encodeURIComponent(templateId)}/rollback`,bodyMode:'json',errorBody:(error)=>buildBackendProxyErrorBody('official template rollback',error)});}
