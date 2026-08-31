import { NextRequest } from 'next/server';
import { buildBackendProxyErrorBody, proxyBackendRequest } from '@/app/api/_utils/backend-proxy';
export async function GET(request:NextRequest){return proxyBackendRequest(request,{method:'GET',backendPath:'/api/admin/project-templates',errorBody:(error)=>buildBackendProxyErrorBody('official templates',error)});}
export async function POST(request:NextRequest){return proxyBackendRequest(request,{method:'POST',backendPath:'/api/admin/project-templates',bodyMode:'json',errorBody:(error)=>buildBackendProxyErrorBody('official template publish',error)});}
