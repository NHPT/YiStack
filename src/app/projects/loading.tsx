'use client';

import type { ReactNode } from 'react';

const PROJECTS_LOADING_SKELETON_CARD_COUNT = 6;

type ProjectsLoadingSkeletonCardNodeList = ReactNode[];

function materializeProjectsLoadingSkeletonCardNodes(): ProjectsLoadingSkeletonCardNodeList {
  const nodes: ProjectsLoadingSkeletonCardNodeList = [];

  for (let index = 0; index < PROJECTS_LOADING_SKELETON_CARD_COUNT; index += 1) {
    nodes.push(
      <div key={index} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 h-6 w-2/3 animate-pulse rounded bg-muted" />
        <div className="mb-2 h-4 w-full animate-pulse rounded bg-muted" />
        <div className="mb-6 h-4 w-5/6 animate-pulse rounded bg-muted" />
        <div className="flex gap-2">
          <div className="h-8 w-20 animate-pulse rounded bg-muted" />
          <div className="h-8 w-16 animate-pulse rounded bg-muted" />
        </div>
      </div>,
    );
  }

  return nodes;
}

export default function ProjectsLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="h-6 w-28 animate-pulse rounded bg-muted" />
          <div className="h-9 w-24 animate-pulse rounded bg-muted" />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 space-y-3">
          <div className="h-8 w-40 animate-pulse rounded bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {materializeProjectsLoadingSkeletonCardNodes()}
        </div>
      </main>
    </div>
  );
}
