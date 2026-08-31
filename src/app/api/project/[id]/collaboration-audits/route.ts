import { NextRequest } from 'next/server';
import { buildBackendProxyErrorBody, proxyBackendRequest } from '@/app/api/_utils/backend-proxy';
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){const {id}=await params;return proxyBackendRequest(request,{method:'GET',backendPath:`/api/project/${encodeURIComponent(id)}/collaboration-audits`,errorBody:(error)=>buildBackendProxyErrorBody('collaboration audits',error)});}
