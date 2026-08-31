'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { FileCode, Github, GitBranch as GitBranchIcon, History, RefreshCw, Rocket, Users } from 'lucide-react';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type {
  GitBranch as GitBranchRecord,
  GitBranchCompare,
  GitBranchCompareCommit,
  GitBranchCompareFile,
  GitBranchSwitchReadiness,
  GitCommit,
  GitDiff,
  GitRemote,
  GitRemoteBranch,
  GitStash,
  GitTag,
  GitWorktreeStatus,
} from '@/lib/types';

import { normalizeCommitVersion } from './workspace-page-helpers';
import type { SharedGitProps } from './workspace-ide-subpanel-types';
import type {
  GitBranchMutationConfirmationAction,
  GitRemoteListStatus,
  GitTagMutationConfirmationAction,
} from './workspace-types';
import {
  buildGitBranchSnapshot,
  buildGitBranchCompareSnapshot,
  buildGitBranchCompareFileApplyConfirmationSnapshot,
  buildGitBranchMutationConfirmationSnapshot,
  buildGitBranchSwitchConfirmationSnapshot,
  buildGitTagMutationConfirmationSnapshot,
  buildGitRemoteBranchCreateConfirmationSnapshot,
  buildGitRemoteBranchRefreshConfirmationSnapshot,
  buildGitRemoteBranchSnapshot,
  buildGitStashMutationConfirmationSnapshot,
  buildGitStashSnapshot,
  buildGitTagSnapshot,
  buildGitWorktreeCommitConfirmationSnapshot,
  buildGitWorktreeFileDiscardConfirmationSnapshot,
  buildGitWorktreeSnapshot,
  buildGitCommitDetailSnapshot,
  buildGitCommitFileRestoreConfirmationSnapshot,
  buildGitCommitItemSnapshot,
  buildGitDiffFileItemSnapshot,
  buildGitPanelSnapshot,
  GitBranchSnapshotStrip,
  GitBranchCompareSnapshotStrip,
  GitBranchCompareFileApplyConfirmationSnapshotStrip,
  GitBranchMutationConfirmationSnapshotStrip,
  GitBranchSwitchConfirmationSnapshotStrip,
  GitTagMutationConfirmationSnapshotStrip,
  GitRemoteBranchCreateConfirmationSnapshotStrip,
  GitRemoteBranchRefreshConfirmationSnapshotStrip,
  GitRemoteBranchSnapshotStrip,
  GitStashMutationConfirmationSnapshotStrip,
  GitStashSnapshotStrip,
  GitTagSnapshotStrip,
  GitWorktreeCommitConfirmationSnapshotStrip,
  GitWorktreeFileDiscardConfirmationSnapshotStrip,
  GitWorktreeSnapshotStrip,
  GitCommitDetailSnapshotStrip,
  GitCommitFileRestoreConfirmationSnapshotStrip,
  GitCommitItemSnapshotStrip,
  GitDiffFileItemSnapshotStrip,
  GitPanelSnapshotStrip,
  type GitBranchCompareFileApplyConfirmation,
  type GitBranchMutationConfirmation,
  type GitBranchSwitchConfirmation,
  type GitCommitFileRestoreConfirmation,
  type GitRemoteBranchCreateConfirmation,
  type GitRemoteBranchCreateLocalNameDraftMap,
  type GitRemoteBranchRefreshConfirmation,
  type GitStashMutationConfirmation,
  type GitTagMutationConfirmation,
  type GitWorktreeCommitConfirmation,
  type GitWorktreeFileDiscardConfirmation,
} from './workspace-git-panel-snapshot';

function getGitPanelOptionalTextValue(value: string | null | undefined): string {
  if (value === null) {
    return '';
  }

  if (value === undefined) {
    return '';
  }

  return value;
}

function getGitPanelDisplayLabel(value: string | null | undefined, fallback: string): string {
  const labelValue = getGitPanelOptionalTextValue(value);
  const hasLabelValue = labelValue.length > 0;

  if (hasLabelValue === true) {
    return labelValue;
  }

  return fallback;
}

function getGitConfirmationDialogLabel(value: string | null | undefined): string {
  return getGitPanelDisplayLabel(value, 'unknown');
}

function getGitBranchCompareFileApplyHeadBranchLabel(
  confirmation: GitBranchCompareFileApplyConfirmation | null,
): string {
  if (confirmation === null) {
    return getGitConfirmationDialogLabel(null);
  }

  return getGitConfirmationDialogLabel(confirmation.headBranch);
}

function getGitBranchCompareFileApplyFilePathLabel(
  confirmation: GitBranchCompareFileApplyConfirmation | null,
): string {
  if (confirmation === null) {
    return getGitConfirmationDialogLabel(null);
  }

  return getGitConfirmationDialogLabel(confirmation.filePath);
}

function getGitBranchCompareFileApplyBaseBranchLabel(
  confirmation: GitBranchCompareFileApplyConfirmation | null,
): string {
  if (confirmation === null) {
    return getGitConfirmationDialogLabel(null);
  }

  return getGitConfirmationDialogLabel(confirmation.baseBranch);
}

function getGitCommitFileRestoreFilePathLabel(confirmation: GitCommitFileRestoreConfirmation | null): string {
  if (confirmation === null) {
    return getGitConfirmationDialogLabel(null);
  }

  return getGitConfirmationDialogLabel(confirmation.filePath);
}

function getGitTagMutationTagNameLabel(confirmation: GitTagMutationConfirmation | null): string {
  if (confirmation === null) {
    return getGitConfirmationDialogLabel(null);
  }

  return getGitConfirmationDialogLabel(confirmation.tagName);
}

function getGitBranchMutationBranchNameLabel(confirmation: GitBranchMutationConfirmation | null): string {
  if (confirmation === null) {
    return getGitConfirmationDialogLabel(null);
  }

  return getGitConfirmationDialogLabel(confirmation.branchName);
}

function getGitBranchMutationNextBranchName(confirmation: GitBranchMutationConfirmation): string {
  if (confirmation.nextBranchName === undefined) {
    return '';
  }

  return confirmation.nextBranchName;
}

function getGitBranchMutationNextBranchNameLabel(confirmation: GitBranchMutationConfirmation | null): string {
  if (confirmation === null) {
    return getGitConfirmationDialogLabel(null);
  }

  return getGitConfirmationDialogLabel(getGitBranchMutationNextBranchName(confirmation));
}

function canConfirmGitBranchRenameMutation(confirmation: GitBranchMutationConfirmation): boolean {
  if (confirmation.action !== 'rename') {
    return false;
  }

  const nextBranchName = getGitBranchMutationNextBranchName(confirmation);
  return canUseGitPanelTextValue(nextBranchName);
}

function getGitBranchSwitchCurrentBranchDialogLabel(confirmation: GitBranchSwitchConfirmation | null): string {
  if (confirmation === null) {
    return getGitConfirmationDialogLabel(null);
  }

  return getGitConfirmationDialogLabel(confirmation.currentBranch);
}

function getGitBranchSwitchTargetBranchDialogLabel(confirmation: GitBranchSwitchConfirmation | null): string {
  if (confirmation === null) {
    return getGitConfirmationDialogLabel(null);
  }

  return getGitConfirmationDialogLabel(confirmation.targetBranch);
}

function getGitRemoteBranchRefreshRemoteNameLabel(confirmation: GitRemoteBranchRefreshConfirmation | null): string {
  if (confirmation === null) {
    return getGitConfirmationDialogLabel(null);
  }

  return getGitConfirmationDialogLabel(confirmation.remoteName);
}

function getGitRemoteBranchCreateRemoteBranchNameLabel(
  confirmation: GitRemoteBranchCreateConfirmation | null,
): string {
  if (confirmation === null) {
    return getGitConfirmationDialogLabel(null);
  }

  return getGitConfirmationDialogLabel(confirmation.remoteBranchName);
}

function getGitRemoteBranchCreateLocalBranchNameLabel(
  confirmation: GitRemoteBranchCreateConfirmation | null,
): string {
  if (confirmation === null) {
    return getGitConfirmationDialogLabel(null);
  }

  return getGitConfirmationDialogLabel(confirmation.localBranchName);
}

function getGitStashMutationStashRefLabel(confirmation: GitStashMutationConfirmation | null): string {
  if (confirmation === null) {
    return getGitConfirmationDialogLabel(null);
  }

  return getGitConfirmationDialogLabel(confirmation.stashRef);
}

function getGitStashMutationMessageLabel(confirmation: GitStashMutationConfirmation | null): string {
  if (confirmation === null) {
    return getGitConfirmationDialogLabel(null);
  }

  return getGitConfirmationDialogLabel(confirmation.stashMessage);
}

function getGitWorktreeCommitDirtyFilesLabel(confirmation: GitWorktreeCommitConfirmation | null): number {
  if (confirmation === null) {
    return 0;
  }

  if (confirmation.dirtyFiles === undefined) {
    return 0;
  }

  return confirmation.dirtyFiles;
}

function getGitWorktreeCommitCurrentBranchLabel(confirmation: GitWorktreeCommitConfirmation | null): string {
  if (confirmation === null) {
    return getGitConfirmationDialogLabel(null);
  }

  return getGitConfirmationDialogLabel(confirmation.currentBranch);
}

function getGitWorktreeFileDiscardFilePathLabel(confirmation: GitWorktreeFileDiscardConfirmation | null): string {
  if (confirmation === null) {
    return getGitConfirmationDialogLabel(null);
  }

  return getGitConfirmationDialogLabel(confirmation.filePath);
}

function getGitReadOnlyListLabel(value: string | null | undefined, fallback: string): string {
  return getGitPanelDisplayLabel(value, fallback);
}

function getGitRemoteListStatusLabel(status: GitRemoteListStatus | null): string {
  if (status === null) {
    return getGitReadOnlyListLabel(null, 'unknown');
  }

  return getGitReadOnlyListLabel(status.status, 'unknown');
}

function canViewGitReadOnlyCommit(hash: string): boolean {
  const hasHash = hash.length > 0;
  return hasHash === true;
}

function getGitBranchCompareCommitViewMessage(commit: GitBranchCompareCommit, headBranch: string): string {
  const headBranchLabel = getGitReadOnlyListLabel(headBranch, 'branch-compare');
  return getGitReadOnlyListLabel(commit.message, headBranchLabel);
}

function getGitBranchCompareCommitViewAuthor(commit: GitBranchCompareCommit): string {
  return getGitReadOnlyListLabel(commit.author, 'branch-compare');
}

function getGitBranchCompareCommitViewEmail(commit: GitBranchCompareCommit): string {
  return getGitReadOnlyListLabel(commit.email, '');
}

function getGitBranchCompareCommitViewTime(commit: GitBranchCompareCommit): string {
  return getGitReadOnlyListLabel(commit.time, '');
}

function getGitBranchCompareCommitViewBranches(headBranch: string): string[] {
  const headBranchLabel = getGitReadOnlyListLabel(headBranch, 'unknown');
  return [headBranchLabel];
}

function getGitBranchBadgeVariant(branch: GitBranchRecord): 'default' | 'secondary' {
  if (branch.is_current === true) {
    return 'default';
  }

  return 'secondary';
}

function getGitBranchBadgeLabel(branch: GitBranchRecord): string {
  if (branch.is_current === true) {
    return 'current';
  }

  return 'branch';
}

function getGitBranchViewAuthor(branch: GitBranchRecord): string {
  if (branch.is_current === true) {
    return 'current-branch';
  }

  return 'branch';
}

function getGitBranchUpstreamLabel(branch: GitBranchRecord): string {
  if (branch.has_upstream === false) {
    return 'no upstream';
  }

  return getGitReadOnlyListLabel(branch.upstream, 'no upstream');
}

function getGitTagViewMessage(tag: GitTag): string {
  return getGitReadOnlyListLabel(tag.message, tag.name);
}

function getGitStashViewMessage(stash: GitStash): string {
  return getGitReadOnlyListLabel(stash.message, stash.ref);
}

type GitPanelStaleBannerStatusValue = 'fresh' | 'stale_with_cache' | 'stale_without_cache' | 'no_target';

type GitPanelStaleBannerStatus = {
  status: GitPanelStaleBannerStatusValue;
  message: string;
};

type GitPanelCommitDetailStatus = {
  status: 'fresh' | 'stale_from_cache';
  commitHash: string;
  message: string;
};

function getGitPanelStaleBannerStatusValue(
  status: GitPanelStaleBannerStatus | null,
): GitPanelStaleBannerStatusValue | null {
  if (status === null) {
    return null;
  }

  return status.status;
}

function isGitPanelStaleBannerFreshStatus(statusValue: GitPanelStaleBannerStatusValue | null): boolean {
  return statusValue === 'fresh';
}

function isGitPanelStaleBannerNoTargetStatus(statusValue: GitPanelStaleBannerStatusValue | null): boolean {
  return statusValue === 'no_target';
}

function isGitPanelStaleBannerWithCacheStatus(statusValue: GitPanelStaleBannerStatusValue | null): boolean {
  return statusValue === 'stale_with_cache';
}

function canRenderGitPanelStaleBanner(status: GitPanelStaleBannerStatus | null, hidesNoTarget: boolean): boolean {
  const statusValue = getGitPanelStaleBannerStatusValue(status);
  const isFreshStatus = isGitPanelStaleBannerFreshStatus(statusValue);
  const isNoTargetStatus = isGitPanelStaleBannerNoTargetStatus(statusValue);

  if (statusValue === null) {
    return false;
  }

  if (isFreshStatus === true) {
    return false;
  }

  if (hidesNoTarget === true && isNoTargetStatus === true) {
    return false;
  }

  return true;
}

function getGitPanelStaleBannerTitle(status: GitPanelStaleBannerStatus | null, resourceLabel: string): string {
  const statusValue = getGitPanelStaleBannerStatusValue(status);
  const isStaleWithCacheStatus = isGitPanelStaleBannerWithCacheStatus(statusValue);

  if (isStaleWithCacheStatus === true) {
    return `Git ${resourceLabel}当前显示旧快照`;
  }

  return `Git ${resourceLabel}当前没有可确认快照`;
}

