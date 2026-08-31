export type ProjectListApiHealthStatus =
  | 'auth_loading'
  | 'unauthenticated'
  | 'syncing'
  | 'backend_unreachable'
  | 'proxy_error'
  | 'auth_required'
  | 'api_error'
  | 'empty'
  | 'ready';

export type ProjectListApiHealthSource =
  | 'auth'
  | 'project_list_api'
  | 'next_api_proxy'
  | 'backend_api'
  | 'project_list_state';

export type ProjectListApiHealthReasonCode = string;
export type ProjectListApiHealthDetails = string;
export type ProjectListApiHealthFailureSource = ProjectListApiHealthSource | string;

export type ProjectListApiHealthFailure = {
  message: ProjectListApiHealthDetails;
  source: ProjectListApiHealthFailureSource;
  details: ProjectListApiHealthDetails;
  reasonCode: ProjectListApiHealthReasonCode;
  httpStatus: number;
};

export type ProjectListApiHealth = {
  status: ProjectListApiHealthStatus;
  source: ProjectListApiHealthSource;
  reasonCode: ProjectListApiHealthReasonCode;
  details: ProjectListApiHealthDetails;
  message: ProjectListApiHealthDetails;
  recovery: ProjectListApiHealthDetails;
};

export type ProjectListAuthRecoveryStatus =
  | 'waiting_auth'
  | 'login_required'
  | 'backend_auth_required'
  | 'ready'
  | 'not_required';

export type ProjectListAuthRecoverySource = 'auth' | 'backend_api' | 'project_list_state';

export type ProjectListAuthRecoveryReasonCode = ProjectListApiHealthReasonCode;
export type ProjectListAuthRecoveryDetails = ProjectListApiHealthDetails;

export type ProjectListAuthRecovery = {
  status: ProjectListAuthRecoveryStatus;
  source: ProjectListAuthRecoverySource;
  reasonCode: ProjectListAuthRecoveryReasonCode;
  details: ProjectListAuthRecoveryDetails;
  canLogin: boolean;
  canRetryList: boolean;
  message: ProjectListAuthRecoveryDetails;
  recovery: ProjectListAuthRecoveryDetails;
};

export type ProjectListBackendHealthProbeStatus =
  | 'not_checked'
  | 'checking'
  | 'ready'
  | 'backend_unreachable'
  | 'proxy_error'
  | 'unhealthy';

export type ProjectListBackendHealthProbeSource =
  | 'project_list_backend_health_probe'
  | 'next_api_proxy'
  | 'backend_health_api';

export type ProjectListBackendHealthProbeReasonCode = ProjectListApiHealthReasonCode;
export type ProjectListBackendHealthProbeDetails = ProjectListApiHealthDetails;
export type ProjectListBackendHealthProbeService = string;
export type ProjectListBackendHealthProbeBackendStatus = string;
export type ProjectListBackendHealthReadyStatus = ProjectListBackendHealthProbeBackendStatus;
export type ProjectListBackendHealthReadyStatusList = readonly ProjectListBackendHealthReadyStatus[];

export const PROJECT_LIST_BACKEND_HEALTH_READY_STATUSES: ProjectListBackendHealthReadyStatusList = ['healthy', 'ok', 'ready'];

type ProjectListApiHealthBooleanFactList = readonly boolean[];
type ProjectListApiHealthTextFragment = string;
type ProjectListApiHealthTextFragmentList = readonly ProjectListApiHealthTextFragment[];
type ProjectListApiHealthStatusList = readonly ProjectListApiHealthStatus[];
type ProjectListApiHealthReasonCodeList = readonly ProjectListApiHealthReasonCode[];
type ProjectListApiHealthFailureSourceList = readonly ProjectListApiHealthFailureSource[];

const PROJECT_LIST_BACKEND_UNREACHABLE_TEXT_FRAGMENTS: ProjectListApiHealthTextFragmentList = [
  'backend_unreachable',
  'backend is unreachable',
  'verify the go backend is running',
  'fetch failed',
  'econnrefused',
  'connection refused',
];

const PROJECT_LIST_API_AUTH_MISSING_TEXT_FRAGMENTS: ProjectListApiHealthTextFragmentList = [
  'missing authorization header',
];

const PROJECT_LIST_API_READY_AUTH_RECOVERY_STATUSES: ProjectListApiHealthStatusList = [
  'ready',
  'empty',
];

