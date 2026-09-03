'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleAlert, Radio, Users } from 'lucide-react';

import { useAuth } from '@/contexts/auth-context';
import {
  CollaborationActivity,
  CollaborationEvent,
  CollaborationParticipant,
  CollaborationSnapshot,
  collaborationApi,
} from '@/lib/collaboration-api';
import { cn } from '@/lib/utils';

import { runSSEEventStream } from './workspace-orchestration-shared';

type CollaborationConnectionStatus = 'connecting' | 'live' | 'degraded';
type CollaborationConflict = { path: string; actor: string };

function collaborationClientStorageKey(projectId:string){
  return `yistack_collaboration_client:${projectId}`;
}

function getCollaborationClientId(projectId:string):string{
  const key=collaborationClientStorageKey(projectId);
  try{
    const existing=sessionStorage.getItem(key);
    if(existing&&existing.length>=8)return existing;
    const id=`web-${crypto.randomUUID()}`;
    sessionStorage.setItem(key,id);
    return id;
  }catch{
    return `web-${crypto.randomUUID()}`;
  }
}

function safeParseJSON<T>(raw:string,fallback:T):T{
  try{return JSON.parse(raw) as T;}catch{return fallback;}
}

function participantInitial(participant:CollaborationParticipant):string{
  const value=participant.username.trim();
  return (value.length>0?value:'?').slice(0,1).toUpperCase();
}

function participantTitle(participant:CollaborationParticipant):string{
  const file=participant.current_file?` · ${participant.current_file}`:'';
  return `${participant.username} · ${participant.role} · ${participant.activity}${file}`;
}

function getSelfCollaborationParticipant(
  participants: CollaborationParticipant[],
): CollaborationParticipant | undefined {
  for (const participant of participants) {
    if (participant.is_self) return participant;
  }
  return undefined;
}

function materializeCollaborationParticipantNodes(
  participants: CollaborationParticipant[],
) {
  const nodes = [];
  for (const participant of participants) {
    nodes.push(
      <span
        key={participant.session_id}
        title={participantTitle(participant)}
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-background bg-foreground text-[10px] font-semibold text-background',
          participant.is_self?'ring-1 ring-emerald-500':'',
        )}
      >
        {participantInitial(participant)}
      </span>,
    );
  }
  return nodes;
}

function collaborationActivity(activeFile:string|null,canWrite:boolean):CollaborationActivity{
  if(activeFile&&canWrite)return 'editing';
  return 'viewing';
}

function dispatchRemoteCollaborationEvent(event:CollaborationEvent,userId:string|number|undefined){
  if(userId===undefined||event.actor_user_id===String(userId))return;
  if(event.event_type!=='file_saved'&&event.event_type!=='tree_changed')return;
  window.dispatchEvent(new CustomEvent('yistack:collaboration-resource-changed',{detail:event}));
}

