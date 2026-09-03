'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import { MousePointer2, Send, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { collaborationApi } from '@/lib/collaboration-api';
import {
  buildVisualEditPreviewUrl,
  getVisualEditPreviewOrigin,
  getVisualEditTargetLabel,
  isVisualEditPreviewEligible,
  parseVisualEditBridgeMessage,
  type VisualEditContext,
} from '@/lib/visual-edit';

export type WorkspaceVisualEditSubmitAction = (
  context: VisualEditContext,
  instruction: string,
) => void | Promise<void>;

type UseWorkspaceVisualEditOptions = {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  previewUrl: string;
  runtimeHomeUrl: string;
  projectId: string | null;
  canWrite: boolean;
  onSubmit: WorkspaceVisualEditSubmitAction;
};

export type WorkspaceVisualEditController = {
  enabled: boolean;
  bridgeReady: boolean;
  eligible: boolean;
  selection: VisualEditContext | null;
  instruction: string;
  error: string;
  submitting: boolean;
  iframeUrl: string;
  toggle: () => void;
  close: () => void;
  setInstruction: (value: string) => void;
  submit: () => Promise<void>;
};

function getVisualEditBaseHref(): string {
  if (typeof window === 'undefined') return 'http://localhost/';
  return window.location.href;
}

function canStartWorkspaceVisualEdit({
  projectId,
  canWrite,
  previewUrl,
  runtimeHomeUrl,
  baseHref,
}: {
  projectId: string | null;
  canWrite: boolean;
  previewUrl: string;
  runtimeHomeUrl: string;
  baseHref: string;
}): boolean {
  return projectId !== null
    && projectId.length > 0
    && canWrite
    && isVisualEditPreviewEligible(previewUrl, runtimeHomeUrl, baseHref);
}

export function useWorkspaceVisualEdit({
  iframeRef,
  previewUrl,
  runtimeHomeUrl,
  projectId,
  canWrite,
  onSubmit,
}: UseWorkspaceVisualEditOptions): WorkspaceVisualEditController {
  const [enabled, setEnabled] = useState(false);
  const [bridgeReady, setBridgeReady] = useState(false);
  const [selection, setSelection] = useState<VisualEditContext | null>(null);
  const [instruction, setInstruction] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [accessCanWrite, setAccessCanWrite] = useState(false);
  const baseHref = getVisualEditBaseHref();
  const eligible = canStartWorkspaceVisualEdit({
    projectId,
    canWrite: canWrite && accessCanWrite,
    previewUrl,
    runtimeHomeUrl,
    baseHref,
  });
  const iframeUrl = useMemo(
    () => buildVisualEditPreviewUrl(previewUrl, enabled && eligible, baseHref),
    [baseHref, eligible, enabled, previewUrl],
  );

  useEffect(() => {
    let active = true;
    setAccessCanWrite(false);

    if (
      projectId === null
      || projectId.length === 0
      || canWrite === false
    ) {
      return () => {
        active = false;
      };
    }

    void collaborationApi.access(projectId)
      .then((access) => {
        if (active) {
          setAccessCanWrite(access.can_write === true);
        }
      })
      .catch(() => {
        if (active) {
          setAccessCanWrite(false);
        }
      });

    return () => {
      active = false;
    };
  }, [canWrite, projectId]);

  useEffect(() => {
    setEnabled(false);
    setBridgeReady(false);
    setSelection(null);
    setInstruction('');
    setError('');
  }, [previewUrl, projectId]);

  useEffect(() => {
    if (eligible) return;
    setEnabled(false);
    setBridgeReady(false);
    setSelection(null);
    setInstruction('');
    setError('');
  }, [eligible]);


  useEffect(() => {
    if (!enabled || !eligible) return undefined;
    const expectedOrigin = getVisualEditPreviewOrigin(iframeUrl, baseHref);
    const receiveMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== iframeRef.current?.contentWindow || event.origin !== expectedOrigin) return;
      const message = parseVisualEditBridgeMessage(event.data);
      if (message === null) return;
      if (message.type === 'yistack:visual-edit-ready') {
        setBridgeReady(true);
        setError('');
        return;
      }
      if (message.type === 'yistack:visual-edit-cancelled') {
        setEnabled(false);
        setSelection(null);
        setInstruction('');
        return;
      }
      if (message.selection !== undefined) {
        setSelection(message.selection);
        setInstruction('');
        setError('');
      }
    };
    window.addEventListener('message', receiveMessage);
    return () => window.removeEventListener('message', receiveMessage);
  }, [baseHref, eligible, enabled, iframeRef, iframeUrl]);

  useEffect(() => {
    if (!enabled || !eligible || bridgeReady) return undefined;
    const timeout = window.setTimeout(() => {
      setError('预览检查器未连接，请刷新预览后重试。');
    }, 4000);
    return () => window.clearTimeout(timeout);
  }, [bridgeReady, eligible, enabled]);

  const close = useCallback(() => {
    setEnabled(false);
    setBridgeReady(false);
    setSelection(null);
    setInstruction('');
    setError('');
  }, []);

  const toggle = useCallback(() => {
    if (!eligible) return;
    if (enabled) {
      close();
      return;
    }
    setEnabled(true);
    setBridgeReady(false);
    setSelection(null);
    setInstruction('');
    setError('');
  }, [close, eligible, enabled]);

  const submit = useCallback(async () => {
    const normalizedInstruction = instruction.trim();
    if (!eligible || selection === null || normalizedInstruction.length === 0 || submitting) {
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(selection, normalizedInstruction);
      close();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '视觉修改请求提交失败');
    } finally {
      setSubmitting(false);
    }
  }, [close, eligible, instruction, onSubmit, selection, submitting]);

  return {
    enabled,
    bridgeReady,
    eligible,
    selection,
    instruction,
    error,
    submitting,
    iframeUrl,
    toggle,
    close,
    setInstruction,
    submit,
  };
}