const PROJECT_LIST_API_PROXY_FAILURE_REASON_CODES: ProjectListApiHealthReasonCodeList = [
  'proxy_error',
];

const PROJECT_LIST_API_AUTH_REQUIRED_REASON_CODES: ProjectListApiHealthReasonCodeList = [
  'auth_required',
];

const PROJECT_LIST_API_PROXY_FAILURE_SOURCES: ProjectListApiHealthFailureSourceList = [
  'next_api_proxy',
];

export type ProjectListBackendHealthProbe = {
  status: ProjectListBackendHealthProbeStatus;
  source: ProjectListBackendHealthProbeSource;
  reasonCode: ProjectListBackendHealthProbeReasonCode;
  details: ProjectListBackendHealthProbeDetails;
  service: ProjectListBackendHealthProbeService;
  backendStatus: ProjectListBackendHealthProbeBackendStatus;
  recovery: ProjectListBackendHealthProbeDetails;
};

export type ProjectListBackendHealthProbeResult = {
  service?: ProjectListBackendHealthProbeService;
  status?: ProjectListBackendHealthProbeBackendStatus;
};

export type ProjectListSyncFailureDiagnosisStatus =
  | 'auth_waiting'
  | 'auth_required'
  | 'backend_unreachable'
  | 'proxy_error'
  | 'backend_unhealthy'
  | 'api_error'
  | 'backend_checking'
  | 'backend_not_checked'
  | 'unknown';

export type ProjectListSyncFailureDiagnosisSource =
  | 'auth'
  | 'project_list_api'
  | 'project_list_state'
  | 'next_api_proxy'
  | 'backend_health_api'
  | 'backend_api'
  | 'project_list_backend_health_probe'
  | 'project_list_diagnosis';

export type ProjectListSyncFailureDiagnosisAction =
  | 'wait_auth'
  | 'login'
  | 'start_backend'
  | 'check_proxy'
  | 'fix_backend_health'
  | 'inspect_api_error'
  | 'wait_backend_probe'
  | 'probe_backend_health'
  | 'retry_project_list';

export type ProjectListSyncFailureDiagnosis = {
  status: ProjectListSyncFailureDiagnosisStatus;
  source: ProjectListSyncFailureDiagnosisSource;
  action: ProjectListSyncFailureDiagnosisAction;
  reasonCode: ProjectListApiHealthReasonCode;
  summary: ProjectListApiHealthDetails;
  nextAction: ProjectListApiHealthDetails;
  evidence: ProjectListApiHealthDetails;
  canLoginRecovery: boolean;
  canRetryProjectList: boolean;
  canProbeBackendHealth: boolean;
};

export type ProjectListSyncFailureDiagnosisInput = {
  apiHealthStatus: ProjectListApiHealthStatus;
  apiHealthSource: ProjectListApiHealthSource;
  apiHealthReasonCode: ProjectListApiHealthReasonCode;
  apiHealthDetails: ProjectListApiHealthDetails;
  authRecoveryStatus: ProjectListAuthRecoveryStatus;
  authRecoveryReasonCode: ProjectListAuthRecoveryReasonCode;
  authRecoveryDetails: ProjectListAuthRecoveryDetails;
  canLoginRecovery: boolean;
  canRetryProjectListAfterAuth: boolean;
  backendHealthStatus: ProjectListBackendHealthProbeStatus;
  backendHealthSource: ProjectListBackendHealthProbeSource;
  backendHealthReasonCode: ProjectListBackendHealthProbeReasonCode;
  backendHealthDetails: ProjectListBackendHealthProbeDetails;
};

type ProjectListApiErrorLike = {
  message?: unknown;
  source?: unknown;
  details?: unknown;
  reasonCode?: unknown;
  code?: unknown;
};

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function hasProjectListApiHealthValue(value: ProjectListApiHealthDetails): boolean {
  const hasValue = value.length > 0;
  return hasValue === true;
}

function getProjectListApiHealthFallbackValue(
  value: ProjectListApiHealthDetails,
  fallback: ProjectListApiHealthDetails,
): ProjectListApiHealthDetails {
  const hasValue = hasProjectListApiHealthValue(value);
  if (hasValue === false) {
    return fallback;
  }

  return value;
}

function getProjectListApiHealthFailureSource(value: string): ProjectListApiHealthFailureSource {
  return getProjectListApiHealthFallbackValue(value, 'project_list_api');
}

