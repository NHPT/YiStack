'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { projectApi } from '@/lib/api';
import {
  formatTerminalWebSocketError,
  formatTerminalWebSocketState,
} from '@/lib/workspace/terminal-local-errors';
import {
  buildTerminalCloseConfirmationSnapshot,
  TerminalCloseConfirmationSnapshotStrip,
} from '@/app/workspace/workspace-terminal-close-confirmation-snapshot';
import { buildTerminalPanelSnapshot } from '@/app/workspace/workspace-terminal-panel-snapshot';
import type {
  TerminalConnectionSnapshot,
  TerminalConnectionSnapshotSource,
  TerminalConnectionSnapshotStatus,
  TerminalPanelConnectionStatus,
  TerminalThemeMode,
} from '@/app/workspace/workspace-types';

interface TerminalProps {
  projectId: string | null;
  active?: boolean;
}

interface TerminalWebSocketMessage {
  type: string;
  data?: string;
  sessionId?: string;
  message?: string;
  closeReason?: string;
  exitCode?: number;
}

type TerminalWebSocketInputPayload = {
  type: 'input';
  data: string;
};

type TerminalWebSocketResizePayload = {
  type: 'resize';
  rows: number;
  cols: number;
};

export type TerminalWebSocketSendPayload =
  | TerminalWebSocketInputPayload
  | TerminalWebSocketResizePayload;

type TerminalSendResult =
  | { ok: true }
  | { ok: false; reason: string };

function getTerminalPanelSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

function getTerminalPanelSnapshotSocketLabel(value: boolean): string {
  return value === true ? 'ready' : 'not_ready';
}

const TERMINAL_THEMES: Record<TerminalThemeMode, { background: string; foreground: string; cursor: string; selectionBackground: string }> = {
  dark: {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    cursor: '#d4d4d4',
    selectionBackground: 'rgba(255,255,255,0.2)',
  },
  light: {
    background: '#f8fafc',
    foreground: '#0f172a',
    cursor: '#0f172a',
    selectionBackground: 'rgba(15,23,42,0.18)',
  },
};