function getGitPanelStaleBannerMessage(status: GitPanelStaleBannerStatus | null): string {
  if (status === null) {
    return '';
  }

  return status.message;
}

function isGitPanelCommitSelected(selectedCommit: GitCommit | null, commit: GitCommit): boolean {
  if (selectedCommit === null) {
    return false;
  }

  return selectedCommit.hash === commit.hash;
}

function canRenderGitPanelSelectedCommitDetail(selectedCommit: GitCommit | null): selectedCommit is GitCommit {
  if (selectedCommit === null) {
    return false;
  }

  return true;
}

function canRenderGitPanelEmptySelectedCommitDetail(selectedCommit: GitCommit | null): boolean {
  if (selectedCommit === null) {
    return true;
  }

  return false;
}

function canRenderGitPanelInlineCommitDetail(isSelected: boolean): boolean {
  return isSelected === true;
}

function getGitPanelCommitRowSelectedClassName(isSelected: boolean): string | undefined {
  if (isSelected === true) {
    return 'bg-muted';
  }

  return undefined;
}

function getGitPanelCommitRowClassName(baseClassName: string, isSelected: boolean): string {
  const selectedClassName = getGitPanelCommitRowSelectedClassName(isSelected);
  return cn(baseClassName, selectedClassName);
}

function canRenderGitPanelCommitDetailStaleBanner(
  status: GitPanelCommitDetailStatus | null,
  commit: GitCommit,
): boolean {
  if (status === null) {
    return false;
  }

  if (status.status !== 'stale_from_cache') {
    return false;
  }

  return status.commitHash === commit.hash;
}

function getGitPanelCommitDetailStaleBannerMessage(status: GitPanelCommitDetailStatus | null): string {
  if (status === null) {
    return '';
  }

  return status.message;
}

function getGitPanelCommitRowKey(commit: GitCommit, index: number): string {
  const hasCommitHash = commit.hash.length > 0;
  if (hasCommitHash === true) {
    return commit.hash;
  }

  return `commit-${index}`;
}

function getGitPanelDiffFileItemKey(file: GitDiff, fallbackPrefix: string, index: number): string {
  const hasFilePath = file.path.length > 0;
  if (hasFilePath === true) {
    return file.path;
  }

  return `${fallbackPrefix}-${index}`;
}

function getGitPanelDiffLineKey(fileItemKey: string, lineIndex: number): string {
  return `${fileItemKey}-${lineIndex}`;
}

function isGitPanelDiffLineAddition(line: string): boolean {
  return line.startsWith('+');
}

function isGitPanelDiffLineDeletion(line: string): boolean {
  return line.startsWith('-');
}

function isGitPanelDiffLineNeutral(isAddition: boolean, isDeletion: boolean): boolean {
  if (isAddition === true) {
    return false;
  }

  if (isDeletion === true) {
    return false;
  }

  return true;
}

function getGitPanelDiffLineToneClassName({
  isAddition,
  isDeletion,
  isNeutral,
}: {
  isAddition: boolean;
  isDeletion: boolean;
  isNeutral: boolean;
}): string | undefined {
  if (isAddition === true) {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
  }

  if (isDeletion === true) {
    return 'bg-red-500/15 text-red-700 dark:text-red-300';
  }

  if (isNeutral === true) {
    return 'text-muted-foreground';
  }

  return undefined;
}

function getGitPanelDiffLineClassName(line: string, baseClassName: string): string {
  const isAddition = isGitPanelDiffLineAddition(line);
  const isDeletion = isGitPanelDiffLineDeletion(line);
  const isNeutral = isGitPanelDiffLineNeutral(isAddition, isDeletion);
  const toneClassName = getGitPanelDiffLineToneClassName({
    isAddition,
    isDeletion,
    isNeutral,
  });

  return cn(baseClassName, toneClassName);
}

function getGitPanelDiffContentLines(content: string): string[] {
  return content.split('\n');
}

function materializeGitPanelDiffLineNodes({
  lines,
  fileItemKey,
  lineBaseClassName,
}: {
  lines: string[];
  fileItemKey: string;
  lineBaseClassName: string;
}): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lineIndex = 0;

  for (const line of lines) {
    const diffLineKey = getGitPanelDiffLineKey(fileItemKey, lineIndex);
    const diffLineClassName = getGitPanelDiffLineClassName(line, lineBaseClassName);

    nodes.push(
      <div
        key={diffLineKey}
        className={diffLineClassName}
      >
        {line}
      </div>,
    );

    lineIndex += 1;
  }

  return nodes;
}

function materializeGitPanelCommitNodes({
  commits,
  selectedCommit,
  gitCommitDetailStatus,
  gitCommitDetailSnapshot,
  onViewCommit,
  onOpenFile,
  onCopyText,
  setPendingCommitFileRestoreConfirmation,
}: {
  commits: GitCommit[];
  selectedCommit: GitCommit | null;
  gitCommitDetailStatus: SharedGitProps['gitCommitDetailStatus'];
  gitCommitDetailSnapshot: ReturnType<typeof buildGitCommitDetailSnapshot>;
  onViewCommit: SharedGitProps['onViewCommit'];
  onOpenFile: SharedGitProps['onOpenFile'];
  onCopyText: SharedGitProps['onCopyText'];
  setPendingCommitFileRestoreConfirmation: (confirmation: GitCommitFileRestoreConfirmation) => void;
}): ReactNode[] {
  const nodes: ReactNode[] = [];
  let commitIndex = 0;

  for (const commit of commits) {
    const isSelected = isGitPanelCommitSelected(selectedCommit, commit);
    const commitRowKey = getGitPanelCommitRowKey(commit, commitIndex);
    const canRenderInlineCommitDetail = canRenderGitPanelInlineCommitDetail(isSelected);
    const commitRowClassName = getGitPanelCommitRowClassName(
      'w-full p-3 text-left transition-colors hover:bg-muted/50',
      isSelected,
    );
    const canRenderCommitDetailStaleBanner = canRenderGitPanelCommitDetailStaleBanner(
      gitCommitDetailStatus,
      commit,
    );
    const commitDetailStaleBannerMessage = getGitPanelCommitDetailStaleBannerMessage(gitCommitDetailStatus);
    const commitDiffFiles = getGitPanelCommitDiffFiles(commit);
    const commitDiffFileCount = getGitPanelCollectionItemCount(commitDiffFiles);
    const canRenderCommitDiffFiles = canRenderGitPanelCollection(commitDiffFileCount);
    const gitCommitItemSnapshot = buildGitCommitItemSnapshot({
      commit,
      index: commitIndex,
      isSelected,
      gitCommitDetailStatus,
    });
    const commitDiffFileNodes = materializeGitPanelInlineCommitDiffFileNodes({
      commit,
      files: commitDiffFiles,
      onOpenFile,
      onCopyText,
      setPendingCommitFileRestoreConfirmation,
    });

    nodes.push(
      <div key={commitRowKey} className="border-b">
        <button onClick={() => void onViewCommit(commit)} className={commitRowClassName}>
          <div className="mb-1 flex items-center gap-2">
            <History className="h-4 w-4 shrink-0 text-muted-foreground" />
            <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
              {normalizeCommitVersion(commit.hash)}
            </code>
            <span className="ml-auto text-xs text-muted-foreground">{commit.time}</span>
          </div>
          <p className="truncate text-sm">{commit.message}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{commit.files} 个文件变更</p>
          <span className="app-debug-only">
            <GitCommitItemSnapshotStrip snapshot={gitCommitItemSnapshot} />
          </span>
        </button>

        {canRenderInlineCommitDetail === true && (
          <div className="bg-muted/20 px-3 pb-3">
            {canRenderCommitDetailStaleBanner === true && (
              <div className="mb-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                <p className="font-medium">当前版本详情来自缓存快照</p>
                <p className="mt-1">{commitDetailStaleBannerMessage}</p>
              </div>
            )}
            <GitCommitDetailSnapshotStrip snapshot={gitCommitDetailSnapshot} />
            {canRenderCommitDiffFiles === true ? (
              <>
                <p className="py-2 text-xs text-muted-foreground">变更文件：</p>
                {commitDiffFileNodes}
              </>
            ) : (
              <p className="py-2 text-xs text-muted-foreground">暂无变更详情</p>
            )}
          </div>
        )}
      </div>,
    );

    commitIndex += 1;
  }

  return nodes;
}

function materializeGitPanelBranchNodes({
  branches,
  onViewCommit,
}: {
  branches: GitBranchRecord[];
  onViewCommit: SharedGitProps['onViewCommit'];
}): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const branch of branches) {
    const branchLastCommitLabel = getGitReadOnlyListLabel(branch.last_commit, 'unknown');
    const canViewBranchCommit = canViewGitReadOnlyCommit(branch.last_commit);
    const branchBadgeVariant = getGitBranchBadgeVariant(branch);
    const branchBadgeLabel = getGitBranchBadgeLabel(branch);
    const branchViewAuthor = getGitBranchViewAuthor(branch);
    const branchUpstreamLabel = getGitBranchUpstreamLabel(branch);

    nodes.push(
      <div key={branch.name} className="rounded border bg-background/60 p-2">
        <div className="flex items-center gap-2">
          <Badge variant={branchBadgeVariant} className="text-[10px]">
            {branchBadgeLabel}
          </Badge>
          <span className="truncate">{branch.name}</span>
          <Badge variant="outline" className="ml-auto text-[10px]">{branch.tracking_status}</Badge>
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{branchLastCommitLabel}</code>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 shrink-0 px-2 text-[10px]"
            data-testid="workspace-git-branch-view-commit"
            disabled={canViewBranchCommit === false}
            onClick={() => void onViewCommit({
              hash: branch.last_commit,
              message: branch.name,
              author: branchViewAuthor,
              email: '',
              time: '',
              files: 0,
              branches: [branch.name],
            })}
          >
            查看提交
          </Button>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          <span>Upstream: {branchUpstreamLabel}</span>
          <span>Ahead: {branch.ahead}</span>
          <span>Behind: {branch.behind}</span>
        </div>
      </div>,
    );
  }

  return nodes;
}

function materializeGitPanelTagNodes({
  tags,
  onViewCommit,
  setPendingTagMutationConfirmation,
}: {
  tags: GitTag[];
  onViewCommit: SharedGitProps['onViewCommit'];
  setPendingTagMutationConfirmation: (confirmation: GitTagMutationConfirmation) => void;
}): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const tag of tags) {
    const tagTargetCommitLabel = getGitReadOnlyListLabel(tag.target_commit, 'unknown');
    const canViewTagCommit = canViewGitReadOnlyCommit(tag.target_commit);
    const tagViewMessage = getGitTagViewMessage(tag);

    nodes.push(
      <div key={tag.name} className="flex items-center gap-2">
        <Badge variant="secondary" className="text-[10px]">tag</Badge>
        <span className="truncate">{tag.name}</span>
        <code className="ml-auto rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{tagTargetCommitLabel}</code>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 shrink-0 px-2 text-[10px]"
          data-testid="workspace-git-tag-view-commit"
          disabled={canViewTagCommit === false}
          onClick={() => void onViewCommit({
            hash: tag.target_commit,
            message: tagViewMessage,
            author: 'tag',
            email: '',
            time: '',
            files: 0,
            branches: [tag.name],
          })}
        >
          查看提交
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-6 shrink-0 px-2 text-[10px]"
          data-testid="workspace-git-tag-delete"
          onClick={() => setPendingTagMutationConfirmation({
            action: 'delete',
            tagName: tag.name,
            targetCommit: tag.target_commit,
          })}
        >
          删除本地标签
        </Button>
      </div>,
    );
  }

  return nodes;
}

function materializeGitPanelRemoteBranchNodes({
  branches,
  resolveRemoteBranchLocalName,
  onRemoteBranchLocalNameChange,
  openRemoteBranchCreateConfirmation,
  onViewCommit,
}: {
  branches: GitRemoteBranch[];
  resolveRemoteBranchLocalName: (remoteBranch: string, fallbackBranch: string) => string;
  onRemoteBranchLocalNameChange: (remoteBranchName: string, value: string) => void;
  openRemoteBranchCreateConfirmation: (remoteBranchName: string, localBranchName: string) => void;
  onViewCommit: SharedGitProps['onViewCommit'];
}): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const branch of branches) {
    const remoteBranchRemoteLabel = getGitReadOnlyListLabel(branch.remote, 'remote');
    const remoteBranchNameLabel = getGitReadOnlyListLabel(branch.branch, branch.name);
    const remoteBranchLastCommitLabel = getGitReadOnlyListLabel(branch.last_commit, 'unknown');
    const canViewRemoteBranchCommit = canViewGitReadOnlyCommit(branch.last_commit);
    const remoteBranchLocalName = resolveRemoteBranchLocalName(branch.name, branch.branch);
    const canCreateRemoteTrackingBranch = canUseGitPanelTextValue(remoteBranchLocalName);

    nodes.push(
      <div key={branch.name} className="space-y-1 rounded border bg-background/40 p-1.5">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">{remoteBranchRemoteLabel}</Badge>
          <span className="truncate">{remoteBranchNameLabel}</span>
          <code className="ml-auto rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{remoteBranchLastCommitLabel}</code>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 shrink-0 text-xs"
            data-testid="workspace-git-remote-branch-view-commit"
            disabled={canViewRemoteBranchCommit === false}
            onClick={() => void onViewCommit({
              hash: branch.last_commit,
              message: branch.name,
              author: remoteBranchRemoteLabel,
              email: '',
              time: '',
              files: 0,
              branches: [branch.name],
            })}
          >
            查看提交
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            value={remoteBranchLocalName}
            onChange={(event) => {
              const value = event.target.value;
              onRemoteBranchLocalNameChange(branch.name, value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && canCreateRemoteTrackingBranch === true) {
                openRemoteBranchCreateConfirmation(branch.name, remoteBranchLocalName);
              }
            }}
            placeholder={getGitReadOnlyListLabel(branch.branch, 'local-branch')}
            className="h-7 text-xs"
          />
          <Button
            size="sm"
            variant="secondary"
            className="h-7 shrink-0 text-xs"
            disabled={canCreateRemoteTrackingBranch === false}
            onClick={() => {
              if (canCreateRemoteTrackingBranch === false) return;
              openRemoteBranchCreateConfirmation(branch.name, remoteBranchLocalName);
            }}
          >
            创建本地跟踪分支
          </Button>
        </div>
      </div>,
    );
  }

  return nodes;
}