function getProjectListApiHealthFailureReasonCode({
  explicitReasonCode,
  source,
  message,
  details,
  httpStatus,
}: {
  explicitReasonCode: ProjectListApiHealthReasonCode;
  source: ProjectListApiHealthFailureSource;
  message: ProjectListApiHealthDetails;
  details: ProjectListApiHealthDetails;
  httpStatus: number;
}): ProjectListApiHealthReasonCode {
  const hasExplicitReasonCode = hasProjectListApiHealthValue(explicitReasonCode);
  if (hasExplicitReasonCode === true) {
    return explicitReasonCode;
  }

  return inferProjectListApiReasonCode(source, message, details, httpStatus);
}

function getProjectListBackendHealthProbeReasonCode(
  reasonCode: ProjectListBackendHealthProbeReasonCode,
): ProjectListBackendHealthProbeReasonCode {
  return getProjectListApiHealthFallbackValue(reasonCode, 'backend_health_probe_failed');
}

function getProjectListBackendHealthStatusDetails(
  backendStatus: ProjectListBackendHealthProbeBackendStatus,
): ProjectListBackendHealthProbeDetails {
  const backendStatusLabel = getProjectListApiHealthFallbackValue(backendStatus, 'unknown');
  return `Backend /api/health returned status=${backendStatusLabel}.`;
}

function hasProjectListApiHealthTrueFact(values: ProjectListApiHealthBooleanFactList): boolean {
  for (const value of values) {
    const matchedValue = value === true;
    if (matchedValue === true) {
      return true;
    }
  }

  return false;
}

function isProjectListApiHealthTextFragmentMatched(
  haystack: ProjectListApiHealthDetails,
  fragments: ProjectListApiHealthTextFragmentList,
): boolean {
  for (const fragment of fragments) {
    const matchedFragment = haystack.indexOf(fragment) >= 0;
    if (matchedFragment === true) {
      return true;
    }
  }

  return false;
}

