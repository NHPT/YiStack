import { NextRequest } from 'next/server';
import { buildBackendProxyErrorBody, proxyBackendRequest } from '@/app/api/_utils/backend-proxy';
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string;releaseId:string}>}) { const {id,releaseId}=await params; return proxyBackendRequest(request,{method:'GET',backendPath:`/api/project/${encodeURIComponent(id)}/deployment/releases/${encodeURIComponent(releaseId)}/logs`,errorBody:(error)=>buildBackendProxyErrorBody('deployment logs',error)}); }