function materializeGitPanelStashNodes({
  stashes,
  onViewCommit,
  setPendingStashMutationConfirmation,
}: {
  stashes: GitStash[];
  onViewCommit: SharedGitProps['onViewCommit'];
  setPendingStashMutationConfirmation: (confirmation: GitStashMutationConfirmation) => void;
}): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const stash of stashes) {
    const stashBranchLabel = getGitReadOnlyListLabel(stash.branch, 'unknown');
    const stashTargetCommitLabel = getGitReadOnlyListLabel(stash.target_commit, 'unknown');
    const stashViewBranchLabel = getGitReadOnlyListLabel(stash.branch, 'stash');
    const canViewStashCommit = canViewGitReadOnlyCommit(stash.target_commit);
    const stashViewMessage = getGitStashViewMessage(stash);

    nodes.push(
      <div key={stash.ref} className="flex items-center gap-2">
        <Badge variant="secondary" className="text-[10px]">stash</Badge>
        <span className="truncate">{stash.ref}</span>
        <span className="truncate text-muted-foreground">{stashBranchLabel}</span>
        <code className="ml-auto rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{stashTargetCommitLabel}</code>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 shrink-0 text-xs"
          data-testid="workspace-git-stash-view-commit"
          disabled={canViewStashCommit === false}
          onClick={() => void onViewCommit({
            hash: stash.target_commit,
            message: stashViewMessage,
            author: 'stash',
            email: '',
            time: '',
            files: 0,
            branches: [stashViewBranchLabel],
          })}
        >
          查看提交
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="h-7 shrink-0 text-xs"
          onClick={() => setPendingStashMutationConfirmation({
            action: 'apply',
            stashRef: stash.ref,
            branch: stash.branch,
            targetCommit: stash.target_commit,
          })}
        >
          应用此 stash
        </Button>
      </div>,
    );
  }

  return nodes;
}

function materializeGitPanelInlineCommitDiffFileNodes({
  commit,
  files,
  onOpenFile,
  onCopyText,
  setPendingCommitFileRestoreConfirmation,
}: {
  commit: GitCommit;
  files: GitDiff[];
  onOpenFile: SharedGitProps['onOpenFile'];
  onCopyText: SharedGitProps['onCopyText'];
  setPendingCommitFileRestoreConfirmation: (confirmation: GitCommitFileRestoreConfirmation) => void;
}): ReactNode[] {
  const nodes: ReactNode[] = [];
  let fileIndex = 0;

  for (const file of files) {
    const gitDiffFileItemSnapshot = buildGitDiffFileItemSnapshot({
      file,
      index: fileIndex,
    });
    const diffFileItemKey = getGitPanelDiffFileItemKey(file, 'diff', fileIndex);
    const diffContentLines = getGitPanelDiffContentLines(file.content);
    const diffLineNodes = materializeGitPanelDiffLineNodes({
      lines: diffContentLines,
      fileItemKey: diffFileItemKey,
      lineBaseClassName: 'px-2 py-0.5',
    });

    nodes.push(
      <details key={diffFileItemKey} className="mb-2 overflow-hidden rounded border bg-card">
        <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-muted/50">
          <FileCode className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-xs">{file.path}</span>
          <span className="shrink-0 text-xs text-emerald-600">+{file.additions}</span>
          <span className="shrink-0 text-xs text-red-600">-{file.deletions}</span>
        </summary>
        <div className="px-2 pt-2">
          <div className="app-debug-only">
            <GitDiffFileItemSnapshotStrip snapshot={gitDiffFileItemSnapshot} />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="mt-2 h-7 text-xs"
            data-testid="workspace-git-commit-diff-open-file"
            disabled={gitDiffFileItemSnapshot.hasPath === false}
            onClick={() => void onOpenFile(gitDiffFileItemSnapshot.path)}
          >
            打开当前文件
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="ml-2 mt-2 h-7 text-xs"
            data-testid="workspace-git-commit-diff-copy-patch"
            disabled={gitDiffFileItemSnapshot.hasContent === false}
            onClick={() => void onCopyText(file.content)}
          >
            复制 patch
          </Button>
          <span className="app-debug-only">
            <Button
              size="sm"
              variant="outline"
              className="ml-2 mt-2 h-7 text-xs"
              disabled={gitDiffFileItemSnapshot.hasPath === false}
              onClick={() => setPendingCommitFileRestoreConfirmation({
                action: 'restore',
                commit,
                filePath: gitDiffFileItemSnapshot.path,
              })}
            >
              恢复此文件
            </Button>
          </span>
          <p className="mt-2 text-xs text-muted-foreground">
            打开当前文件只读取当前 Workspace 文件，复制 patch 只写入系统剪贴板；不会恢复历史版本或执行 Git 写操作。
          </p>
        </div>
        <pre className="max-h-48 overflow-x-auto bg-muted/10 p-2 text-xs font-mono">
          {diffLineNodes}
        </pre>
      </details>,
    );

    fileIndex += 1;
  }

  return nodes;
}

function materializeGitPanelBranchCompareCommitNodes({
  commits,
  headBranch,
  onViewCommit,
}: {
  commits: GitBranchCompareCommit[];
  headBranch: string;
  onViewCommit: SharedGitProps['onViewCommit'];
}): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const commit of commits) {
    const branchCompareCommitHashLabel = getGitReadOnlyListLabel(commit.hash, 'unknown');
    const branchCompareCommitMessageLabel = getGitReadOnlyListLabel(commit.message, 'No commit message');
    const branchCompareCommitAuthorLabel = getGitReadOnlyListLabel(commit.author, 'unknown author');
    const branchCompareCommitTimeLabel = getGitReadOnlyListLabel(commit.time, 'unknown time');
    const canViewBranchCompareCommit = canViewGitReadOnlyCommit(commit.hash);
    const branchCompareCommitViewMessage = getGitBranchCompareCommitViewMessage(commit, headBranch);
    const branchCompareCommitViewAuthor = getGitBranchCompareCommitViewAuthor(commit);
    const branchCompareCommitViewEmail = getGitBranchCompareCommitViewEmail(commit);
    const branchCompareCommitViewTime = getGitBranchCompareCommitViewTime(commit);
    const branchCompareCommitViewBranches = getGitBranchCompareCommitViewBranches(headBranch);

    nodes.push(
      <div key={commit.hash} className="grid gap-1 rounded border bg-background/50 px-2 py-1">
        <div className="flex items-center gap-2">
          <code className="shrink-0 rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
            {branchCompareCommitHashLabel}
          </code>
          <span className="min-w-0 flex-1 truncate font-medium">{branchCompareCommitMessageLabel}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="min-w-0 flex-1 truncate">{branchCompareCommitAuthorLabel}</span>
          <span className="shrink-0">{branchCompareCommitTimeLabel}</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-full text-xs"
          disabled={canViewBranchCompareCommit === false}
          onClick={() => void onViewCommit({
            hash: commit.hash,
            message: branchCompareCommitViewMessage,
            author: branchCompareCommitViewAuthor,
            email: branchCompareCommitViewEmail,
            time: branchCompareCommitViewTime,
            files: 0,
            branches: branchCompareCommitViewBranches,
          })}
        >
          查看提交
        </Button>
      </div>,
    );
  }

  return nodes;
}

function materializeGitPanelBranchCompareFileNodes({
  files,
  baseBranch,
  headBranch,
  onCopyText,
  setPendingBranchCompareFileApplyConfirmation,
}: {
  files: GitBranchCompareFile[];
  baseBranch: string;
  headBranch: string;
  onCopyText: SharedGitProps['onCopyText'];
  setPendingBranchCompareFileApplyConfirmation: (confirmation: GitBranchCompareFileApplyConfirmation) => void;
}): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const file of files) {
    const canCopyBranchComparePatch = canCopyGitPanelPatchContent(file.content);

    nodes.push(
      <div key={file.path} className="grid gap-1 rounded border bg-background/50 px-2 py-1">
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
            {file.path}
          </code>
          <span className="shrink-0 text-emerald-600">+{file.additions}</span>
          <span className="shrink-0 text-red-600">-{file.deletions}</span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="h-7 w-full text-xs"
          onClick={() => setPendingBranchCompareFileApplyConfirmation({
            action: 'apply',
            baseBranch,
            headBranch,
            filePath: file.path,
          })}
        >
          引入此文件
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-full text-xs"
          data-testid="workspace-git-branch-compare-copy-patch"
          disabled={canCopyBranchComparePatch === false}
          onClick={() => void onCopyText(file.content)}
        >
          复制 patch
        </Button>
      </div>,
    );
  }

  return nodes;
}

function materializeGitPanelWorktreeDiffFileNodes({
  files,
  onOpenFile,
  onCopyText,
  setPendingWorktreeFileDiscardConfirmation,
}: {
  files: GitDiff[];
  onOpenFile: SharedGitProps['onOpenFile'];
  onCopyText: SharedGitProps['onCopyText'];
  setPendingWorktreeFileDiscardConfirmation: (confirmation: GitWorktreeFileDiscardConfirmation) => void;
}): ReactNode[] {
  const nodes: ReactNode[] = [];
  let fileIndex = 0;

  for (const file of files) {
    const gitDiffFileItemSnapshot = buildGitDiffFileItemSnapshot({
      file,
      index: fileIndex,
    });
    const diffFileItemKey = getGitPanelDiffFileItemKey(file, 'worktree-diff', fileIndex);
    const diffContentLines = getGitPanelDiffContentLines(file.content);
    const diffLineNodes = materializeGitPanelDiffLineNodes({
      lines: diffContentLines,
      fileItemKey: diffFileItemKey,
      lineBaseClassName: 'px-2 py-0.5',
    });

    nodes.push(
      <details key={diffFileItemKey} className="overflow-hidden rounded border bg-card">
        <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-muted/50">
          <FileCode className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-xs">{gitDiffFileItemSnapshot.path}</span>
          <Badge variant="outline" className="shrink-0 text-[10px]">read-only</Badge>
          <span className="shrink-0 text-xs text-emerald-600">+{file.additions}</span>
          <span className="shrink-0 text-xs text-red-600">-{file.deletions}</span>
        </summary>
        <div className="px-2 pt-2">
          <div className="app-debug-only">
            <GitDiffFileItemSnapshotStrip snapshot={gitDiffFileItemSnapshot} />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="mt-2 h-7 w-full text-xs"
            data-testid="workspace-git-worktree-open-file"
            disabled={gitDiffFileItemSnapshot.hasPath === false}
            onClick={() => void onOpenFile(gitDiffFileItemSnapshot.path)}
          >
            打开文件
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="mt-2 h-7 w-full text-xs"
            data-testid="workspace-git-worktree-copy-diff"
            disabled={gitDiffFileItemSnapshot.hasContent === false}
            onClick={() => void onCopyText(file.content)}
          >
            复制 patch
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="mt-2 h-7 w-full text-xs"
            data-testid="workspace-git-worktree-discard-file"
            disabled={gitDiffFileItemSnapshot.hasPath === false}
            onClick={() => setPendingWorktreeFileDiscardConfirmation({
              action: 'discard',
              filePath: gitDiffFileItemSnapshot.path,
            })}
          >
            丢弃此文件变更
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            打开文件只复用 Workspace 文件读取链路，复制 patch 只写入系统剪贴板；丢弃入口通过显式 POST 对单文件执行路径限定恢复或清理，不执行整仓 reset、stash 或分支切换。
          </p>
        </div>
        <pre className="max-h-48 overflow-x-auto bg-muted/10 p-2 text-xs font-mono">
          {diffLineNodes}
        </pre>
      </details>,
    );

    fileIndex += 1;
  }

  return nodes;
}

function materializeGitPanelCompareTargetBranchOptionNodes(branches: GitBranchRecord[]): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const branch of branches) {
    nodes.push(
      <SelectItem key={branch.name} value={branch.name}>
        {branch.name}
      </SelectItem>,
    );
  }

  return nodes;
}

function getGitPanelCollectionItemCount<TItem>(items: TItem[]): number {
  if (Array.isArray(items) === false) {
    return 0;
  }

  return items.length;
}

function canRenderGitPanelCollection(count: number): boolean {
  if (count === 0) {
    return false;
  }

  return true;
}

function canRenderGitPanelEmptyCollection(count: number): boolean {
  if (count === 0) {
    return true;
  }

  return false;
}

function canUseGitPanelTextValue(value: string): boolean {
  const hasValue = value.length > 0;
  return hasValue === true;
}

function canOpenGitPanelRemoteBranchRefreshConfirmation(remoteName: string): boolean {
  return canUseGitPanelTextValue(remoteName);
}

function canOpenGitPanelRemoteBranchCreateConfirmation(remoteBranchName: string, localBranchName: string): boolean {
  const hasRemoteBranchName = canUseGitPanelTextValue(remoteBranchName);
  const hasLocalBranchName = canUseGitPanelTextValue(localBranchName);
  return hasRemoteBranchName === true && hasLocalBranchName === true;
}

function canCopyGitPanelPatchContent(content: string): boolean {
  const patchContent = content.trim();
  return canUseGitPanelTextValue(patchContent);
}

function getGitPanelBranchCompareCommits(compare: GitBranchCompare | null): GitBranchCompareCommit[] {
  if (compare === null) {
    return [];
  }

  return compare.commits;
}

function getGitPanelBranchCompareFiles(compare: GitBranchCompare | null): GitBranchCompareFile[] {
  if (compare === null) {
    return [];
  }

  return compare.files;
}

function getGitPanelBranchCompareBaseBranch(compare: GitBranchCompare | null): string {
  if (compare === null) {
    return 'unknown';
  }

  return compare.base_branch;
}

function getGitPanelBranchCompareHeadBranch(compare: GitBranchCompare | null): string {
  if (compare === null) {
    return 'unknown';
  }

  return compare.head_branch;
}