function isProjectListApiHealthStatusIn(
  status: ProjectListApiHealthStatus,
  statuses: ProjectListApiHealthStatusList,
): boolean {
  for (const candidate of statuses) {
    const matchedStatus = candidate === status;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function isProjectListApiHealthReasonCodeIn(
  reasonCode: ProjectListApiHealthReasonCode,
  reasonCodes: ProjectListApiHealthReasonCodeList,
): boolean {
  for (const candidate of reasonCodes) {
    const matchedReasonCode = candidate === reasonCode;
    if (matchedReasonCode === true) {
      return true;
    }
  }

  return false;
}

function isProjectListApiHealthFailureSourceIn(
  source: ProjectListApiHealthFailureSource,
  sources: ProjectListApiHealthFailureSourceList,
): boolean {
  for (const candidate of sources) {
    const matchedSource = candidate === source;
    if (matchedSource === true) {
      return true;
    }
  }

  return false;
}

function isProjectListApiHealthNextProxySource(source: ProjectListApiHealthFailureSource): boolean {
  const hasProxySource = source === 'next_api_proxy';
  return hasProxySource === true;
}

function getProjectListBackendHealthProbeFailureStatus(
  failure: ProjectListApiHealthFailure,
): ProjectListBackendHealthProbeStatus {
  const hasProxySource = isProjectListApiHealthNextProxySource(failure.source);
  if (hasProxySource === true) {
    return 'proxy_error';
  }

  return 'unhealthy';
}

function getProjectListBackendHealthProbeFailureSource(
  failure: ProjectListApiHealthFailure,
): ProjectListBackendHealthProbeSource {
  const hasProxySource = isProjectListApiHealthNextProxySource(failure.source);
  if (hasProxySource === true) {
    return 'next_api_proxy';
  }

  return 'backend_health_api';
}

function getProjectListApiHealthFailureApiErrorSource(
  failure: ProjectListApiHealthFailure,
): ProjectListApiHealthSource {
  const hasProjectListApiSource = failure.source === 'project_list_api';
  if (hasProjectListApiSource === true) {
    return 'project_list_api';
  }

  return 'backend_api';
}

function canRetryProjectListAfterBackendAuthRecovery(backendHealth: ProjectListBackendHealthProbe): boolean {
  const hasReadyBackendHealth = backendHealth.status === 'ready';
  return hasReadyBackendHealth === true;
}

function getProjectListBackendAuthRecoveryText(canRetryList: boolean): ProjectListAuthRecoveryDetails {
  if (canRetryList === true) {
    return '后端健康已确认；重新登录后刷新项目列表即可复核授权头。';
  }

  return '先重新登录；若仍失败，再用后端健康检查确认代理到 Go 后端可达。';
}

function canProbeProjectListBackendHealth(status: ProjectListBackendHealthProbeStatus): boolean {
  if (status === 'checking') {
    return false;
  }

  return true;
}

function getProjectListSyncFailureEvidence({
  apiHealthReasonCode,
  apiHealthDetails,
  backendHealthReasonCode,
  backendHealthDetails,
  authRecoveryReasonCode,
  authRecoveryDetails,
}: {
  apiHealthReasonCode: ProjectListApiHealthReasonCode;
  apiHealthDetails: ProjectListApiHealthDetails;
  backendHealthReasonCode: ProjectListBackendHealthProbeReasonCode;
  backendHealthDetails: ProjectListBackendHealthProbeDetails;
  authRecoveryReasonCode: ProjectListAuthRecoveryReasonCode;
  authRecoveryDetails: ProjectListAuthRecoveryDetails;
}): ProjectListApiHealthDetails {
  const apiDetails = getProjectListApiHealthFallbackValue(apiHealthDetails, 'none');
  const backendDetails = getProjectListApiHealthFallbackValue(backendHealthDetails, 'none');
  const authDetails = getProjectListApiHealthFallbackValue(authRecoveryDetails, 'none');
  return `api_reason=${apiHealthReasonCode}; api_details=${apiDetails}; backend_reason=${backendHealthReasonCode}; backend_details=${backendDetails}; auth_reason=${authRecoveryReasonCode}; auth_details=${authDetails}`;
}

function isProjectListApiErrorLike(error: unknown): error is ProjectListApiErrorLike {
  return typeof error === 'object' && error !== null;
}

function isProjectListBackendHealthReadyStatus(
  backendStatus: ProjectListBackendHealthProbeBackendStatus,
): boolean {
  const normalizedStatus = backendStatus.toLowerCase();
  for (const candidate of PROJECT_LIST_BACKEND_HEALTH_READY_STATUSES) {
    const matchedStatus = candidate === normalizedStatus;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function isProjectListBackendUnreachableFailure(
  source: ProjectListApiHealthFailureSource,
  haystack: ProjectListApiHealthDetails,
): boolean {
  const hasProxySource = isProjectListApiHealthNextProxySource(source);
  const hasBackendUnreachableText = isProjectListApiHealthTextFragmentMatched(
    haystack,
    PROJECT_LIST_BACKEND_UNREACHABLE_TEXT_FRAGMENTS,
  );
  return hasProxySource === true && hasBackendUnreachableText === true;
}

function isProjectListAuthRequiredFailure(
  httpStatus: number,
  haystack: ProjectListApiHealthDetails,
): boolean {
  const hasAuthStatus = httpStatus === 401;
  const hasAuthText = isProjectListApiHealthTextFragmentMatched(
    haystack,
    PROJECT_LIST_API_AUTH_MISSING_TEXT_FRAGMENTS,
  );
  return hasProjectListApiHealthTrueFact([hasAuthStatus, hasAuthText]);
}

function isProjectListApiProxyFailure(failure: ProjectListApiHealthFailure): boolean {
  const hasProxyReasonCode = isProjectListApiHealthReasonCodeIn(
    failure.reasonCode,
    PROJECT_LIST_API_PROXY_FAILURE_REASON_CODES,
  );
  const hasProxySource = isProjectListApiHealthFailureSourceIn(
    failure.source,
    PROJECT_LIST_API_PROXY_FAILURE_SOURCES,
  );
  return hasProjectListApiHealthTrueFact([hasProxyReasonCode, hasProxySource]);
}

function isProjectListApiAuthRequiredFailure(failure: ProjectListApiHealthFailure): boolean {
  const hasAuthReasonCode = isProjectListApiHealthReasonCodeIn(
    failure.reasonCode,
    PROJECT_LIST_API_AUTH_REQUIRED_REASON_CODES,
  );
  const hasAuthStatus = failure.httpStatus === 401;
  return hasProjectListApiHealthTrueFact([hasAuthReasonCode, hasAuthStatus]);
}

function inferProjectListApiReasonCode(
  source: ProjectListApiHealthFailureSource,
  message: ProjectListApiHealthDetails,
  details: ProjectListApiHealthDetails,
  httpStatus: number,
): ProjectListApiHealthReasonCode {
  const haystack = `${message}\n${details}`.toLowerCase();
  const hasBackendUnreachableFailure = isProjectListBackendUnreachableFailure(source, haystack);

  if (hasBackendUnreachableFailure === true) {
    return 'backend_unreachable';
  }

  const hasProxySource = isProjectListApiHealthNextProxySource(source);
  if (hasProxySource === true) {
    return 'proxy_error';
  }

  const hasAuthRequiredFailure = isProjectListAuthRequiredFailure(httpStatus, haystack);
  if (hasAuthRequiredFailure === true) {
    return 'auth_required';
  }

  return 'api_error';
}

export function buildProjectListApiHealthFailure(error: unknown): ProjectListApiHealthFailure {
  const hasApiErrorObject = isProjectListApiErrorLike(error);
  if (hasApiErrorObject === false) {
    return {
      message: '项目列表请求失败',
      source: 'project_list_api',
      details: '',
      reasonCode: 'api_error',
      httpStatus: 0,
    };
  }

  const message = getProjectListApiHealthFallbackValue(readString(error.message), '项目列表请求失败');
  const source = getProjectListApiHealthFailureSource(readString(error.source));
  const details = readString(error.details);
  const httpStatus = readNumber(error.code);
  const explicitReasonCode = readString(error.reasonCode);
  const reasonCode = getProjectListApiHealthFailureReasonCode({
    explicitReasonCode,
    source,
    message,
    details,
    httpStatus,
  });

  return {
    message,
    source,
    details,
    reasonCode,
    httpStatus,
  };
}

export function buildProjectListAuthRecovery({
  apiHealth,
  backendHealth,
}: {
  apiHealth: ProjectListApiHealth;
  backendHealth: ProjectListBackendHealthProbe;
}): ProjectListAuthRecovery {
  if (apiHealth.status === 'auth_loading') {
    return {
      status: 'waiting_auth',
      source: 'auth',
      reasonCode: 'auth_loading',
      details: apiHealth.details,
      canLogin: false,
      canRetryList: false,
      message: '项目列表正在等待浏览器鉴权状态。',
      recovery: '等待 Auth Provider 返回当前登录态后再同步项目列表。',
    };
  }

  if (apiHealth.status === 'unauthenticated') {
    return {
      status: 'login_required',
      source: 'auth',
      reasonCode: 'auth_required',
      details: apiHealth.details,
      canLogin: true,
      canRetryList: false,
      message: '当前浏览器没有可用登录态，项目列表不会请求后端。',
      recovery: '进入登录页完成认证后回到 /projects。',
    };
  }

  if (apiHealth.status === 'auth_required') {
    const canRetryList = canRetryProjectListAfterBackendAuthRecovery(backendHealth);
    const recovery = getProjectListBackendAuthRecoveryText(canRetryList);
    return {
      status: 'backend_auth_required',
      source: 'backend_api',
      reasonCode: apiHealth.reasonCode,
      details: apiHealth.details,
      canLogin: true,
      canRetryList,
      message: '项目列表请求已到达后端，但后端拒绝当前授权。',
      recovery,
    };
  }

  const hasReadyAuthRecoveryStatus = isProjectListApiHealthStatusIn(
    apiHealth.status,
    PROJECT_LIST_API_READY_AUTH_RECOVERY_STATUSES,
  );
  if (hasReadyAuthRecoveryStatus === true) {
    return {
      status: 'ready',
      source: 'project_list_state',
      reasonCode: 'auth_ready',
      details: 'Project list authentication is sufficient for the current backend response.',
      canLogin: false,
      canRetryList: true,
      message: '项目列表鉴权已满足当前后端响应。',
      recovery: '按需刷新项目列表即可复核最新项目真源。',
    };
  }

  return {
    status: 'not_required',
    source: 'project_list_state',
    reasonCode: 'auth_recovery_not_required',
    details: 'The current project list state is not an authentication recovery case.',
    canLogin: false,
    canRetryList: false,
    message: '当前项目列表状态不属于鉴权恢复场景。',
    recovery: '继续查看 ApiHealth、BackendHealth 和同步失败详情。',
  };
}

export function buildProjectListBackendHealthProbe({
  isChecking,
  result,
  failure,
}: {
  isChecking: boolean;
  result: ProjectListBackendHealthProbeResult | null;
  failure: ProjectListApiHealthFailure | null;
}): ProjectListBackendHealthProbe {
  if (isChecking === true) {
    return {
      status: 'checking',
      source: 'project_list_backend_health_probe',
      reasonCode: 'checking_backend_health',
      details: 'The project list page is probing /api/health through the Next.js proxy.',
      service: '',
      backendStatus: '',
      recovery: '等待 /api/health 只读探测完成。',
    };
  }

  if (failure !== null) {
    if (failure.reasonCode === 'backend_unreachable') {
      const failureDetails = getProjectListApiHealthFallbackValue(failure.details, failure.message);
      return {
        status: 'backend_unreachable',
        source: 'next_api_proxy',
        reasonCode: failure.reasonCode,
        details: failureDetails,
        service: '',
        backendStatus: '',
        recovery: '启动或重启 Go 后端，并确认 Next 代理能访问 BACKEND_URL 指向的 /api/health。',
      };
    }

    const failureDetails = getProjectListApiHealthFallbackValue(failure.details, failure.message);
    const status = getProjectListBackendHealthProbeFailureStatus(failure);
    const source = getProjectListBackendHealthProbeFailureSource(failure);
    return {
      status,
      source,
      reasonCode: getProjectListBackendHealthProbeReasonCode(failure.reasonCode),
      details: failureDetails,
      service: '',
      backendStatus: '',
      recovery: '检查 Next 代理、BACKEND_URL 和 Go 后端 /api/health 响应格式后重试。',
    };
  }

  if (result === null) {
    return {
      status: 'not_checked',
      source: 'project_list_backend_health_probe',
      reasonCode: 'not_checked',
      details: 'The project list page has not probed /api/health yet.',
      service: '',
      backendStatus: '',
      recovery: '点击后端健康检查，或重新加载项目列表触发只读探测。',
    };
  }

  const service = readString(result.service);
  const backendStatus = readString(result.status);
  const healthy = isProjectListBackendHealthReadyStatus(backendStatus);

  if (healthy === false) {
    return {
      status: 'unhealthy',
      source: 'backend_health_api',
      reasonCode: 'backend_health_unhealthy',
      details: getProjectListBackendHealthStatusDetails(backendStatus),
      service,
      backendStatus,
      recovery: '检查 Go 后端启动日志、数据库连接和健康检查依赖后重试项目列表同步。',
    };
  }

  return {
    status: 'ready',
    source: 'backend_health_api',
    reasonCode: 'backend_health_ready',
    details: `Backend /api/health is reachable and returned status=${backendStatus}.`,
    service,
    backendStatus,
    recovery: '后端健康探测已确认可达；如项目列表仍失败，请继续查看 ApiHealth 和后端鉴权状态。',
  };
}

export function buildProjectListApiHealth({
  isAuthenticated,
  authLoading,
  isLoading,
  projectCount,
  failure,
}: {
  isAuthenticated: boolean;
  authLoading: boolean;
  isLoading: boolean;
  projectCount: number;
  failure: ProjectListApiHealthFailure | null;
}): ProjectListApiHealth {
  if (authLoading === true) {
    return {
      status: 'auth_loading',
      source: 'auth',
      reasonCode: 'auth_loading',
      details: 'Auth Provider has not returned the current login state yet.',
      message: '项目列表 API 等待鉴权状态，尚未发起列表同步。',
      recovery: '等待鉴权完成后自动同步项目列表。',
    };
  }

  if (isAuthenticated === false) {
    return {
      status: 'unauthenticated',
      source: 'auth',
      reasonCode: 'auth_required',
      details: 'No authenticated user is available for /api/project/list.',
      message: '项目列表 API 需要登录态，当前不会请求后端列表。',
      recovery: '登录后重新进入项目列表。',
    };
  }

  if (failure !== null) {
    const failureDetails = getProjectListApiHealthFallbackValue(failure.details, failure.message);
    if (failure.reasonCode === 'backend_unreachable') {
      return {
        status: 'backend_unreachable',
        source: 'next_api_proxy',
        reasonCode: failure.reasonCode,
        details: failureDetails,
        message: '项目列表 API 已确认 Next 代理无法连接 Go 后端。',
        recovery: '启动或重启 Go 后端，并先确认 /api/health 可访问，再重新加载项目列表。',
      };
    }

    const hasProxyFailure = isProjectListApiProxyFailure(failure);
    if (hasProxyFailure === true) {
      return {
        status: 'proxy_error',
        source: 'next_api_proxy',
        reasonCode: failure.reasonCode,
        details: failureDetails,
        message: '项目列表 API 在 Next 代理层失败，后端列表真源未确认。',
        recovery: '检查 Next 代理日志、BACKEND_URL 与后端响应格式后重新加载。',
      };
    }

    const hasAuthRequiredFailure = isProjectListApiAuthRequiredFailure(failure);
    if (hasAuthRequiredFailure === true) {
      return {
        status: 'auth_required',
        source: 'backend_api',
        reasonCode: failure.reasonCode,
        details: failureDetails,
        message: '项目列表 API 已到达后端，但后端要求重新登录或补充授权头。',
        recovery: '重新登录后刷新项目列表，确认浏览器 yistack_token 可被读取。',
      };
    }

    const source = getProjectListApiHealthFailureApiErrorSource(failure);
    return {
      status: 'api_error',
      source,
      reasonCode: failure.reasonCode,
      details: failureDetails,
      message: '项目列表 API 返回业务或协议错误，当前列表真源未确认。',
      recovery: '根据错误来源修复后端业务、响应协议或登录态后重新加载。',
    };
  }

  if (isLoading === true) {
    return {
      status: 'syncing',
      source: 'project_list_api',
      reasonCode: 'syncing',
      details: 'The project list request is in flight.',
      message: '项目列表 API 正在同步，列表真源尚未返回。',
      recovery: '等待请求完成；如长时间无响应，再检查代理和后端健康。',
    };
  }

  if (projectCount === 0) {
    return {
      status: 'empty',
      source: 'project_list_state',
      reasonCode: 'empty_list',
      details: 'The backend list request completed with zero projects.',
      message: '项目列表 API 已完成同步，当前用户暂无项目。',
      recovery: '返回首页创建项目，或确认当前登录账号是否正确。',
    };
  }

  return {
    status: 'ready',
    source: 'project_list_api',
    reasonCode: 'synced',
    details: 'The project list request completed and returned project records.',
    message: '项目列表 API 已同步，当前卡片来自后端列表真源。',
    recovery: '可打开项目或按需刷新列表确认最新状态。',
  };
}

export function buildProjectListSyncFailureDiagnosis({
  apiHealthStatus,
  apiHealthSource,
  apiHealthReasonCode,
  apiHealthDetails,
  authRecoveryStatus,
  authRecoveryReasonCode,
  authRecoveryDetails,
  canLoginRecovery,
  canRetryProjectListAfterAuth,
  backendHealthStatus,
  backendHealthSource,
  backendHealthReasonCode,
  backendHealthDetails,
}: ProjectListSyncFailureDiagnosisInput): ProjectListSyncFailureDiagnosis {
  const canProbeBackendHealth = canProbeProjectListBackendHealth(backendHealthStatus);
  const evidence = getProjectListSyncFailureEvidence({
    apiHealthReasonCode,
    apiHealthDetails,
    backendHealthReasonCode,
    backendHealthDetails,
    authRecoveryReasonCode,
    authRecoveryDetails,
  });

  if (authRecoveryStatus === 'waiting_auth') {
    return {
      status: 'auth_waiting',
      source: 'auth',
      action: 'wait_auth',
      reasonCode: authRecoveryReasonCode,
      summary: '项目列表正在等待浏览器鉴权状态返回。',
      nextAction: '等待 Auth Provider 完成登录态读取后再同步项目列表。',
      evidence,
      canLoginRecovery,
      canRetryProjectList: false,
      canProbeBackendHealth,
    };
  }

  if (authRecoveryStatus === 'login_required') {
    return {
      status: 'auth_required',
      source: 'auth',
      action: 'login',
      reasonCode: authRecoveryReasonCode,
      summary: '当前浏览器没有可用登录态，项目列表不会请求后端。',
      nextAction: '重新登录后返回项目列表。',
      evidence,
      canLoginRecovery,
      canRetryProjectList: false,
      canProbeBackendHealth,
    };
  }

  if (authRecoveryStatus === 'backend_auth_required') {
    return {
      status: 'auth_required',
      source: 'project_list_api',
      action: 'login',
      reasonCode: authRecoveryReasonCode,
      summary: '项目列表请求已到达后端，但后端拒绝当前授权。',
      nextAction: '重新登录后刷新项目列表；若仍失败，再检查授权头是否被 Next 代理转发。',
      evidence,
      canLoginRecovery,
      canRetryProjectList: canRetryProjectListAfterAuth,
      canProbeBackendHealth,
    };
  }

  if (apiHealthStatus === 'backend_unreachable') {
    return {
      status: 'backend_unreachable',
      source: 'next_api_proxy',
      action: 'start_backend',
      reasonCode: apiHealthReasonCode,
      summary: 'Next 代理无法连接 Go 后端，项目列表真源未返回。',
      nextAction: '启动或重启 Go 后端，先用后端健康检查确认 /api/health 可达，再重新加载项目列表。',
      evidence,
      canLoginRecovery,
      canRetryProjectList: false,
      canProbeBackendHealth,
    };
  }

  if (backendHealthStatus === 'backend_unreachable') {
    return {
      status: 'backend_unreachable',
      source: 'next_api_proxy',
      action: 'start_backend',
      reasonCode: backendHealthReasonCode,
      summary: '后端健康探测确认 Next 代理无法连接 Go 后端。',
      nextAction: '启动或重启 Go 后端，并确认 BACKEND_URL 指向的 /api/health 可访问。',
      evidence,
      canLoginRecovery,
      canRetryProjectList: false,
      canProbeBackendHealth,
    };
  }

  if (apiHealthStatus === 'proxy_error') {
    return {
      status: 'proxy_error',
      source: 'next_api_proxy',
      action: 'check_proxy',
      reasonCode: apiHealthReasonCode,
      summary: '项目列表在 Next 代理层失败，后端列表真源未确认。',
      nextAction: '检查 Next API route、BACKEND_URL 和 Go 后端响应格式后重新加载。',
      evidence,
      canLoginRecovery,
      canRetryProjectList: false,
      canProbeBackendHealth,
    };
  }

  if (backendHealthStatus === 'proxy_error') {
    return {
      status: 'proxy_error',
      source: 'next_api_proxy',
      action: 'check_proxy',
      reasonCode: backendHealthReasonCode,
      summary: '后端健康检查在 Next 代理层失败。',
      nextAction: '检查 Next 代理日志和 BACKEND_URL 后重试后端健康检查。',
      evidence,
      canLoginRecovery,
      canRetryProjectList: false,
      canProbeBackendHealth,
    };
  }

  if (backendHealthStatus === 'unhealthy') {
    return {
      status: 'backend_unhealthy',
      source: 'backend_health_api',
      action: 'fix_backend_health',
      reasonCode: backendHealthReasonCode,
      summary: 'Go 后端可达，但健康检查未返回 ready 状态。',
      nextAction: '检查 Go 后端启动日志、数据库连接和健康检查依赖后重试项目列表同步。',
      evidence,
      canLoginRecovery,
      canRetryProjectList: false,
      canProbeBackendHealth,
    };
  }

  if (backendHealthStatus === 'checking') {
    return {
      status: 'backend_checking',
      source: 'project_list_diagnosis',
      action: 'wait_backend_probe',
      reasonCode: backendHealthReasonCode,
      summary: '项目列表失败已出现，后端健康探测仍在进行。',
      nextAction: '等待后端健康探测完成后，再根据 BackendHealth 结果决定重启后端、修复代理或重新登录。',
      evidence,
      canLoginRecovery,
      canRetryProjectList: false,
      canProbeBackendHealth,
    };
  }

  if (apiHealthStatus === 'api_error') {
    return {
      status: 'api_error',
      source: apiHealthSource,
      action: 'inspect_api_error',
      reasonCode: apiHealthReasonCode,
      summary: '项目列表 API 返回业务或协议错误。',
      nextAction: '根据 API 细节修复后端业务、响应协议或账号权限后重新加载。',
      evidence,
      canLoginRecovery,
      canRetryProjectList: true,
      canProbeBackendHealth,
    };
  }

  if (backendHealthStatus === 'not_checked') {
    return {
      status: 'backend_not_checked',
      source: 'project_list_diagnosis',
      action: 'probe_backend_health',
      reasonCode: backendHealthReasonCode,
      summary: '项目列表失败原因未闭环，后端健康尚未探测。',
      nextAction: '先执行后端健康检查，再重新加载项目列表。',
      evidence,
      canLoginRecovery,
      canRetryProjectList: true,
      canProbeBackendHealth,
    };
  }

  return {
    status: 'unknown',
    source: backendHealthSource,
    action: 'retry_project_list',
    reasonCode: apiHealthReasonCode,
    summary: '项目列表同步失败，但当前证据不足以判定唯一主因。',
    nextAction: '重新加载项目列表，并保留 ApiHealth、BackendHealth 与 AuthRecovery 证据用于排查。',
    evidence,
    canLoginRecovery,
    canRetryProjectList: true,
    canProbeBackendHealth,
  };
}
