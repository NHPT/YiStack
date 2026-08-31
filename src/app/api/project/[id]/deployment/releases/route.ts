import { NextRequest } from 'next/server';
import { buildBackendProxyErrorBody, proxyBackendRequest } from '@/app/api/_utils/backend-proxy';
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}) { const {id}=await params; return proxyBackendRequest(request,{method:'GET',backendPath:`/api/project/${encodeURIComponent(id)}/deployment/releases`,errorBody:(error)=>buildBackendProxyErrorBody('deployment releases',error)}); }
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}) { const {id}=await params; return proxyBackendRequest(request,{method:'POST',backendPath:`/api/project/${encodeURIComponent(id)}/deployment/releases`,bodyMode:'json',errorBody:(error)=>buildBackendProxyErrorBody('deployment create',error)}); }