function getGitPanelWorktreeDiffFiles(status: GitWorktreeStatus | null): GitDiff[] {
  if (status === null) {
    return [];
  }

  return status.diff;
}

function getGitPanelCommitDiffFiles(commit: GitCommit): GitDiff[] {
  const diffFiles = commit.diff;
  if (Array.isArray(diffFiles) === true) {
    return diffFiles;
  }

  return [];
}

function getGitPanelCurrentBranchName(branches: GitBranchRecord[]): string | null {
  for (const branch of branches) {
    if (branch.is_current === true) {
      const hasCurrentBranchName = branch.name.length > 0;
      if (hasCurrentBranchName === true) {
        return branch.name;
      }
    }
  }

  return null;
}

function hasGitPanelBranchName(branchName: string | null): boolean {
  if (branchName === null) {
    return false;
  }

  const hasBranchName = branchName.length > 0;
  return hasBranchName === true;
}

function getGitPanelRenderableBranchName(branchName: string | null): string | null {
  if (branchName === null) {
    return null;
  }

  const hasBranchName = hasGitPanelBranchName(branchName);
  if (hasBranchName === false) {
    return null;
  }

  return branchName;
}

function getGitPanelCurrentBranch(currentBranchName: string | null, snapshotBranch: string): string {
  const renderableCurrentBranchName = getGitPanelRenderableBranchName(currentBranchName);

  if (renderableCurrentBranchName !== null) {
    return renderableCurrentBranchName;
  }

  return snapshotBranch;
}

function getGitPanelBranchLabel(branchName: string): string {
  const normalizedBranchName = branchName.trim();
  const hasBranchName = normalizedBranchName.length > 0 && normalizedBranchName !== 'unknown';

  if (hasBranchName === true) {
    return normalizedBranchName;
  }

  return '未确认分支';
}

function getGitPanelCompareTargetBranches(branches: GitBranchRecord[], currentBranch: string): GitBranchRecord[] {
  const targetBranches: GitBranchRecord[] = [];

  for (const branch of branches) {
    const hasBranchName = branch.name.length > 0;
    const isDifferentFromCurrent = branch.name !== currentBranch;

    if (hasBranchName === true) {
      if (isDifferentFromCurrent === true) {
        targetBranches.push(branch);
      }
    }
  }

  return targetBranches;
}

function getGitPanelCompareStatusHeadBranch(status: { headBranch: string } | null | undefined): string {
  if (status === null || status === undefined) {
    return '';
  }

  return status.headBranch;
}

function getGitPanelCompareSnapshotHeadBranch(snapshot: { head_branch: string } | null | undefined): string {
  if (snapshot === null || snapshot === undefined) {
    return '';
  }

  return snapshot.head_branch;
}

function getGitPanelFirstBranchRecord(branches: GitBranchRecord[]): GitBranchRecord | undefined {
  for (const branch of branches) {
    return branch;
  }

  return undefined;
}

function getGitPanelFirstCompareTargetBranch(branches: GitBranchRecord[]): string {
  const firstBranch = getGitPanelFirstBranchRecord(branches);
  if (firstBranch === undefined) {
    return '';
  }

  return firstBranch.name;
}

function materializeGitPanelObservedRemoteNameOptionNodes(remoteNames: string[]): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const remoteName of remoteNames) {
    nodes.push(
      <SelectItem key={remoteName} value={remoteName}>{remoteName}</SelectItem>,
    );
  }

  return nodes;
}

function getGitPanelCompareTargetValue(
  selectedTarget: string,
  statusHeadBranch: string,
  snapshotHeadBranch: string,
  firstTargetBranch: string,
): string {
  const hasSelectedTarget = selectedTarget.length > 0;
  if (hasSelectedTarget === true) {
    return selectedTarget;
  }

  const hasStatusHeadBranch = statusHeadBranch.length > 0;
  if (hasStatusHeadBranch === true) {
    return statusHeadBranch;
  }

  const hasSnapshotHeadBranch = snapshotHeadBranch.length > 0;
  if (hasSnapshotHeadBranch === true) {
    return snapshotHeadBranch;
  }

  return firstTargetBranch;
}

function addGitPanelObservedRemoteName(
  observedRemoteNames: string[],
  observedRemoteNameSet: Set<string>,
  remoteName: string,
): void {
  const trimmedRemoteName = remoteName.trim();
  const hasRemoteName = trimmedRemoteName.length > 0;
  if (hasRemoteName === false) {
    return;
  }

  const hasObservedRemoteName = observedRemoteNameSet.has(trimmedRemoteName);
  if (hasObservedRemoteName === true) {
    return;
  }

  observedRemoteNameSet.add(trimmedRemoteName);
  observedRemoteNames.push(trimmedRemoteName);
}

function getGitPanelObservedRemoteNames(remotes: GitRemote[], remoteBranches: GitRemoteBranch[]): string[] {
  const observedRemoteNames: string[] = [];
  const observedRemoteNameSet = new Set<string>();

  for (const remote of remotes) {
    addGitPanelObservedRemoteName(observedRemoteNames, observedRemoteNameSet, remote.name);
  }

  for (const branch of remoteBranches) {
    addGitPanelObservedRemoteName(observedRemoteNames, observedRemoteNameSet, branch.remote);
  }

  return observedRemoteNames;
}

function getGitPanelFirstObservedRemoteName(observedRemoteNames: string[]): string | undefined {
  for (const remoteName of observedRemoteNames) {
    return remoteName;
  }

  return undefined;
}

function getGitPanelRemoteBranchRefreshPlaceholder(observedRemoteNames: string[]): string {
  const firstRemoteName = getGitPanelFirstObservedRemoteName(observedRemoteNames);
  if (firstRemoteName === undefined) {
    return 'origin';
  }

  return firstRemoteName;
}

function getGitPanelRemoteBranchRefreshValue(remoteName: string, placeholder: string): string {
  const remoteNameValue = remoteName.trim();
  const hasRemoteNameValue = remoteNameValue.length > 0;

  if (hasRemoteNameValue === true) {
    return remoteNameValue;
  }

  return placeholder;
}

function getGitPanelRemoteBranchLocalName(
  drafts: GitRemoteBranchCreateLocalNameDraftMap,
  remoteBranchName: string,
  fallbackBranch: string,
): string {
  const draftValue = drafts[remoteBranchName];

  if (draftValue !== undefined) {
    const localDraftValue = draftValue.trim();
    const hasLocalDraftValue = localDraftValue.length > 0;

    if (hasLocalDraftValue === true) {
      return localDraftValue;
    }
  }

  const hasFallbackBranch = fallbackBranch.length > 0;
  if (hasFallbackBranch === true) {
    return fallbackBranch;
  }

  const derivedBranchName = remoteBranchName.split('/').slice(1).join('/');
  const hasDerivedBranchName = derivedBranchName.length > 0;
  if (hasDerivedBranchName === true) {
    return derivedBranchName;
  }

  return '';
}

function canCommitGitPanelWorktree(worktreeStatus: string, commitMessage: string): boolean {
  const isDirtyWorktree = worktreeStatus === 'dirty';
  const hasCommitMessage = commitMessage.length > 0;

  return isDirtyWorktree === true && hasCommitMessage === true;
}

function canCreateGitPanelStash(worktreeStatus: string, stashMessage: string): boolean {
  const isDirtyWorktree = worktreeStatus === 'dirty';
  const hasStashMessage = stashMessage.length > 0;

  return isDirtyWorktree === true && hasStashMessage === true;
}

function canDeleteGitPanelCompareTarget(compareTarget: string, currentBranch: string): boolean {
  const hasCompareTarget = compareTarget.length > 0;
  const isDifferentFromCurrent = compareTarget !== currentBranch;

  return hasCompareTarget === true && isDifferentFromCurrent === true;
}

function canRenameGitPanelCompareTarget(compareTarget: string, currentBranch: string, nextBranch: string): boolean {
  const canDeleteCompareTarget = canDeleteGitPanelCompareTarget(compareTarget, currentBranch);
  const hasNextBranch = nextBranch.length > 0;
  const isDifferentFromTarget = nextBranch !== compareTarget;
  const isDifferentFromCurrent = nextBranch !== currentBranch;

  return canDeleteCompareTarget === true
    && hasNextBranch === true
    && isDifferentFromTarget === true
    && isDifferentFromCurrent === true;
}

function getGitPanelRenderableBranchSwitchReadiness(
  readiness: GitBranchSwitchReadiness | null,
): GitBranchSwitchReadiness | null {
  if (readiness === null) {
    return null;
  }

  return readiness;
}

function canRenderGitPanelBranchSwitchReadiness(
  readiness: GitBranchSwitchReadiness | null,
): readiness is GitBranchSwitchReadiness {
  return readiness !== null;
}

function getGitPanelBranchSwitchCurrentBranch(readiness: GitBranchSwitchReadiness | null): string {
  if (readiness === null) {
    return '';
  }

  return readiness.current_branch;
}

function getGitPanelBranchSwitchTargetBranch(readiness: GitBranchSwitchReadiness | null): string {
  if (readiness === null) {
    return '';
  }

  return readiness.target_branch;
}

function getGitPanelBranchSwitchBadgeVariant(readiness: GitBranchSwitchReadiness | null): 'default' | 'outline' {
  if (readiness === null) {
    return 'outline';
  }

  if (readiness.can_switch === true) {
    return 'default';
  }

  return 'outline';
}

function getGitConfirmationButtonLabel(isConfirming: boolean, readyLabel: string): string {
  if (isConfirming === true) {
    return '执行中...';
  }

  return readyLabel;
}

function getGitTagMutationAction(
  confirmation: GitTagMutationConfirmation | null,
): GitTagMutationConfirmationAction | null {
  if (confirmation === null) {
    return null;
  }

  return confirmation.action;
}

function isGitTagMutationCreateAction(action: GitTagMutationConfirmationAction | null): boolean {
  return action === 'create';
}

function getGitTagMutationTitle(confirmation: GitTagMutationConfirmation | null): string {
  const action = getGitTagMutationAction(confirmation);
  const isCreateAction = isGitTagMutationCreateAction(action);

  if (isCreateAction === true) {
    return '确认创建本地标签';
  }

  return '确认删除本地标签';
}

function getGitTagMutationDescription(confirmation: GitTagMutationConfirmation | null, tagNameLabel: string): string {
  const action = getGitTagMutationAction(confirmation);
  const isCreateAction = isGitTagMutationCreateAction(action);

  if (isCreateAction === true) {
    return `确认从当前 HEAD 创建本地标签 ${tagNameLabel}？该操作会走后端 guarded git tag，不会 checkout、push tag、创建提交或修改工作区文件。`;
  }

  return `确认删除本地标签 ${tagNameLabel}？该操作会走后端 guarded git tag -d，不会删除远端标签或修改工作区文件。`;
}

function getGitTagMutationConfirmLabel(isConfirming: boolean, confirmation: GitTagMutationConfirmation | null): string {
  if (isConfirming === true) {
    return '执行中...';
  }

  const action = getGitTagMutationAction(confirmation);
  const isCreateAction = isGitTagMutationCreateAction(action);

  if (isCreateAction === true) {
    return '确认创建';
  }

  return '确认删除';
}

function getGitBranchMutationAction(
  confirmation: GitBranchMutationConfirmation | null,
): GitBranchMutationConfirmationAction | null {
  if (confirmation === null) {
    return null;
  }

  return confirmation.action;
}

function isGitBranchMutationCreateAction(action: GitBranchMutationConfirmationAction | null): boolean {
  return action === 'create';
}

function isGitBranchMutationDeleteAction(action: GitBranchMutationConfirmationAction | null): boolean {
  return action === 'delete';
}

function getGitBranchMutationTitle(confirmation: GitBranchMutationConfirmation | null): string {
  const action = getGitBranchMutationAction(confirmation);
  const isCreateAction = isGitBranchMutationCreateAction(action);
  const isDeleteAction = isGitBranchMutationDeleteAction(action);

  if (isCreateAction === true) {
    return '确认创建本地分支';
  }

  if (isDeleteAction === true) {
    return '确认删除本地分支';
  }

  return '确认重命名本地分支';
}

function getGitBranchMutationDescription(
  confirmation: GitBranchMutationConfirmation | null,
  branchNameLabel: string,
  nextBranchNameLabel: string,
): string {
  const action = getGitBranchMutationAction(confirmation);
  const isCreateAction = isGitBranchMutationCreateAction(action);
  const isDeleteAction = isGitBranchMutationDeleteAction(action);

  if (isCreateAction === true) {
    return `确认从当前 HEAD 创建本地分支 ${branchNameLabel}？该操作会走后端 guarded git branch，不会 checkout、switch、merge、reset 或修改工作区文件。`;
  }

  if (isDeleteAction === true) {
    return `确认删除本地分支 ${branchNameLabel}？该操作会走后端 guarded git branch -d，不会切换分支或操作远端。`;
  }

  return `确认将本地分支 ${branchNameLabel} 重命名为 ${nextBranchNameLabel}？该操作会走后端 guarded git branch -m，不会切换分支或操作远端。`;
}

function getGitBranchMutationConfirmLabel(isConfirming: boolean, confirmation: GitBranchMutationConfirmation | null): string {
  if (isConfirming === true) {
    return '执行中...';
  }

  const action = getGitBranchMutationAction(confirmation);
  const isCreateAction = isGitBranchMutationCreateAction(action);
  const isDeleteAction = isGitBranchMutationDeleteAction(action);

  if (isCreateAction === true) {
    return '确认创建';
  }

  if (isDeleteAction === true) {
    return '确认删除';
  }

  return '确认重命名';
}

function getGitConfirmationButtonVariant(riskLevel: string): 'destructive' | 'default' {
  if (riskLevel === 'high') {
    return 'destructive';
  }

  return 'default';
}

