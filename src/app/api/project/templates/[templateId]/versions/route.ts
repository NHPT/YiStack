import { NextRequest } from 'next/server';
import { buildBackendProxyErrorBody, proxyBackendRequest } from '@/app/api/_utils/backend-proxy';
export async function GET(request:NextRequest,{params}:{params:Promise<{templateId:string}>}){const {templateId}=await params;return proxyBackendRequest(request,{method:'GET',backendPath:`/api/project/templates/${encodeURIComponent(templateId)}/versions`,errorBody:(error)=>buildBackendProxyErrorBody('official template versions',error)});}