export function WorkspaceVisualEditToggle({
  controller,
}: {
  controller: WorkspaceVisualEditController;
}) {
  const title = controller.eligible
    ? controller.enabled ? '关闭元素选择' : '选择预览元素'
    : '仅项目预览的 owner/editor 可以使用可视化编辑';
  return (
    <Button
      type="button"
      variant={controller.enabled ? 'secondary' : 'ghost'}
      size="icon"
      className="h-7 w-7"
      disabled={!controller.eligible}
      title={title}
      aria-label={title}
      data-testid="workspace-visual-edit-toggle"
      onClick={controller.toggle}
    >
      <MousePointer2 className="h-4 w-4" />
    </Button>
  );
}

export function WorkspaceVisualEditPanel({
  controller,
  compact = false,
}: {
  controller: WorkspaceVisualEditController;
  compact?: boolean;
}) {
  if (!controller.enabled) return null;
  const selection = controller.selection;
  return (
    <div
      className="absolute inset-x-0 bottom-0 z-20 max-h-[48%] overflow-y-auto border-t bg-background/95 p-3 shadow-lg backdrop-blur-sm"
      data-testid="workspace-visual-edit-panel"
    >
      <div className="flex items-center gap-2">
        <MousePointer2 className="h-4 w-4 shrink-0 text-sky-600" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {selection === null
            ? controller.bridgeReady ? '等待选择元素' : '正在连接预览检查器'
            : getVisualEditTargetLabel(selection)}
        </span>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="关闭元素选择" onClick={controller.close}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      {selection !== null && (
        <>
          <code className="mt-2 block truncate text-xs text-muted-foreground" title={selection.selector}>
            {selection.selector}
          </code>
          <div className={compact ? 'mt-2 grid gap-2' : 'mt-3 flex items-end gap-2'}>
            <textarea
              value={controller.instruction}
              onChange={(event) => controller.setInstruction(event.target.value.slice(0, 2000))}
              className="min-h-16 flex-1 resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="修改要求"
              aria-label="视觉修改要求"
              data-testid="workspace-visual-edit-instruction"
            />
            <Button
              type="button"
              className={compact ? 'w-full' : 'shrink-0'}
              disabled={controller.instruction.trim().length === 0 || controller.submitting}
              onClick={() => void controller.submit()}
              data-testid="workspace-visual-edit-submit"
            >
              <Send className="mr-2 h-4 w-4" />
              {controller.submitting ? '提交中' : '生成修改'}
            </Button>
          </div>
        </>
      )}
      {controller.error.length > 0 && (
        <p role="status" className="mt-2 text-xs text-red-600 dark:text-red-300">
          {controller.error}
        </p>
      )}
    </div>
  );
}