export function MobileGitPanel({
  projectId,
  gitBranch,
  gitBranches,
  gitBranchListStatus,
  gitRemotes,
  gitRemoteListStatus,
  gitRemoteBranches,
  gitRemoteBranchListStatus,
  gitTags,
  gitTagListStatus,
  gitStashes,
  gitStashListStatus,
  gitWorktreeStatus,
  gitWorktreeStatusState,
  gitBranchCompare,
  gitBranchCompareStatus,
  gitBranchCompareTarget,
  gitBranchSwitchReadiness,
  gitCommits,
  gitCommitListStatus,
  selectedCommit,
  gitCommitDetailStatus,
  onSelectGitBranchCompareTarget,
  onCreateGitBranch,
  onCreateGitTag,
  onDeleteGitTag,
  onCreateGitBranchFromRemote,
  onRefreshGitPanel,
  onRefreshGitRemoteBranches,
  onDeleteGitBranch,
  onRenameGitBranch,
  onSwitchGitBranch,
  onOpenFile,
  onCopyText,
  onCommitWorktree,
  onDiscardWorktreeFile,
  onRestoreCommitFile,
  onApplyGitBranchCompareFile,
  onCreateGitStash,
  onApplyGitStash,
  onViewCommit,
}: SharedGitProps) {
  const [branchCreateName, setBranchCreateName] = useState('');
  const [tagCreateName, setTagCreateName] = useState('');
  const [branchRenameName, setBranchRenameName] = useState('');
  const [worktreeCommitMessage, setWorktreeCommitMessage] = useState('');
  const [stashCreateMessage, setStashCreateMessage] = useState('');
  const [remoteBranchRefreshName, setRemoteBranchRefreshName] = useState('');
  const [remoteBranchCreateNames, setRemoteBranchCreateNames] = useState<GitRemoteBranchCreateLocalNameDraftMap>({});
  const [pendingBranchCompareFileApplyConfirmation, setPendingBranchCompareFileApplyConfirmation] = useState<GitBranchCompareFileApplyConfirmation | null>(null);
  const [isConfirmingBranchCompareFileApply, setIsConfirmingBranchCompareFileApply] = useState(false);
  const [pendingCommitFileRestoreConfirmation, setPendingCommitFileRestoreConfirmation] = useState<GitCommitFileRestoreConfirmation | null>(null);
  const [isConfirmingCommitFileRestore, setIsConfirmingCommitFileRestore] = useState(false);
  const [pendingBranchMutationConfirmation, setPendingBranchMutationConfirmation] = useState<GitBranchMutationConfirmation | null>(null);
  const [isConfirmingBranchMutation, setIsConfirmingBranchMutation] = useState(false);
  const [pendingBranchSwitchConfirmation, setPendingBranchSwitchConfirmation] = useState<GitBranchSwitchConfirmation | null>(null);
  const [isConfirmingBranchSwitch, setIsConfirmingBranchSwitch] = useState(false);
  const [pendingTagMutationConfirmation, setPendingTagMutationConfirmation] = useState<GitTagMutationConfirmation | null>(null);
  const [isConfirmingTagMutation, setIsConfirmingTagMutation] = useState(false);
  const [pendingRemoteBranchRefreshConfirmation, setPendingRemoteBranchRefreshConfirmation] = useState<GitRemoteBranchRefreshConfirmation | null>(null);
  const [isConfirmingRemoteBranchRefresh, setIsConfirmingRemoteBranchRefresh] = useState(false);
  const [pendingRemoteBranchCreateConfirmation, setPendingRemoteBranchCreateConfirmation] = useState<GitRemoteBranchCreateConfirmation | null>(null);
  const [isConfirmingRemoteBranchCreate, setIsConfirmingRemoteBranchCreate] = useState(false);
  const [pendingStashMutationConfirmation, setPendingStashMutationConfirmation] = useState<GitStashMutationConfirmation | null>(null);
  const [isConfirmingStashMutation, setIsConfirmingStashMutation] = useState(false);
  const [pendingWorktreeCommitConfirmation, setPendingWorktreeCommitConfirmation] = useState<GitWorktreeCommitConfirmation | null>(null);
  const [isConfirmingWorktreeCommit, setIsConfirmingWorktreeCommit] = useState(false);
  const [pendingWorktreeFileDiscardConfirmation, setPendingWorktreeFileDiscardConfirmation] = useState<GitWorktreeFileDiscardConfirmation | null>(null);
  const [isConfirmingWorktreeFileDiscard, setIsConfirmingWorktreeFileDiscard] = useState(false);
  const gitPanelSnapshot = buildGitPanelSnapshot({
    gitCommits,
    gitCommitListStatus,
    selectedCommit,
    gitCommitDetailStatus,
  });
  const gitCommitDetailSnapshot = buildGitCommitDetailSnapshot({
    selectedCommit,
    gitCommitDetailStatus,
  });
  const gitBranchSnapshot = buildGitBranchSnapshot({
    gitBranch,
    gitBranches,
    gitBranchListStatus,
    selectedCommit,
  });
  const gitBranchCompareSnapshot = buildGitBranchCompareSnapshot({
    gitBranchCompare,
    gitBranchCompareStatus,
  });
  const gitRemoteBranchSnapshot = buildGitRemoteBranchSnapshot({
    gitRemoteBranches,
    gitRemoteBranchListStatus,
  });
  const gitTagSnapshot = buildGitTagSnapshot({
    gitTags,
    gitTagListStatus,
  });
  const gitStashSnapshot = buildGitStashSnapshot({
    gitStashes,
    gitStashListStatus,
  });
  const gitWorktreeSnapshot = buildGitWorktreeSnapshot({
    gitWorktreeStatus,
    gitWorktreeStatusState,
  });
  const currentBranchName = getGitPanelCurrentBranchName(gitBranches);
  const currentGitBranch = getGitPanelCurrentBranch(currentBranchName, gitBranchSnapshot.branch);
  const currentGitBranchLabel = getGitPanelBranchLabel(currentGitBranch);
  const compareTargetBranches = getGitPanelCompareTargetBranches(gitBranches, currentGitBranch);
  const compareStatusHeadBranch = getGitPanelCompareStatusHeadBranch(gitBranchCompareStatus);
  const compareSnapshotHeadBranch = getGitPanelCompareSnapshotHeadBranch(gitBranchCompare);
  const firstCompareTargetBranch = getGitPanelFirstCompareTargetBranch(compareTargetBranches);
  const compareTargetValue = getGitPanelCompareTargetValue(
    gitBranchCompareTarget,
    compareStatusHeadBranch,
    compareSnapshotHeadBranch,
    firstCompareTargetBranch,
  );
  const observedRemoteNames = getGitPanelObservedRemoteNames(gitRemotes, gitRemoteBranches);
  const remoteBranchRefreshPlaceholder = getGitPanelRemoteBranchRefreshPlaceholder(observedRemoteNames);
  const branchCreateValue = branchCreateName.trim();
  const tagCreateValue = tagCreateName.trim();
  const branchRenameValue = branchRenameName.trim();
  const worktreeCommitMessageValue = worktreeCommitMessage.trim();
  const stashCreateMessageValue = stashCreateMessage.trim();
  const remoteBranchRefreshValue = getGitPanelRemoteBranchRefreshValue(
    remoteBranchRefreshName,
    remoteBranchRefreshPlaceholder,
  );
  const canCommitWorktree = canCommitGitPanelWorktree(gitWorktreeSnapshot.status, worktreeCommitMessageValue);
  const canCreateStash = canCreateGitPanelStash(gitWorktreeSnapshot.status, stashCreateMessageValue);
  const canDeleteCompareTarget = canDeleteGitPanelCompareTarget(compareTargetValue, currentGitBranch);
  const canRenameCompareTarget = canRenameGitPanelCompareTarget(compareTargetValue, currentGitBranch, branchRenameValue);
  const renderableBranchSwitchReadiness = getGitPanelRenderableBranchSwitchReadiness(gitBranchSwitchReadiness);
  const branchSwitchCurrentBranch = getGitPanelBranchSwitchCurrentBranch(renderableBranchSwitchReadiness);
  const branchSwitchCurrentBranchLabel = getGitPanelBranchLabel(branchSwitchCurrentBranch);
  const branchSwitchTargetBranch = getGitPanelBranchSwitchTargetBranch(renderableBranchSwitchReadiness);
  const branchSwitchTargetBranchLabel = getGitPanelBranchLabel(branchSwitchTargetBranch);
  const branchSwitchBadgeVariant = getGitPanelBranchSwitchBadgeVariant(renderableBranchSwitchReadiness);
  const gitBranchCompareFileApplyConfirmationSnapshot = buildGitBranchCompareFileApplyConfirmationSnapshot({
    confirmation: pendingBranchCompareFileApplyConfirmation,
    isConfirming: isConfirmingBranchCompareFileApply,
  });
  const gitCommitFileRestoreConfirmationSnapshot = buildGitCommitFileRestoreConfirmationSnapshot({
    confirmation: pendingCommitFileRestoreConfirmation,
    isConfirming: isConfirmingCommitFileRestore,
  });
  const gitBranchMutationConfirmationSnapshot = buildGitBranchMutationConfirmationSnapshot({
    confirmation: pendingBranchMutationConfirmation,
    currentBranch: currentGitBranch,
    isConfirming: isConfirmingBranchMutation,
  });
  const gitBranchSwitchConfirmationSnapshot = buildGitBranchSwitchConfirmationSnapshot({
    confirmation: pendingBranchSwitchConfirmation,
    isConfirming: isConfirmingBranchSwitch,
  });
  const gitTagMutationConfirmationSnapshot = buildGitTagMutationConfirmationSnapshot({
    confirmation: pendingTagMutationConfirmation,
    isConfirming: isConfirmingTagMutation,
  });
  const gitRemoteBranchRefreshConfirmationSnapshot = buildGitRemoteBranchRefreshConfirmationSnapshot({
    confirmation: pendingRemoteBranchRefreshConfirmation,
    isConfirming: isConfirmingRemoteBranchRefresh,
  });
  const gitRemoteBranchCreateConfirmationSnapshot = buildGitRemoteBranchCreateConfirmationSnapshot({
    confirmation: pendingRemoteBranchCreateConfirmation,
    isConfirming: isConfirmingRemoteBranchCreate,
  });
  const gitStashMutationConfirmationSnapshot = buildGitStashMutationConfirmationSnapshot({
    confirmation: pendingStashMutationConfirmation,
    isConfirming: isConfirmingStashMutation,
  });
  const gitWorktreeCommitConfirmationSnapshot = buildGitWorktreeCommitConfirmationSnapshot({
    confirmation: pendingWorktreeCommitConfirmation,
    isConfirming: isConfirmingWorktreeCommit,
  });
  const gitWorktreeFileDiscardConfirmationSnapshot = buildGitWorktreeFileDiscardConfirmationSnapshot({
    confirmation: pendingWorktreeFileDiscardConfirmation,
    isConfirming: isConfirmingWorktreeFileDiscard,
  });
  const branchCompareApplyHeadBranchLabel = getGitBranchCompareFileApplyHeadBranchLabel(pendingBranchCompareFileApplyConfirmation);
  const branchCompareApplyFilePathLabel = getGitBranchCompareFileApplyFilePathLabel(pendingBranchCompareFileApplyConfirmation);
  const branchCompareApplyBaseBranchLabel = getGitBranchCompareFileApplyBaseBranchLabel(pendingBranchCompareFileApplyConfirmation);
  const commitFileRestoreFilePathLabel = getGitCommitFileRestoreFilePathLabel(pendingCommitFileRestoreConfirmation);
  const tagMutationTagNameLabel = getGitTagMutationTagNameLabel(pendingTagMutationConfirmation);
  const branchMutationBranchNameLabel = getGitBranchMutationBranchNameLabel(pendingBranchMutationConfirmation);
  const branchMutationNextBranchNameLabel = getGitBranchMutationNextBranchNameLabel(pendingBranchMutationConfirmation);
  const branchSwitchCurrentBranchDialogLabel = getGitBranchSwitchCurrentBranchDialogLabel(pendingBranchSwitchConfirmation);
  const branchSwitchTargetBranchDialogLabel = getGitBranchSwitchTargetBranchDialogLabel(pendingBranchSwitchConfirmation);
  const remoteBranchRefreshRemoteNameLabel = getGitRemoteBranchRefreshRemoteNameLabel(pendingRemoteBranchRefreshConfirmation);
  const remoteBranchCreateRemoteBranchNameLabel = getGitRemoteBranchCreateRemoteBranchNameLabel(pendingRemoteBranchCreateConfirmation);
  const remoteBranchCreateLocalBranchNameLabel = getGitRemoteBranchCreateLocalBranchNameLabel(pendingRemoteBranchCreateConfirmation);
  const stashMutationStashRefLabel = getGitStashMutationStashRefLabel(pendingStashMutationConfirmation);
  const stashMutationMessageLabel = getGitStashMutationMessageLabel(pendingStashMutationConfirmation);
  const worktreeCommitDirtyFilesLabel = getGitWorktreeCommitDirtyFilesLabel(pendingWorktreeCommitConfirmation);
  const worktreeCommitCurrentBranchLabel = getGitWorktreeCommitCurrentBranchLabel(pendingWorktreeCommitConfirmation);
  const worktreeFileDiscardFilePathLabel = getGitWorktreeFileDiscardFilePathLabel(pendingWorktreeFileDiscardConfirmation);
  const gitRemoteListStatusLabel = getGitRemoteListStatusLabel(gitRemoteListStatus);
  const branchCompareFileApplyConfirmLabel = getGitConfirmationButtonLabel(isConfirmingBranchCompareFileApply, '确认引入');
  const commitFileRestoreConfirmLabel = getGitConfirmationButtonLabel(isConfirmingCommitFileRestore, '确认恢复');
  const tagMutationTitle = getGitTagMutationTitle(pendingTagMutationConfirmation);
  const tagMutationDescription = getGitTagMutationDescription(pendingTagMutationConfirmation, tagMutationTagNameLabel);
  const tagMutationConfirmLabel = getGitTagMutationConfirmLabel(isConfirmingTagMutation, pendingTagMutationConfirmation);
  const branchMutationTitle = getGitBranchMutationTitle(pendingBranchMutationConfirmation);
  const branchMutationDescription = getGitBranchMutationDescription(
    pendingBranchMutationConfirmation,
    branchMutationBranchNameLabel,
    branchMutationNextBranchNameLabel,
  );
  const branchMutationConfirmLabel = getGitBranchMutationConfirmLabel(
    isConfirmingBranchMutation,
    pendingBranchMutationConfirmation,
  );
  const branchMutationButtonVariant = getGitConfirmationButtonVariant(gitBranchMutationConfirmationSnapshot.riskLevel);
  const branchSwitchConfirmLabel = getGitConfirmationButtonLabel(isConfirmingBranchSwitch, '确认切换');
  const remoteBranchRefreshConfirmLabel = getGitConfirmationButtonLabel(isConfirmingRemoteBranchRefresh, '确认刷新');
  const remoteBranchCreateConfirmLabel = getGitConfirmationButtonLabel(isConfirmingRemoteBranchCreate, '确认创建');
  const stashMutationConfirmLabel = getGitConfirmationButtonLabel(isConfirmingStashMutation, '确认应用');
  const worktreeCommitConfirmLabel = getGitConfirmationButtonLabel(isConfirmingWorktreeCommit, '确认提交');
  const worktreeFileDiscardConfirmLabel = getGitConfirmationButtonLabel(isConfirmingWorktreeFileDiscard, '确认丢弃');
  const canRenderBranchCompareStaleBanner = canRenderGitPanelStaleBanner(gitBranchCompareStatus, true);
  const branchCompareStaleBannerTitle = getGitPanelStaleBannerTitle(gitBranchCompareStatus, '分支对比');
  const branchCompareStaleBannerMessage = getGitPanelStaleBannerMessage(gitBranchCompareStatus);
  const canRenderBranchListStaleBanner = canRenderGitPanelStaleBanner(gitBranchListStatus, false);
  const branchListStaleBannerTitle = getGitPanelStaleBannerTitle(gitBranchListStatus, '分支列表');
  const branchListStaleBannerMessage = getGitPanelStaleBannerMessage(gitBranchListStatus);
  const canRenderTagListStaleBanner = canRenderGitPanelStaleBanner(gitTagListStatus, false);
  const tagListStaleBannerTitle = getGitPanelStaleBannerTitle(gitTagListStatus, '标签列表');
  const tagListStaleBannerMessage = getGitPanelStaleBannerMessage(gitTagListStatus);
  const canRenderCommitListStaleBanner = canRenderGitPanelStaleBanner(gitCommitListStatus, false);
  const commitListStaleBannerTitle = getGitPanelStaleBannerTitle(gitCommitListStatus, '提交列表');
  const commitListStaleBannerMessage = getGitPanelStaleBannerMessage(gitCommitListStatus);
  const canRenderEmptySelectedCommitDetail = canRenderGitPanelEmptySelectedCommitDetail(selectedCommit);
  const branchCompareCommits = getGitPanelBranchCompareCommits(gitBranchCompare);
  const branchCompareCommitCount = getGitPanelCollectionItemCount(branchCompareCommits);
  const canRenderBranchCompareCommits = canRenderGitPanelCollection(branchCompareCommitCount);
  const branchCompareFiles = getGitPanelBranchCompareFiles(gitBranchCompare);
  const branchCompareFileCount = getGitPanelCollectionItemCount(branchCompareFiles);
  const canRenderBranchCompareFiles = canRenderGitPanelCollection(branchCompareFileCount);
  const branchCompareBaseBranch = getGitPanelBranchCompareBaseBranch(gitBranchCompare);
  const branchCompareHeadBranch = getGitPanelBranchCompareHeadBranch(gitBranchCompare);
  const worktreeDiffFiles = getGitPanelWorktreeDiffFiles(gitWorktreeStatus);
  const worktreeDiffFileCount = getGitPanelCollectionItemCount(worktreeDiffFiles);
  const canRenderWorktreeDiffFiles = canRenderGitPanelCollection(worktreeDiffFileCount);
  const canCreateBranch = canUseGitPanelTextValue(branchCreateValue);
  const compareTargetBranchCount = getGitPanelCollectionItemCount(compareTargetBranches);
  const canRenderCompareTargetBranches = canRenderGitPanelCollection(compareTargetBranchCount);
  const gitBranchCount = getGitPanelCollectionItemCount(gitBranches);
  const canRenderGitBranches = canRenderGitPanelCollection(gitBranchCount);
  const gitTagCount = getGitPanelCollectionItemCount(gitTags);
  const canRenderGitTags = canRenderGitPanelCollection(gitTagCount);
  const canCreateTag = canUseGitPanelTextValue(tagCreateValue);
  const observedRemoteNameCount = getGitPanelCollectionItemCount(observedRemoteNames);
  const canRenderObservedRemoteNames = canRenderGitPanelCollection(observedRemoteNameCount);
  const canRefreshRemoteBranches = canUseGitPanelTextValue(remoteBranchRefreshValue);
  const canOpenRemoteBranchRefreshConfirmation = canOpenGitPanelRemoteBranchRefreshConfirmation(remoteBranchRefreshValue);
  const gitRemoteBranchCount = getGitPanelCollectionItemCount(gitRemoteBranches);
  const canRenderGitRemoteBranches = canRenderGitPanelCollection(gitRemoteBranchCount);
  const gitStashCount = getGitPanelCollectionItemCount(gitStashes);
  const canRenderGitStashes = canRenderGitPanelCollection(gitStashCount);
  const gitCommitCount = getGitPanelCollectionItemCount(gitCommits);
  const canRenderGitCommitEmptyState = canRenderGitPanelEmptyCollection(gitCommitCount);
  const canRenderGitCommits = canRenderGitPanelCollection(gitCommitCount);
  const resolveRemoteBranchLocalName = (remoteBranch: string, fallbackBranch: string) => (
    getGitPanelRemoteBranchLocalName(remoteBranchCreateNames, remoteBranch, fallbackBranch)
  );
  const handleRemoteBranchLocalNameChange = (remoteBranchName: string, value: string) => {
    setRemoteBranchCreateNames((prev) => ({ ...prev, [remoteBranchName]: value }));
  };
  const openWorktreeCommitConfirmation = () => {
    if (canCommitWorktree === false) return;

    setPendingWorktreeCommitConfirmation({
      action: 'commit',
      commitMessage: worktreeCommitMessageValue,
      currentBranch: gitWorktreeSnapshot.currentBranch,
      dirtyFiles: gitWorktreeSnapshot.dirtyFiles,
    });
  };
  const openStashCreateConfirmation = () => {
    if (canCreateStash === false) return;

    setPendingStashMutationConfirmation({
      action: 'create',
      stashMessage: stashCreateMessageValue,
    });
  };
  const openRemoteBranchRefreshConfirmation = () => {
    if (canOpenRemoteBranchRefreshConfirmation === false) return;

    setPendingRemoteBranchRefreshConfirmation({
      action: 'refresh',
      remoteName: remoteBranchRefreshValue,
    });
  };
  const openRemoteBranchCreateConfirmation = (remoteBranchName: string, localBranchName: string) => {
    const remoteBranchValue = remoteBranchName.trim();
    const localBranchValue = localBranchName.trim();
    const canOpenRemoteBranchCreateConfirmation = canOpenGitPanelRemoteBranchCreateConfirmation(
      remoteBranchValue,
      localBranchValue,
    );
    if (canOpenRemoteBranchCreateConfirmation === false) return;

    setPendingRemoteBranchCreateConfirmation({
      action: 'create_tracking',
      remoteBranchName: remoteBranchValue,
      localBranchName: localBranchValue,
    });
  };
  const handleConfirmBranchCompareFileApply = async () => {
    if (
      pendingBranchCompareFileApplyConfirmation === null ||
      gitBranchCompareFileApplyConfirmationSnapshot.canConfirm !== true
    ) return;

    const confirmation = pendingBranchCompareFileApplyConfirmation;
    setIsConfirmingBranchCompareFileApply(true);
    try {
      if (confirmation.action === 'apply') {
        await onApplyGitBranchCompareFile(
          confirmation.baseBranch,
          confirmation.headBranch,
          confirmation.filePath,
        );
      }
    } finally {
      setIsConfirmingBranchCompareFileApply(false);
      setPendingBranchCompareFileApplyConfirmation(null);
    }
  };
  const handleConfirmCommitFileRestore = async () => {
    if (
      pendingCommitFileRestoreConfirmation === null ||
      gitCommitFileRestoreConfirmationSnapshot.canConfirm !== true
    ) return;

    const confirmation = pendingCommitFileRestoreConfirmation;
    setIsConfirmingCommitFileRestore(true);
    try {
      if (confirmation.action === 'restore') {
        await onRestoreCommitFile(confirmation.commit, confirmation.filePath);
      }
    } finally {
      setIsConfirmingCommitFileRestore(false);
      setPendingCommitFileRestoreConfirmation(null);
    }
  };
  const handleConfirmBranchMutation = async () => {
    if (
      pendingBranchMutationConfirmation === null ||
      gitBranchMutationConfirmationSnapshot.canConfirm !== true
    ) return;

    const confirmation = pendingBranchMutationConfirmation;
    setIsConfirmingBranchMutation(true);
    try {
      if (confirmation.action === 'create') {
        await onCreateGitBranch(confirmation.branchName);
        setBranchCreateName('');
        return;
      }
      if (confirmation.action === 'delete') {
        await onDeleteGitBranch(confirmation.branchName);
        return;
      }
      if (canConfirmGitBranchRenameMutation(confirmation) === true) {
        const nextBranchName = getGitBranchMutationNextBranchName(confirmation);
        await onRenameGitBranch(confirmation.branchName, nextBranchName);
        setBranchRenameName('');
      }
    } finally {
      setIsConfirmingBranchMutation(false);
      setPendingBranchMutationConfirmation(null);
    }
  };
  const handleConfirmBranchSwitch = async () => {
    if (
      pendingBranchSwitchConfirmation === null ||
      gitBranchSwitchConfirmationSnapshot.canConfirm !== true
    ) return;

    const confirmation = pendingBranchSwitchConfirmation;
    setIsConfirmingBranchSwitch(true);
    try {
      if (confirmation.action === 'switch') {
        await onSwitchGitBranch(confirmation.targetBranch);
      }
    } finally {
      setIsConfirmingBranchSwitch(false);
      setPendingBranchSwitchConfirmation(null);
    }
  };
  const handleConfirmTagMutation = async () => {
    if (
      pendingTagMutationConfirmation === null ||
      gitTagMutationConfirmationSnapshot.canConfirm !== true
    ) return;

    const confirmation = pendingTagMutationConfirmation;
    setIsConfirmingTagMutation(true);
    try {
      if (confirmation.action === 'create') {
        await onCreateGitTag(confirmation.tagName);
        setTagCreateName('');
        return;
      }
      if (confirmation.action === 'delete') {
        await onDeleteGitTag(confirmation.tagName);
      }
    } finally {
      setIsConfirmingTagMutation(false);
      setPendingTagMutationConfirmation(null);
    }
  };
  const handleConfirmRemoteBranchRefresh = async () => {
    if (
      pendingRemoteBranchRefreshConfirmation === null ||
      gitRemoteBranchRefreshConfirmationSnapshot.canConfirm !== true
    ) return;

    const confirmation = pendingRemoteBranchRefreshConfirmation;
    setIsConfirmingRemoteBranchRefresh(true);
    try {
      if (confirmation.action === 'refresh') {
        await onRefreshGitRemoteBranches(confirmation.remoteName);
      }
    } finally {
      setIsConfirmingRemoteBranchRefresh(false);
      setPendingRemoteBranchRefreshConfirmation(null);
    }
  };
  const handleConfirmRemoteBranchCreate = async () => {
    if (
      pendingRemoteBranchCreateConfirmation === null ||
      gitRemoteBranchCreateConfirmationSnapshot.canConfirm !== true
    ) return;

    const confirmation = pendingRemoteBranchCreateConfirmation;
    setIsConfirmingRemoteBranchCreate(true);
    try {
      if (confirmation.action === 'create_tracking') {
        await onCreateGitBranchFromRemote(confirmation.remoteBranchName, confirmation.localBranchName);
      }
    } finally {
      setIsConfirmingRemoteBranchCreate(false);
      setPendingRemoteBranchCreateConfirmation(null);
    }
  };
  const handleConfirmStashMutation = async () => {
    if (
      pendingStashMutationConfirmation === null ||
      gitStashMutationConfirmationSnapshot.canConfirm !== true
    ) return;

    const confirmation = pendingStashMutationConfirmation;
    setIsConfirmingStashMutation(true);
    try {
      if (confirmation.action === 'apply') {
        await onApplyGitStash(confirmation.stashRef ?? '');
      }
      if (confirmation.action === 'create') {
        await onCreateGitStash(confirmation.stashMessage ?? '');
        setStashCreateMessage('');
      }
    } finally {
      setIsConfirmingStashMutation(false);
      setPendingStashMutationConfirmation(null);
    }
  };
  const handleConfirmWorktreeCommit = async () => {
    if (
      pendingWorktreeCommitConfirmation === null ||
      gitWorktreeCommitConfirmationSnapshot.canConfirm !== true
    ) return;

    const confirmation = pendingWorktreeCommitConfirmation;
    setIsConfirmingWorktreeCommit(true);
    try {
      if (confirmation.action === 'commit') {
        await onCommitWorktree(confirmation.commitMessage);
        setWorktreeCommitMessage('');
      }
    } finally {
      setIsConfirmingWorktreeCommit(false);
      setPendingWorktreeCommitConfirmation(null);
    }
  };
  const handleConfirmWorktreeFileDiscard = async () => {
    if (
      pendingWorktreeFileDiscardConfirmation === null ||
      gitWorktreeFileDiscardConfirmationSnapshot.canConfirm !== true
    ) return;

    const confirmation = pendingWorktreeFileDiscardConfirmation;
    setIsConfirmingWorktreeFileDiscard(true);
    try {
      if (confirmation.action === 'discard') {
        await onDiscardWorktreeFile(confirmation.filePath);
      }
    } finally {
      setIsConfirmingWorktreeFileDiscard(false);
      setPendingWorktreeFileDiscardConfirmation(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="h-10 shrink-0 border-b bg-muted/20 px-3 flex items-center">
        <GitBranchIcon className="mr-2 h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">提交历史</span>
        {projectId !== null && (
          <>
            <Button asChild size="icon" variant="ghost" className="ml-auto h-7 w-7" title="发布与域名">
              <Link href={`/projects/${encodeURIComponent(projectId)}/deploy`}><Rocket className="h-4 w-4" /></Link>
            </Button>
            <Button asChild size="icon" variant="ghost" className="h-7 w-7" title="GitHub 同步">
              <Link href={`/projects/${encodeURIComponent(projectId)}/github`}><Github className="h-4 w-4" /></Link>
            </Button>
              <Button asChild size="icon" variant="ghost" className="h-7 w-7" title="项目协作">
                <Link href={`/projects/${encodeURIComponent(projectId)}/collaboration`}><Users className="h-4 w-4" /></Link>
              </Button>
          </>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => void onRefreshGitPanel()}
        >
          <RefreshCw className="mr-1 h-3.5 w-3.5" />
          刷新
        </Button>
        <Badge variant="secondary" className="ml-2 text-xs">{getGitPanelBranchLabel(gitBranchSnapshot.branch)}</Badge>
      </div>
      <div className="app-debug-only">
      <GitBranchSnapshotStrip snapshot={gitBranchSnapshot} />
      <GitBranchCompareSnapshotStrip snapshot={gitBranchCompareSnapshot} />
      {canRenderBranchCompareCommits === true && (
        <div className="mx-3 mt-3 rounded-md border bg-muted/10 p-2 text-xs" data-testid="workspace-git-branch-compare-commit-view">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-medium text-muted-foreground">分支对比提交查看</span>
            <Badge variant="outline" className="text-[10px]">read-only</Badge>
          </div>
          <div className="space-y-1">
            {materializeGitPanelBranchCompareCommitNodes({
              commits: branchCompareCommits,
              headBranch: branchCompareHeadBranch,
              onViewCommit,
            })}
          </div>
          <p className="mt-2 text-muted-foreground">
            复用提交详情读取链路查看目标分支 ahead commit；不 checkout、不切换分支、不 merge 或修改工作区文件。
          </p>
        </div>
      )}
      <GitRemoteBranchSnapshotStrip snapshot={gitRemoteBranchSnapshot} />
      <GitTagSnapshotStrip snapshot={gitTagSnapshot} />
      <GitStashSnapshotStrip snapshot={gitStashSnapshot} />
      <GitWorktreeSnapshotStrip snapshot={gitWorktreeSnapshot} />
      <Accordion type="single" collapsible className="mx-3 mt-3" data-testid="workspace-git-advanced-operations">
        <AccordionItem value="advanced-git-operations" className="rounded-md border bg-muted/10">
          <AccordionTrigger className="px-3 py-2 text-xs hover:no-underline">
            <div className="mr-3 flex flex-1 items-center justify-between gap-2">
              <span className="font-medium text-muted-foreground">高级 Git 操作</span>
              <Badge variant="outline" className="text-[10px]">默认收起</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-3">
            <p className="px-3 pt-2 text-xs text-muted-foreground">
              默认 Git Tab 只展示只读状态、分支、提交和快照；创建、提交、stash、分支切换、remote fetch 等写操作统一收在这里，并继续经过确认弹窗和后端 guard。
            </p>
            {canRenderBranchCompareFiles === true && (
              <div className="mx-3 mt-3 rounded-md border bg-background/60 p-2 text-xs" data-testid="workspace-git-branch-compare-file-apply">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-medium text-muted-foreground">分支对比文件引入</span>
                  <Badge variant="outline" className="text-[10px]">guarded checkout</Badge>
                </div>
                <div className="space-y-1">
                  {materializeGitPanelBranchCompareFileNodes({
                    files: branchCompareFiles,
                    baseBranch: branchCompareBaseBranch,
                    headBranch: branchCompareHeadBranch,
                    onCopyText,
                    setPendingBranchCompareFileApplyConfirmation,
                  })}
                </div>
                <p className="mt-2 text-muted-foreground">
                  引入文件只从目标分支对单文件执行路径限定 checkout，复制 patch 只写入系统剪贴板；当前分支必须仍等于基准分支，且目标文件 dirty 时会被 guard 阻断。
                </p>
              </div>
            )}
            <div className="mx-3 mt-3 rounded-md border bg-background/60 p-2 text-xs" data-testid="workspace-git-stash-create">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-medium text-muted-foreground">保存 dirty worktree 为 stash</span>
                <Badge variant="outline" className="text-[10px]">guarded create</Badge>
              </div>
              <div className="grid gap-2">
                <Input
                  value={stashCreateMessage}
                  onChange={(event) => setStashCreateMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && canCreateStash === true) {
                      openStashCreateConfirmation();
                    }
                  }}
                  placeholder="stash message"
                  maxLength={200}
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-full text-xs"
                  disabled={canCreateStash === false}
                  onClick={openStashCreateConfirmation}
                >
                  创建 stash
                </Button>
              </div>
              <p className="mt-2 text-muted-foreground">
                该入口通过显式 POST 执行 `git stash push --include-untracked -m`，仅在 dirty worktree 且 message 非空时可用；不会提交、reset、pop、drop 或 clear stash。
              </p>
            </div>
            <div className="mx-3 mt-3 rounded-md border bg-background/60 p-2 text-xs" data-testid="workspace-git-worktree-commit">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-medium text-muted-foreground">提交 worktree dirty 变更</span>
                <Badge variant="outline" className="text-[10px]">git add -A</Badge>
              </div>
              <div className="grid gap-2">
                <Input
                  value={worktreeCommitMessage}
                  onChange={(event) => setWorktreeCommitMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && canCommitWorktree === true) {
                      openWorktreeCommitConfirmation();
                    }
                  }}
                  placeholder="Commit message"
                  maxLength={200}
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 w-full text-xs"
                  disabled={canCommitWorktree === false}
                  onClick={() => {
                    openWorktreeCommitConfirmation();
                  }}
                >
                  提交
                </Button>
              </div>
              <p className="mt-2 text-muted-foreground">
                该入口通过显式 POST 提交当前全部 dirty worktree 变更，后端复用 `git add -A` 与 `git commit -m`；不执行 reset、stash、分支切换、merge 或 selective staging。
              </p>
            </div>
            {canRenderWorktreeDiffFiles === true && (
              <div className="mx-3 mt-3 space-y-2" data-testid="workspace-git-worktree-diff-preview">
                {materializeGitPanelWorktreeDiffFileNodes({
                  files: worktreeDiffFiles,
                  onOpenFile,
                  onCopyText,
                  setPendingWorktreeFileDiscardConfirmation,
                })}
              </div>
            )}
            <div className="mx-3 mt-3 rounded-md border bg-background/60 p-2 text-xs">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-medium text-muted-foreground">创建本地分支</span>
                <Badge variant="outline" className="text-[10px]">no checkout</Badge>
              </div>
              <div className="flex gap-2">
                <Input
                  value={branchCreateName}
                  onChange={(event) => setBranchCreateName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && canCreateBranch === true) {
                      setPendingBranchMutationConfirmation({
                        action: 'create',
                        branchName: branchCreateValue,
                      });
                    }
                  }}
                  placeholder="feature/local-branch"
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 shrink-0 text-xs"
                  disabled={canCreateBranch === false}
                  onClick={() => {
                    if (canCreateBranch === false) return;
                    setPendingBranchMutationConfirmation({
                      action: 'create',
                      branchName: branchCreateValue,
                    });
                  }}
                >
                  创建
                </Button>
              </div>
              <p className="mt-2 text-muted-foreground">
                从当前 HEAD 创建本地分支；成功后刷新分支真源并设为对比目标，不切换工作区。
              </p>
            </div>
            {canRenderCompareTargetBranches === true && (
              <div className="mx-3 mt-3 rounded-md border bg-background/60 p-2 text-xs">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-medium text-muted-foreground">对比目标分支</span>
                  <Badge variant="outline" className="text-[10px]">local target</Badge>
                </div>
                <Select value={compareTargetValue} onValueChange={(value) => void onSelectGitBranchCompareTarget(value)}>
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue placeholder="选择目标分支" />
                  </SelectTrigger>
                  <SelectContent>
                    {materializeGitPanelCompareTargetBranchOptionNodes(compareTargetBranches)}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="destructive"
                  className="mt-2 h-7 w-full text-xs"
                  disabled={canDeleteCompareTarget === false}
                  onClick={() => {
                    if (canDeleteCompareTarget === false) return;
                    setPendingBranchMutationConfirmation({
                      action: 'delete',
                      branchName: compareTargetValue,
                    });
                  }}
                >
                  删除目标本地分支
                </Button>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={branchRenameName}
                    onChange={(event) => setBranchRenameName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && canRenameCompareTarget === true) {
                        setPendingBranchMutationConfirmation({
                          action: 'rename',
                          branchName: compareTargetValue,
                          nextBranchName: branchRenameValue,
                        });
                      }
                    }}
                    placeholder="feature/renamed-branch"
                    className="h-8 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 shrink-0 text-xs"
                    disabled={canRenameCompareTarget === false}
                    onClick={() => {
                      if (canRenameCompareTarget === false) return;
                      setPendingBranchMutationConfirmation({
                        action: 'rename',
                        branchName: compareTargetValue,
                        nextBranchName: branchRenameValue,
                      });
                    }}
                  >
                    重命名
                  </Button>
                </div>
                <p className="mt-2 text-muted-foreground">
                  基准分支：{currentGitBranchLabel}；删除使用受控 git branch -d，重命名使用受控 git branch -m，均不切换工作区或操作远端。
                </p>
              </div>
            )}
            {canRenderGitPanelBranchSwitchReadiness(renderableBranchSwitchReadiness) === true && (
              <div className="mx-3 mt-3 rounded-md border bg-background/60 p-2 text-xs">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-medium text-muted-foreground">分支切换预检</span>
                  <Badge variant={branchSwitchBadgeVariant} className="text-[10px]">
                    {renderableBranchSwitchReadiness.status}
                  </Badge>
                </div>
                <div className="grid gap-1 text-muted-foreground">
                  <span>Current: {branchSwitchCurrentBranchLabel}</span>
                  <span>Target: {branchSwitchTargetBranchLabel}</span>
                  <span>DirtyFiles: {renderableBranchSwitchReadiness.dirty_files}</span>
                </div>
                <p className="mt-2">{renderableBranchSwitchReadiness.message}</p>
                <p className="mt-1 text-muted-foreground">{renderableBranchSwitchReadiness.recovery}</p>
                <Button
                  size="sm"
                  className="mt-3 h-7 w-full text-xs"
                  disabled={renderableBranchSwitchReadiness.can_switch === false}
                  onClick={() => setPendingBranchSwitchConfirmation({
                    action: 'switch',
                    currentBranch: renderableBranchSwitchReadiness.current_branch,
                    targetBranch: renderableBranchSwitchReadiness.target_branch,
                    readinessStatus: renderableBranchSwitchReadiness.status,
                    dirtyFiles: renderableBranchSwitchReadiness.dirty_files,
                    canSwitch: renderableBranchSwitchReadiness.can_switch,
                  })}
                >
                  切换到目标分支
                </Button>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      {canRenderBranchCompareStaleBanner === true && (
        <div className="mx-3 mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
          <p className="font-medium">{branchCompareStaleBannerTitle}</p>
          <p className="mt-1">{branchCompareStaleBannerMessage}</p>
        </div>
      )}
      {canRenderBranchListStaleBanner === true && (
        <div className="mx-3 mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
          <p className="font-medium">{branchListStaleBannerTitle}</p>
          <p className="mt-1">{branchListStaleBannerMessage}</p>
        </div>
      )}
      {canRenderTagListStaleBanner === true && (
        <div className="mx-3 mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
          <p className="font-medium">{tagListStaleBannerTitle}</p>
          <p className="mt-1">{tagListStaleBannerMessage}</p>
        </div>
      )}
      {canRenderGitBranches === true && (
        <div className="mx-3 mt-3 space-y-1 rounded-md border bg-muted/10 p-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-muted-foreground">分支列表</p>
            <Badge variant="outline" className="text-[10px]">read-only tracking</Badge>
          </div>
          {materializeGitPanelBranchNodes({
            branches: gitBranches,
            onViewCommit,
          })}
          <p className="mt-2 text-muted-foreground">
            分支提交查看只复用提交详情读取链路；不 checkout、不切换分支、不 fetch 或修改工作区文件。
          </p>
        </div>
      )}
      {canRenderGitTags === true && (
        <div className="mx-3 mt-3 space-y-1 rounded-md border bg-muted/10 p-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-muted-foreground">标签列表</p>
            <Badge variant="outline" className="text-[10px]">read-only</Badge>
          </div>
          {materializeGitPanelTagNodes({
            tags: gitTags,
            onViewCommit,
            setPendingTagMutationConfirmation,
          })}
        </div>
      )}
      <Accordion type="single" collapsible className="mx-3 mt-3" data-testid="workspace-git-advanced-remote-operations">
        <AccordionItem value="advanced-git-remote-operations" className="rounded-md border bg-muted/10">
          <AccordionTrigger className="px-3 py-2 text-xs hover:no-underline">
            <div className="mr-3 flex flex-1 items-center justify-between gap-2">
              <span className="font-medium text-muted-foreground">高级远端、标签与 stash 操作</span>
              <Badge variant="outline" className="text-[10px]">默认收起</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-3">
            <div className="mx-3 mt-3 rounded-md border bg-background/60 p-2 text-xs" data-testid="workspace-git-tag-create">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-medium text-muted-foreground">创建本地标签</span>
                <Badge variant="outline" className="text-[10px]">local tag</Badge>
              </div>
              <div className="flex gap-2">
                <Input
                  value={tagCreateName}
                  onChange={(event) => setTagCreateName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && canCreateTag === true) {
                      setPendingTagMutationConfirmation({
                        action: 'create',
                        tagName: tagCreateValue,
                        targetCommit: 'HEAD',
                      });
                    }
                  }}
                  placeholder="v0.1.0"
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 shrink-0 text-xs"
                  disabled={canCreateTag === false}
                  onClick={() => {
                    if (canCreateTag === false) return;
                    setPendingTagMutationConfirmation({
                      action: 'create',
                      tagName: tagCreateValue,
                      targetCommit: 'HEAD',
                    });
                  }}
                >
                  创建标签
                </Button>
              </div>
              <p className="mt-2 text-muted-foreground">
                从当前 HEAD 创建本地 lightweight tag；成功后只刷新标签真源，不 checkout、不 push tag、不创建提交或修改工作区文件。
              </p>
            </div>
            <div className="mx-3 mt-3 space-y-2 rounded-md border bg-background/60 p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-muted-foreground">远端引用刷新</p>
                <Badge variant="outline" className="text-[10px]">controlled fetch</Badge>
              </div>
              {canRenderObservedRemoteNames === true && (
                <Select value={remoteBranchRefreshValue} onValueChange={setRemoteBranchRefreshName}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="选择 remote" />
                  </SelectTrigger>
                  <SelectContent>
                    {materializeGitPanelObservedRemoteNameOptionNodes(observedRemoteNames)}
                  </SelectContent>
                </Select>
              )}
              <div className="flex gap-2">
                <Input
                  value={remoteBranchRefreshName}
                  onChange={(event) => setRemoteBranchRefreshName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && canRefreshRemoteBranches === true) {
                      openRemoteBranchRefreshConfirmation();
                    }
                  }}
                  placeholder={remoteBranchRefreshPlaceholder}
                  className="h-7 text-xs"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 shrink-0 text-xs"
                  disabled={canRefreshRemoteBranches === false}
                  onClick={() => {
                    openRemoteBranchRefreshConfirmation();
                  }}
                >
                  刷新 remote refs
                </Button>
              </div>
              <p className="text-muted-foreground">
                仅执行受控 fetch 刷新已配置 remote 的本地远端引用；remote 候选来自只读 `git remote`（{gitRemoteListStatusLabel}），不会 pull、push、prune、checkout 或修改工作区文件。
              </p>
            </div>
            {canRenderGitRemoteBranches === true && (
              <div className="mx-3 mt-3 space-y-1 rounded-md border bg-background/60 p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-muted-foreground">远端分支列表</p>
                  <Badge variant="outline" className="text-[10px]">read-only</Badge>
                </div>
                {materializeGitPanelRemoteBranchNodes({
                  branches: gitRemoteBranches,
                  resolveRemoteBranchLocalName,
                  onRemoteBranchLocalNameChange: handleRemoteBranchLocalNameChange,
                  openRemoteBranchCreateConfirmation,
                  onViewCommit,
                })}
                <p className="text-muted-foreground">
                  只从本地已有 remote refs 创建本地跟踪分支；不会 fetch、pull、push、prune 或切换工作区。
                </p>
              </div>
            )}
            {canRenderGitStashes === true && (
              <div className="mx-3 mt-3 space-y-1 rounded-md border bg-background/60 p-2 text-xs" data-testid="workspace-git-stash-apply">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-muted-foreground">Stash 列表</p>
                  <Badge variant="outline" className="text-[10px]">guarded apply</Badge>
                </div>
                {materializeGitPanelStashNodes({
                  stashes: gitStashes,
                  onViewCommit,
                  setPendingStashMutationConfirmation,
                })}
                <p className="text-muted-foreground">
                  列表读取仍只走 stash list；应用入口会要求 worktree clean，并先做 patch 预检，只执行 stash apply，不会 pop、drop 或 clear stash。
                </p>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <GitPanelSnapshotStrip snapshot={gitPanelSnapshot} />
      {canRenderCommitListStaleBanner === true && (
        <div className="mx-3 mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
          <p className="font-medium">{commitListStaleBannerTitle}</p>
          <p className="mt-1">{commitListStaleBannerMessage}</p>
        </div>
      )}
      {canRenderEmptySelectedCommitDetail === true && (
        <div className="mx-3 mt-3">
          <GitCommitDetailSnapshotStrip snapshot={gitCommitDetailSnapshot} />
        </div>
      )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {canRenderGitCommitEmptyState === true ? (
          <p className="p-2 text-sm text-muted-foreground">暂无提交记录</p>
        ) : canRenderGitCommits === true ? (
          materializeGitPanelCommitNodes({
            commits: gitCommits,
            selectedCommit,
            gitCommitDetailStatus,
            gitCommitDetailSnapshot,
            onViewCommit,
            onOpenFile,
            onCopyText,
            setPendingCommitFileRestoreConfirmation,
          })
        ) : null
        }
      </div>
      <AlertDialog
        open={pendingBranchCompareFileApplyConfirmation !== null}
        onOpenChange={(open) => {
          if (open === false && isConfirmingBranchCompareFileApply === false) {
            setPendingBranchCompareFileApplyConfirmation(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认引入分支对比文件</AlertDialogTitle>
            <AlertDialogDescription>
              确认从 {branchCompareApplyHeadBranchLabel} 引入 {branchCompareApplyFilePathLabel} 到当前基准分支 {branchCompareApplyBaseBranchLabel}？该操作会走后端 guarded checkout，只允许路径限定单文件引入，不会 merge、reset、切换分支或修改非目标文件。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <GitBranchCompareFileApplyConfirmationSnapshotStrip snapshot={gitBranchCompareFileApplyConfirmationSnapshot} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={gitBranchCompareFileApplyConfirmationSnapshot.canCancel === false}>取消</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={gitBranchCompareFileApplyConfirmationSnapshot.canConfirm === false}
              onClick={() => {
                void handleConfirmBranchCompareFileApply();
              }}
            >
              {branchCompareFileApplyConfirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={pendingCommitFileRestoreConfirmation !== null}
        onOpenChange={(open) => {
          if (open === false && isConfirmingCommitFileRestore === false) {
            setPendingCommitFileRestoreConfirmation(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认恢复提交中的单个文件</AlertDialogTitle>
            <AlertDialogDescription>
              确认从提交 {gitCommitFileRestoreConfirmationSnapshot.shortHash} 恢复 {commitFileRestoreFilePathLabel}？该操作会走后端 guarded checkout，只恢复目标文件；目标文件存在 dirty 变更时会被阻断，不会 reset、merge、切换分支或修改非目标文件。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <GitCommitFileRestoreConfirmationSnapshotStrip snapshot={gitCommitFileRestoreConfirmationSnapshot} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={gitCommitFileRestoreConfirmationSnapshot.canCancel === false}>取消</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={gitCommitFileRestoreConfirmationSnapshot.canConfirm === false}
              onClick={() => {
                void handleConfirmCommitFileRestore();
              }}
            >
              {commitFileRestoreConfirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={pendingTagMutationConfirmation !== null}
        onOpenChange={(open) => {
          if (open === false && isConfirmingTagMutation === false) {
            setPendingTagMutationConfirmation(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tagMutationTitle}</AlertDialogTitle>
            <AlertDialogDescription>{tagMutationDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <GitTagMutationConfirmationSnapshotStrip snapshot={gitTagMutationConfirmationSnapshot} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={gitTagMutationConfirmationSnapshot.canCancel === false}>取消</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={gitTagMutationConfirmationSnapshot.canConfirm === false}
              onClick={() => {
                void handleConfirmTagMutation();
              }}
            >
              {tagMutationConfirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={pendingBranchMutationConfirmation !== null}
        onOpenChange={(open) => {
          if (open === false && isConfirmingBranchMutation === false) {
            setPendingBranchMutationConfirmation(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{branchMutationTitle}</AlertDialogTitle>
            <AlertDialogDescription>{branchMutationDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <GitBranchMutationConfirmationSnapshotStrip snapshot={gitBranchMutationConfirmationSnapshot} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={gitBranchMutationConfirmationSnapshot.canCancel === false}>取消</AlertDialogCancel>
            <Button
              variant={branchMutationButtonVariant}
              disabled={gitBranchMutationConfirmationSnapshot.canConfirm === false}
              onClick={() => {
                void handleConfirmBranchMutation();
              }}
            >
              {branchMutationConfirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={pendingBranchSwitchConfirmation !== null}
        onOpenChange={(open) => {
          if (open === false && isConfirmingBranchSwitch === false) {
            setPendingBranchSwitchConfirmation(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认切换 Git 分支</AlertDialogTitle>
            <AlertDialogDescription>
              确认从 {branchSwitchCurrentBranchDialogLabel} 切换到 {branchSwitchTargetBranchDialogLabel}？该操作会走后端 guarded switch，并复核 dirty worktree、当前分支和目标分支，不会 merge、reset、stash 或修改远端。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <GitBranchSwitchConfirmationSnapshotStrip snapshot={gitBranchSwitchConfirmationSnapshot} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={gitBranchSwitchConfirmationSnapshot.canCancel === false}>取消</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={gitBranchSwitchConfirmationSnapshot.canConfirm === false}
              onClick={() => {
                void handleConfirmBranchSwitch();
              }}
            >
              {branchSwitchConfirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={pendingRemoteBranchRefreshConfirmation !== null}
        onOpenChange={(open) => {
          if (open === false && isConfirmingRemoteBranchRefresh === false) {
            setPendingRemoteBranchRefreshConfirmation(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认刷新 remote refs</AlertDialogTitle>
            <AlertDialogDescription>
              确认对 remote {remoteBranchRefreshRemoteNameLabel} 执行受控 fetch？该操作会刷新本地远端引用，不会 pull、push、prune、checkout 或修改工作区文件。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <GitRemoteBranchRefreshConfirmationSnapshotStrip snapshot={gitRemoteBranchRefreshConfirmationSnapshot} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={gitRemoteBranchRefreshConfirmationSnapshot.canCancel === false}>取消</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={gitRemoteBranchRefreshConfirmationSnapshot.canConfirm === false}
              onClick={() => {
                void handleConfirmRemoteBranchRefresh();
              }}
            >
              {remoteBranchRefreshConfirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={pendingRemoteBranchCreateConfirmation !== null}
        onOpenChange={(open) => {
          if (open === false && isConfirmingRemoteBranchCreate === false) {
            setPendingRemoteBranchCreateConfirmation(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认创建本地 tracking branch</AlertDialogTitle>
            <AlertDialogDescription>
              确认从 remote ref {remoteBranchCreateRemoteBranchNameLabel} 创建本地分支 {remoteBranchCreateLocalBranchNameLabel}？该操作会走后端 guarded git branch --track，只使用本地已有 remote refs，不会 fetch、pull、push、prune、checkout、switch 或修改工作区文件。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <GitRemoteBranchCreateConfirmationSnapshotStrip snapshot={gitRemoteBranchCreateConfirmationSnapshot} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={gitRemoteBranchCreateConfirmationSnapshot.canCancel === false}>取消</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={gitRemoteBranchCreateConfirmationSnapshot.canConfirm === false}
              onClick={() => {
                void handleConfirmRemoteBranchCreate();
              }}
            >
              {remoteBranchCreateConfirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={pendingStashMutationConfirmation !== null}
        onOpenChange={(open) => {
          if (open === false && isConfirmingStashMutation === false) {
            setPendingStashMutationConfirmation(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingStashMutationConfirmation?.action === 'create' ? '确认创建 stash' : '确认应用 stash'}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStashMutationConfirmation?.action === 'create'
                ? <>确认将当前 dirty worktree 保存为 stash，message 为 {stashMutationMessageLabel}？该操作会走后端 guarded git stash push --include-untracked，不会提交、reset、pop、drop 或 clear stash。</>
                : <>确认应用 stash {stashMutationStashRefLabel}？该操作会走后端 guarded git stash apply --index，要求 worktree clean 并先做 patch 预检，不会 pop、drop 或 clear stash。</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <GitStashMutationConfirmationSnapshotStrip snapshot={gitStashMutationConfirmationSnapshot} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={gitStashMutationConfirmationSnapshot.canCancel === false}>取消</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={gitStashMutationConfirmationSnapshot.canConfirm === false}
              onClick={() => {
                void handleConfirmStashMutation();
              }}
            >
              {stashMutationConfirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={pendingWorktreeCommitConfirmation !== null}
        onOpenChange={(open) => {
          if (open === false && isConfirmingWorktreeCommit === false) {
            setPendingWorktreeCommitConfirmation(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认提交 worktree 变更</AlertDialogTitle>
            <AlertDialogDescription>
              确认将当前 {worktreeCommitDirtyFilesLabel} 个 dirty 文件提交到 {worktreeCommitCurrentBranchLabel}？该操作会走既有显式 POST，后端复用 git add -A 与 git commit -m，不执行 reset、stash、分支切换、merge 或 selective staging。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <GitWorktreeCommitConfirmationSnapshotStrip snapshot={gitWorktreeCommitConfirmationSnapshot} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={gitWorktreeCommitConfirmationSnapshot.canCancel === false}>取消</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={gitWorktreeCommitConfirmationSnapshot.canConfirm === false}
              onClick={() => {
                void handleConfirmWorktreeCommit();
              }}
            >
              {worktreeCommitConfirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={pendingWorktreeFileDiscardConfirmation !== null}
        onOpenChange={(open) => {
          if (open === false && isConfirmingWorktreeFileDiscard === false) {
            setPendingWorktreeFileDiscardConfirmation(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认丢弃文件变更</AlertDialogTitle>
            <AlertDialogDescription>
              确认丢弃 {worktreeFileDiscardFilePathLabel} 的 worktree 变更？该操作会走后端 guarded discard-file，只允许路径限定恢复或清理，不会执行整仓 reset、clean、stash 或分支切换。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <GitWorktreeFileDiscardConfirmationSnapshotStrip snapshot={gitWorktreeFileDiscardConfirmationSnapshot} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={gitWorktreeFileDiscardConfirmationSnapshot.canCancel === false}>取消</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={gitWorktreeFileDiscardConfirmationSnapshot.canConfirm === false}
              onClick={() => {
                void handleConfirmWorktreeFileDiscard();
              }}
            >
              {worktreeFileDiscardConfirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