export function TerminalPanel({ projectId, active = true }: TerminalProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const isStartingRef = useRef(false);
  const inputFlushTimerRef = useRef<number | null>(null);
  const inputBufferRef = useRef('');
  const closingRef = useRef(false);
  const statusRef = useRef<TerminalPanelConnectionStatus>('idle');
  const lastProjectIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<TerminalPanelConnectionStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('未连接');
  const [isTerminalCloseConfirmationOpen, setIsTerminalCloseConfirmationOpen] = useState(false);
  const [isTerminalCloseConfirming, setIsTerminalCloseConfirming] = useState(false);
  const hasTerminalProjectId = projectId !== null && projectId.length > 0;
  const hasTerminalSocket = socketRef.current !== null;
  const canStartTerminalSession = hasTerminalProjectId === true && isStartingRef.current === false;
  const canCloseTerminalSession = hasTerminalSocket === true;
  const terminalMounted = xtermRef.current !== null;
  const terminalSocketReady = typeof WebSocket !== 'undefined' && socketRef.current?.readyState === WebSocket.OPEN;
  const [connectionSnapshot, setConnectionSnapshot] = useState<TerminalConnectionSnapshot>({
    status: 'idle',
    source: 'workspace_project',
    message: '终端尚未连接项目。',
    recovery: '选择项目后打开终端面板会自动建立连接。',
    updatedAt: 'pending',
  });
  const [themeMode, setThemeMode] = useState<TerminalThemeMode>('dark');
  const terminalPanelSnapshot = buildTerminalPanelSnapshot({
    projectId,
    active,
    terminalMounted,
    socketReady: terminalSocketReady,
    isStarting: isStartingRef.current,
    connectionSnapshot,
    themeMode,
    status,
  });
  const terminalCloseConfirmationSnapshot = buildTerminalCloseConfirmationSnapshot({
    isOpen: isTerminalCloseConfirmationOpen,
    isConfirming: isTerminalCloseConfirming,
    terminalPanelSnapshot,
    inputBufferLength: inputBufferRef.current.length,
  });
  const terminalPanelHasProjectLabel = getTerminalPanelSnapshotBooleanLabel(terminalPanelSnapshot.hasProject);
  const terminalPanelIsActiveLabel = getTerminalPanelSnapshotBooleanLabel(terminalPanelSnapshot.isActive);
  const terminalPanelMountedLabel = getTerminalPanelSnapshotBooleanLabel(terminalPanelSnapshot.terminalMounted);
  const terminalPanelSocketReadyLabel = getTerminalPanelSnapshotSocketLabel(terminalPanelSnapshot.socketReady);
  const terminalPanelCanReconnectLabel = getTerminalPanelSnapshotBooleanLabel(terminalPanelSnapshot.canReconnect);
  const terminalPanelCanCloseLabel = getTerminalPanelSnapshotBooleanLabel(terminalPanelSnapshot.canClose);
  const terminalPanelHasErrorBannerLabel = getTerminalPanelSnapshotBooleanLabel(terminalPanelSnapshot.hasErrorBanner);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const updateConnectionSnapshot = useCallback((
    nextStatus: TerminalConnectionSnapshotStatus,
    source: TerminalConnectionSnapshotSource,
    message: string,
    recovery: string,
  ) => {
    setConnectionSnapshot({
      status: nextStatus,
      source,
      message,
      recovery,
      updatedAt: new Date().toISOString(),
    });
  }, []);

  const writeSystemLine = useCallback((text: string) => {
    xtermRef.current?.writeln(`\x1b[90m${text}\x1b[0m`);
  }, []);

  const getTerminalWebSocketUrl = useCallback((ticket: string) => {
    const configuredBase = process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:8080';
    const baseUrl = configuredBase.startsWith('http')
      ? new URL(configuredBase)
      : new URL(configuredBase, window.location.origin);
    baseUrl.protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    const normalizedPath = baseUrl.pathname.replace(/\/$/, '');
    baseUrl.pathname = normalizedPath.endsWith('/api')
      ? `${normalizedPath}/project/terminal/ws`
      : `${normalizedPath}/api/project/terminal/ws`;
    baseUrl.search = `ticket=${encodeURIComponent(ticket)}`;
    return baseUrl.toString();
  }, []);

  const sendSocketMessage = useCallback((payload: TerminalWebSocketSendPayload): TerminalSendResult => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return {
        ok: false,
        reason: formatTerminalWebSocketState('终端连接不可用', 'WebSocket is not open'),
      };
    }
    try {
      socketRef.current.send(JSON.stringify(payload));
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        reason: formatTerminalWebSocketError(error, '浏览器拒绝写入终端 WebSocket'),
      };
    }
  }, []);

  const resizeSession = useCallback(async (rows: number, cols: number) => {
    sendSocketMessage({ type: 'resize', rows, cols });
  }, [sendSocketMessage]);

  const flushInput = useCallback(async () => {
    inputFlushTimerRef.current = null;
    const payload = inputBufferRef.current;
    inputBufferRef.current = '';
    if (!payload) return;

    const sendResult = sendSocketMessage({ type: 'input', data: payload });
    if (!sendResult.ok) {
      setStatus('error');
      setStatusMessage(`终端输入发送失败：${sendResult.reason}`);
      updateConnectionSnapshot(
        'input_send_failed',
        'terminal_websocket',
        `终端输入发送失败：${sendResult.reason}`,
        '当前输入未确认写入容器 PTY，请重新连接终端后重试。',
      );
      writeSystemLine(`终端输入发送失败：${sendResult.reason}。当前输入未确认写入容器 PTY，请重新连接终端后重试。`);
    }
  }, [sendSocketMessage, updateConnectionSnapshot, writeSystemLine]);

  const queueInput = useCallback((input: string) => {
    inputBufferRef.current += input;
    if (inputFlushTimerRef.current === null) {
      inputFlushTimerRef.current = window.setTimeout(() => {
        void flushInput();
      }, 16);
    }
  }, [flushInput]);

  const closeSession = useCallback((reason?: string) => {
    const socket = socketRef.current;
    socketRef.current = null;
    if (inputFlushTimerRef.current !== null) {
      window.clearTimeout(inputFlushTimerRef.current);
      inputFlushTimerRef.current = null;
    }
    inputBufferRef.current = '';

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close(1000, 'client closing');
    }

    if (reason) {
      writeSystemLine(reason);
    }
  }, [writeSystemLine]);

  const handleManualClose = useCallback(() => {
    if (terminalCloseConfirmationSnapshot.canConfirm !== true) {
      return;
    }
    setIsTerminalCloseConfirming(true);
    closingRef.current = true;
    closeSession('终端已手动关闭。');
    setStatus('closed');
    setStatusMessage('终端已关闭');
    updateConnectionSnapshot(
      'manual_closed',
      'user_action',
      '终端已由用户手动关闭。',
      '可点击重新连接建立新的容器 PTY 会话。',
    );
    setIsTerminalCloseConfirming(false);
    setIsTerminalCloseConfirmationOpen(false);
  }, [closeSession, terminalCloseConfirmationSnapshot.canConfirm, updateConnectionSnapshot]);

  const startSession = useCallback(async () => {
    if (!projectId || !xtermRef.current || isStartingRef.current) return;

    isStartingRef.current = true;
    closeSession();
    setStatus('connecting');
    setStatusMessage('正在连接容器终端...');
    updateConnectionSnapshot(
      'ticket_requesting',
      'terminal_ticket',
      '正在申请终端 WebSocket 短期票据。',
      '如长时间停留在此状态，请检查终端 ws-ticket 代理和后端终端服务。',
    );

    const term = xtermRef.current;
    term.reset();
    term.clear();
    writeSystemLine('YiStack Terminal');
    writeSystemLine('正在连接容器 PTY 会话...');

    try {
      const ticket = await projectApi.createTerminalWebSocketTicket(projectId, {
        rows: term.rows,
        cols: term.cols,
      });
      updateConnectionSnapshot(
        'websocket_connecting',
        'terminal_websocket',
        '终端票据已获取，正在建立 WebSocket 连接并等待 PTY ready。',
        '如果连接失败，请重新连接终端并检查浏览器 WebSocket 或后端终端网关。',
      );
      const socket = new WebSocket(getTerminalWebSocketUrl(ticket.ticket));
      socketRef.current = socket;

      socket.onopen = () => {
        setStatus('connecting');
        setStatusMessage('连接已建立，等待终端就绪...');
        updateConnectionSnapshot(
          'websocket_connecting',
          'terminal_websocket',
          'WebSocket 已打开，正在等待容器 PTY ready 消息。',
          '若迟迟未 ready，请检查容器 PTY 会话创建和 runtime 健康状态。',
        );
      };

      socket.onmessage = (event) => {
        let payload: TerminalWebSocketMessage | null = null;
        try {
          payload = JSON.parse(event.data as string) as TerminalWebSocketMessage;
        } catch {
          if (typeof event.data === 'string') {
            term.write(event.data);
          }
          return;
        }

        switch (payload.type) {
          case 'ready':
            setStatus('connected');
            setStatusMessage('容器 PTY 已连接');
            updateConnectionSnapshot(
              'pty_ready',
              'container_pty',
              '容器 PTY 已连接，终端输入会发送到当前项目容器。',
              '如命令无响应，请优先检查命令本身或容器内进程状态。',
            );
            term.focus();
            void resizeSession(term.rows, term.cols);
            break;
          case 'output':
            if (payload.data) {
              term.write(payload.data);
            }
            break;
          case 'closed':
            if (socketRef.current === socket) {
              socketRef.current = null;
            }
            setStatus('closed');
            setStatusMessage(payload.closeReason || '会话已关闭');
            updateConnectionSnapshot(
              'remote_closed',
              'container_pty',
              payload.closeReason || '终端会话已由远端关闭。',
              '可点击重新连接建立新的容器 PTY 会话。',
            );
            writeSystemLine(payload.closeReason || '终端会话已关闭');
            break;
          case 'error':
            if (payload.message) {
              setStatus('error');
              setStatusMessage(payload.message);
              updateConnectionSnapshot(
                'error',
                'container_pty',
                `终端连接失败：${payload.message}`,
                '请检查 runtime 健康状态、容器 PTY 服务或重新连接终端。',
              );
              writeSystemLine(`终端连接失败：${payload.message}`);
            }
            break;
          case 'pong':
            break;
          default:
            break;
        }
      };

      socket.onerror = () => {
        const reason = formatTerminalWebSocketState('WebSocket 握手失败或连接异常', 'browser WebSocket onerror fired');
        setStatus('error');
        setStatusMessage(reason);
        updateConnectionSnapshot(
          'error',
          'terminal_websocket',
          reason,
          '请重新连接终端；如果持续失败，请检查浏览器 WebSocket、代理和后端终端网关。',
        );
        writeSystemLine(`终端连接失败：${reason}`);
      };

      socket.onclose = (event) => {
        if (socketRef.current === socket) {
          socketRef.current = null;
        }
        if (closingRef.current) {
          return;
        }
        if (statusRef.current === 'error') {
          return;
        }
        setStatus('closed');
        setStatusMessage(event.reason || '终端连接已关闭');
        updateConnectionSnapshot(
          'remote_closed',
          'terminal_websocket',
          event.reason || '终端 WebSocket 已关闭。',
          '可点击重新连接建立新的容器 PTY 会话。',
        );
        writeSystemLine(event.reason ? `终端连接已关闭：${event.reason}` : '终端连接已关闭');
      };
    } catch (error) {
      const reason = formatTerminalWebSocketError(error, '终端连接失败');
      setStatus('error');
      setStatusMessage(reason);
      updateConnectionSnapshot(
        'error',
        'terminal_ticket',
        reason,
        '请重新连接终端；如果持续失败，请检查 ws-ticket 代理、后端终端服务和 runtime 状态。',
      );
      writeSystemLine(`终端连接失败：${reason}`);
    } finally {
      isStartingRef.current = false;
    }
  }, [closeSession, getTerminalWebSocketUrl, projectId, resizeSession, updateConnectionSnapshot, writeSystemLine]);

  useEffect(() => {
    if (!hostRef.current || xtermRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.3,
      scrollback: 5000,
      theme: TERMINAL_THEMES.dark,
    });
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    term.open(hostRef.current);
    fitAddon.fit();
    term.focus();

    const dataDisposable = term.onData((data) => {
      queueInput(data);
    });
    const resizeDisposable = term.onResize(({ rows, cols }) => {
      void resizeSession(rows, cols);
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(hostRef.current);

    xtermRef.current = term;

    return () => {
      resizeObserver.disconnect();
      dataDisposable.dispose();
      resizeDisposable.dispose();
      socketRef.current?.close(1000, 'terminal disposed');
      term.dispose();
      fitAddonRef.current = null;
      xtermRef.current = null;
    };
  }, [queueInput, resizeSession]);

  useEffect(() => {
    closingRef.current = false;

    if (!projectId) {
      lastProjectIdRef.current = null;
      setStatus('idle');
      setStatusMessage('请选择项目');
      updateConnectionSnapshot(
        'idle',
        'workspace_project',
        '当前没有可连接的项目。',
        '请先进入一个已绑定的 Workspace 项目，再打开终端。',
      );
      xtermRef.current?.reset();
      writeSystemLine('当前没有可连接的项目。');
      return;
    }

    if (!xtermRef.current) {
      return;
    }

    const projectChanged = lastProjectIdRef.current !== null && lastProjectIdRef.current !== projectId;
    if (projectChanged) {
      closingRef.current = true;
      closeSession('项目已切换，终端已断开。');
      updateConnectionSnapshot(
        'manual_closed',
        'workspace_project',
        '项目已切换，旧终端会话已断开。',
        '新项目终端会在面板激活后重新连接。',
      );
    }
    lastProjectIdRef.current = projectId;

    return () => {
      if (!projectId || lastProjectIdRef.current !== projectId) {
        closingRef.current = true;
        closeSession('终端已断开。');
      }
    };
  }, [closeSession, projectId, updateConnectionSnapshot, writeSystemLine]);

  useEffect(() => {
    if (!active || !projectId || !xtermRef.current) {
      return;
    }
    if (socketRef.current || isStartingRef.current || statusRef.current === 'connected' || statusRef.current === 'connecting') {
      return;
    }
    void startSession();
  }, [active, projectId, startSession]);

  useEffect(() => {
    return () => {
      if (inputFlushTimerRef.current !== null) {
        window.clearTimeout(inputFlushTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }
    xtermRef.current?.focus();
    window.setTimeout(() => {
      try {
        fitAddonRef.current?.fit();
      } catch {
        // Ignore transient layout errors while the terminal tab becomes visible.
      }
    }, 0);
  }, [active]);

  useEffect(() => {
    const term = xtermRef.current;
    if (!term) {
      return;
    }
    term.options.theme = TERMINAL_THEMES[themeMode];
  }, [themeMode]);

  return (
    <div className={`h-full flex flex-col ${themeMode === 'dark' ? 'bg-[#1e1e1e] text-[#d4d4d4]' : 'bg-slate-50 text-slate-900'}`}>
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs">
        <div className="flex items-center gap-3">
          <span className={`font-medium ${themeMode === 'dark' ? 'text-white' : 'text-slate-900'}`}>容器终端</span>
          <span
            role={status === 'error' ? 'alert' : 'status'}
            className={
              status === 'connected'
                ? 'text-emerald-400'
                : status === 'connecting'
                  ? 'text-amber-400'
                  : status === 'error'
                    ? 'text-red-400'
                    : 'text-zinc-400'
            }
          >
            {statusMessage}
          </span>
          <span className={themeMode === 'dark' ? 'text-zinc-500' : 'text-slate-500'}>
            Phase: {connectionSnapshot.status}
          </span>
          <span className={themeMode === 'dark' ? 'text-zinc-500' : 'text-slate-500'}>
            Source: {connectionSnapshot.source}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`rounded border px-2 py-1 transition-colors ${themeMode === 'dark' ? 'border-white/10 text-zinc-200 hover:bg-white/10' : 'border-slate-200 text-slate-700 hover:bg-slate-100'}`}
            onClick={() => setThemeMode((current) => current === 'dark' ? 'light' : 'dark')}
          >
            {themeMode === 'dark' ? '浅色主题' : '深色主题'}
          </button>
          <button
            type="button"
            className={`rounded border px-2 py-1 transition-colors ${themeMode === 'dark' ? 'border-white/10 text-zinc-200 hover:bg-white/10' : 'border-slate-200 text-slate-700 hover:bg-slate-100'}`}
            onClick={() => void startSession()}
            disabled={canStartTerminalSession === false}
          >
            {status === 'connected' ? '重启终端' : '重新连接'}
          </button>
          <button
            type="button"
            className={`rounded border px-2 py-1 transition-colors ${themeMode === 'dark' ? 'border-white/10 text-zinc-200 hover:bg-white/10 disabled:opacity-50' : 'border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-50'}`}
            onClick={() => setIsTerminalCloseConfirmationOpen(true)}
            disabled={canCloseTerminalSession === false}
          >
            关闭终端
          </button>
        </div>
      </div>
      {(status === 'error' || status === 'closed') && (
        <div
          role={status === 'error' ? 'alert' : 'status'}
          className={`flex items-center justify-between border-b px-3 py-2 text-xs ${themeMode === 'dark' ? 'border-white/10 bg-white/5 text-zinc-300' : 'border-slate-200 bg-slate-100 text-slate-700'}`}
        >
          <span>
            {status === 'error'
              ? `${statusMessage}。可直接重新连接或关闭当前终端。`
              : '终端当前未连接，可重新启动终端会话。'}
            <span className="ml-2 opacity-80">
              {connectionSnapshot.recovery}
            </span>
          </span>
          <button
            type="button"
            className={`rounded border px-2 py-1 transition-colors ${themeMode === 'dark' ? 'border-white/10 text-zinc-100 hover:bg-white/10' : 'border-slate-300 text-slate-800 hover:bg-slate-200'}`}
            onClick={() => void startSession()}
            disabled={canStartTerminalSession === false}
          >
            重新启动终端
          </button>
        </div>
      )}
      <div
        role="status"
        aria-live="polite"
        data-testid="workspace-terminal-panel-snapshot"
        className={`border-b px-3 py-2 text-xs ${themeMode === 'dark' ? 'border-white/10 bg-black/30 text-zinc-300' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium">终端面板快照</span>
          <span>Phase: {terminalPanelSnapshot.status}</span>
          <span>Source: {terminalPanelSnapshot.source}</span>
          <span>Project: {terminalPanelHasProjectLabel}</span>
          <span>Active: {terminalPanelIsActiveLabel}</span>
          <span>Mounted: {terminalPanelMountedLabel}</span>
          <span>Socket: {terminalPanelSocketReadyLabel}</span>
          <span>Reconnect: {terminalPanelCanReconnectLabel}</span>
          <span>Close: {terminalPanelCanCloseLabel}</span>
          <span>Theme: {terminalPanelSnapshot.theme}</span>
          <span>Banner: {terminalPanelHasErrorBannerLabel}</span>
        </div>
        <p className="mt-1">{terminalPanelSnapshot.message}</p>
        <p className="mt-1 opacity-80">恢复建议：{terminalPanelSnapshot.recovery}</p>
        <p className="mt-1 opacity-60">Updated: {terminalPanelSnapshot.updatedAt}</p>
      </div>
      <div
        role="status"
        aria-live="polite"
        data-testid="workspace-terminal-connection-snapshot"
        className={`border-b px-3 py-2 text-xs ${themeMode === 'dark' ? 'border-white/10 bg-black/20 text-zinc-400' : 'border-slate-200 bg-white text-slate-600'}`}
      >
        <span className="font-medium">终端连接状态：</span>
        <span>{connectionSnapshot.message}</span>
        <span className="ml-2 opacity-75">恢复建议：{connectionSnapshot.recovery}</span>
        <span className="ml-2 opacity-60">Updated: {connectionSnapshot.updatedAt}</span>
      </div>
      <div ref={hostRef} className="min-h-0 flex-1 px-2 py-2" />
      <AlertDialog
        open={isTerminalCloseConfirmationOpen}
        onOpenChange={(open) => {
          if (open === false && isTerminalCloseConfirming === true) {
            return;
          }
          setIsTerminalCloseConfirmationOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认关闭终端</AlertDialogTitle>
            <AlertDialogDescription>
              确认关闭当前容器 PTY 会话？该操作会断开当前 Terminal WebSocket，并清空尚未发送完成的本地输入 buffer；重新连接会建立新的终端会话。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <TerminalCloseConfirmationSnapshotStrip snapshot={terminalCloseConfirmationSnapshot} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={terminalCloseConfirmationSnapshot.canCancel === false}>取消</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={terminalCloseConfirmationSnapshot.canConfirm === false}
              onClick={() => {
                if (terminalCloseConfirmationSnapshot.canConfirm === true) {
                  handleManualClose();
                }
              }}
            >
              {isTerminalCloseConfirming ? '关闭中...' : '确认关闭'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
