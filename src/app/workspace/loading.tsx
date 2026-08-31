'use client';

import type { ReactNode } from 'react';

const WORKSPACE_LOADING_SIDEBAR_SKELETON_ITEM_COUNT = 8;
const WORKSPACE_LOADING_CHAT_SKELETON_MESSAGE_COUNT = 4;

type WorkspaceLoadingSidebarSkeletonNodeList = ReactNode[];
type WorkspaceLoadingChatSkeletonNodeList = ReactNode[];

function getWorkspaceLoadingChatSkeletonCardClassName(index: number): string {
  const alignmentClassName = index % 2 === 0 ? 'mr-auto w-[78%]' : 'ml-auto w-[62%]';
  return `max-w-3xl rounded-2xl border border-border bg-card p-4 shadow-sm ${alignmentClassName}`;
}

function materializeWorkspaceLoadingSidebarSkeletonNodes(): WorkspaceLoadingSidebarSkeletonNodeList {
  const nodes: WorkspaceLoadingSidebarSkeletonNodeList = [];

  for (let index = 0; index < WORKSPACE_LOADING_SIDEBAR_SKELETON_ITEM_COUNT; index += 1) {
    nodes.push(
      <div key={index} className="h-4 w-full animate-pulse rounded bg-muted" />,
    );
  }

  return nodes;
}

function materializeWorkspaceLoadingChatSkeletonNodes(): WorkspaceLoadingChatSkeletonNodeList {
  const nodes: WorkspaceLoadingChatSkeletonNodeList = [];

  for (let index = 0; index < WORKSPACE_LOADING_CHAT_SKELETON_MESSAGE_COUNT; index += 1) {
    const cardClassName = getWorkspaceLoadingChatSkeletonCardClassName(index);

    nodes.push(
      <div
        key={index}
        className={cardClassName}
      >
        <div className="mb-3 h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="mb-2 h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
      </div>,
    );
  }

  return nodes;
}

export default function WorkspaceLoading() {
  return (
    <div className="h-screen overflow-hidden bg-background text-foreground">
      <header className="border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex h-16 items-center justify-between px-4">
          <div className="h-6 w-28 animate-pulse rounded bg-muted" />
          <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        </div>
      </header>
      <div className="flex h-[calc(100vh-4rem)]">
        <aside className="hidden w-72 border-r border-border bg-card/60 p-4 lg:block">
          <div className="mb-4 h-5 w-24 animate-pulse rounded bg-muted" />
          <div className="space-y-3">
            {materializeWorkspaceLoadingSidebarSkeletonNodes()}
          </div>
        </aside>
        <main className="flex flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-hidden p-4">
            {materializeWorkspaceLoadingChatSkeletonNodes()}
          </div>
          <div className="border-t border-border bg-card/80 p-4">
            <div className="mb-3 h-24 w-full animate-pulse rounded-2xl bg-muted" />
            <div className="flex gap-2">
              <div className="h-9 w-20 animate-pulse rounded bg-muted" />
              <div className="h-9 w-20 animate-pulse rounded bg-muted" />
              <div className="ml-auto h-9 w-24 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