export function WorkspaceCollaborationPresence({
  projectId,
  activeFile,
}:{
  projectId:string;
  activeFile:string|null;
}){
  const {user}=useAuth();
  const [clientId,setClientId]=useState('');
  const [participants,setParticipants]=useState<CollaborationParticipant[]>([]);
  const [status,setStatus]=useState<CollaborationConnectionStatus>('connecting');
  const [conflict,setConflict]=useState<CollaborationConflict|null>(null);
  const cursorRef=useRef(0);
  const sessionIdRef=useRef('');
  const canWriteRef=useRef(false);

  const applySnapshot=useCallback((snapshot:CollaborationSnapshot)=>{
    if(snapshot.schema_version!=='project_collaboration.v1'||snapshot.project_id!==projectId)return;
    setParticipants(snapshot.participants);
    if(snapshot.session_id)sessionIdRef.current=snapshot.session_id;
    if(snapshot.cursor>cursorRef.current)cursorRef.current=snapshot.cursor;
    for(const event of snapshot.events){
      dispatchRemoteCollaborationEvent(event,user?.id);
    }
    const self=getSelfCollaborationParticipant(snapshot.participants);
    canWriteRef.current=self?.role==='owner'||self?.role==='editor';
    setStatus('live');
  },[projectId,user?.id]);

  useEffect(()=>{
    cursorRef.current=0;
    sessionIdRef.current='';
    canWriteRef.current=false;
    setParticipants([]);
    setConflict(null);
    setStatus('connecting');
    setClientId(getCollaborationClientId(projectId));
  },[projectId]);

  useEffect(()=>{
    const handleConflict=(rawEvent:Event)=>{
      if(!(rawEvent instanceof CustomEvent))return;
      const detail=rawEvent.detail as Partial<CollaborationConflict>|undefined;
      if(typeof detail?.path!=='string'||detail.path.length===0)return;
      setConflict({
        path:detail.path,
        actor:typeof detail.actor==='string'&&detail.actor.length>0?detail.actor:'其他协作者',
      });
    };
    const handleConflictResolved=(rawEvent:Event)=>{
      if(!(rawEvent instanceof CustomEvent))return;
      const path=rawEvent.detail?.path;
      if(typeof path!=='string')return;
      setConflict((current)=>current?.path===path?null:current);
    };
    window.addEventListener('yistack:collaboration-conflict',handleConflict);
    window.addEventListener('yistack:collaboration-conflict-resolved',handleConflictResolved);
    return()=>{
      window.removeEventListener('yistack:collaboration-conflict',handleConflict);
      window.removeEventListener('yistack:collaboration-conflict-resolved',handleConflictResolved);
    };
  },[]);

  useEffect(()=>{
    if(!clientId)return;
    let disposed=false;
    const touch=async()=>{
      try{
        const access=await collaborationApi.access(projectId);
        canWriteRef.current=access.can_write;
        const snapshot=await collaborationApi.touchPresence(projectId,{
          client_id:clientId,
          activity:collaborationActivity(activeFile,canWriteRef.current),
          current_file:activeFile??'',
          after_sequence:cursorRef.current,
        });
        if(!disposed)applySnapshot(snapshot);
      }catch{
        if(!disposed)setStatus('degraded');
      }
    };
    void touch();
    const heartbeat=window.setInterval(()=>void touch(),20_000);
    return()=>{
      disposed=true;
      window.clearInterval(heartbeat);
    };
  },[activeFile,applySnapshot,clientId,projectId]);

  useEffect(()=>{
    if(!clientId)return;
    const controller=new AbortController();
    let disposed=false;
    const follow=async()=>{
      while(!disposed){
        try{
          const response=await collaborationApi.streamEvents(projectId,cursorRef.current,controller.signal);
          await runSSEEventStream({
            response,
            safeParseJSON,
            handlers:{
              presence_joined:async(data)=>refreshForEvent(data),
              presence_updated:async(data)=>refreshForEvent(data),
              presence_left:async(data)=>refreshForEvent(data),
              presence_expired:async(data)=>refreshForEvent(data),
              file_saved:(data)=>handleResourceEvent(data),
              tree_changed:(data)=>handleResourceEvent(data),
              collaboration_heartbeat:()=>setStatus('live'),
              collaboration_error:()=>setStatus('degraded'),
            },
            unreadableMessage:'协作事件流不可读',
            unreadableSource:'collaboration_event_stream',
            onEventCursor:(cursor)=>{
              const parsed=Number.parseInt(cursor,10);
              if(Number.isFinite(parsed)&&parsed>cursorRef.current)cursorRef.current=parsed;
            },
          });
        }catch{
          if(!disposed)setStatus('degraded');
        }
        if(!disposed)await new Promise((resolve)=>window.setTimeout(resolve,1_000));
      }
    };
    const refreshForEvent=async(data:Record<string,unknown>)=>{
      void data;
      try{
        const snapshot=await collaborationApi.state(projectId,cursorRef.current,sessionIdRef.current);
        if(!disposed)applySnapshot(snapshot);
      }catch{
        if(!disposed)setStatus('degraded');
      }
    };
    const handleResourceEvent=(data:Record<string,unknown>)=>{
      const event=data as unknown as CollaborationEvent;
      dispatchRemoteCollaborationEvent(event,user?.id);
      setStatus('live');
    };
    void follow();
    return()=>{
      disposed=true;
      controller.abort();
      void collaborationApi.leavePresence(projectId,clientId).catch(()=>undefined);
    };
  },[applySnapshot,clientId,projectId,user?.id]);

  const visibleParticipants=useMemo(()=>participants.slice(0,4),[participants]);
  const statusLabel=status==='live'?'协作在线':status==='connecting'?'正在连接':'协作连接异常';
  const statusIcon=status==='degraded'?<CircleAlert className="h-3.5 w-3.5"/>:<Radio className="h-3.5 w-3.5"/>;
  const conflictLabel=conflict===null?'':`${conflict.actor} 已修改 ${conflict.path}，本地未覆盖`;

  return <div
    data-testid="workspace-collaboration-presence"
    aria-label={`${statusLabel}，${participants.length} 个会话${conflictLabel?`，${conflictLabel}`:''}`}
    title={conflictLabel||statusLabel}
    className={cn(
      'flex h-8 min-w-0 items-center gap-2 border-l pl-3 text-xs',
      status==='degraded'?'text-amber-700 dark:text-amber-300':'text-muted-foreground',
    )}
  >
    {statusIcon}
    <div className="flex -space-x-1.5" aria-label="在线协作者">
      {materializeCollaborationParticipantNodes(visibleParticipants)}
    </div>
    <span className="hidden whitespace-nowrap sm:inline">{participants.length} 在线</span>
    {conflict!==null&&(
      <span
        data-testid="workspace-collaboration-conflict"
        className="hidden max-w-56 truncate text-amber-700 dark:text-amber-300 md:inline"
      >
        {conflictLabel}
      </span>
    )}
    <Users className="h-3.5 w-3.5 sm:hidden"/>
  </div>;
}
