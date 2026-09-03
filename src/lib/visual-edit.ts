export const VISUAL_EDIT_SCHEMA_VERSION = 'visual_edit.v1' as const;
export const VISUAL_EDIT_QUERY_KEY = '__yistack_visual_edit';

export type VisualEditRectangle = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type VisualEditContext = {
  schema_version: typeof VISUAL_EDIT_SCHEMA_VERSION;
  selection_id: string;
  page_path: string;
  selector: string;
  tag_name: string;
  role?: string;
  accessible_name?: string;
  text_content?: string;
  test_id?: string;
  class_names?: string[];
  rect: VisualEditRectangle;
  computed_styles?: Record<string, string>;
};

export type VisualEditBridgeMessage = {
  type:
    | 'yistack:visual-edit-ready'
    | 'yistack:visual-edit-selection'
    | 'yistack:visual-edit-cancelled';
  schema_version: typeof VISUAL_EDIT_SCHEMA_VERSION;
  selection?: VisualEditContext;
};

const VISUAL_EDIT_STYLE_PROPERTIES = new Set([
  'background-color',
  'border-color',
  'border-radius',
  'border-style',
  'border-width',
  'color',
  'display',
  'font-family',
  'font-size',
  'font-weight',
  'gap',
  'height',
  'justify-content',
  'line-height',
  'margin',
  'padding',
  'position',
  'text-align',
  'width',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && Array.isArray(value) === false;
}

function isBoundedString(value: unknown, maxLength: number, required = false): value is string {
  if (typeof value !== 'string' || value.length > maxLength) return false;
  if (required && value.trim().length === 0) return false;
  return /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value) === false;
}

function isFiniteCoordinate(value: unknown, allowNegative: boolean): value is number {
  if (typeof value !== 'number' || Number.isFinite(value) === false || Math.abs(value) > 100000) {
    return false;
  }
  return allowNegative || value >= 0;
}

function isVisualEditRectangle(value: unknown): value is VisualEditRectangle {
  if (isRecord(value) === false) return false;
  return isFiniteCoordinate(value.x, true)
    && isFiniteCoordinate(value.y, true)
    && isFiniteCoordinate(value.width, false)
    && isFiniteCoordinate(value.height, false);
}

function isVisualEditClassNames(value: unknown): value is string[] {
  if (value === undefined) return true;
  return Array.isArray(value)
    && value.length <= 16
    && value.every((item) => isBoundedString(item, 128));
}

function isVisualEditComputedStyles(value: unknown): value is Record<string, string> {
  if (value === undefined) return true;
  if (isRecord(value) === false) return false;
  for (const [property, styleValue] of Object.entries(value)) {
    if (VISUAL_EDIT_STYLE_PROPERTIES.has(property) === false
      || isBoundedString(styleValue, 256) === false) {
      return false;
    }
  }
  return true;
}

export function isVisualEditContext(value: unknown): value is VisualEditContext {
  if (isRecord(value) === false || value.schema_version !== VISUAL_EDIT_SCHEMA_VERSION) {
    return false;
  }
  return isBoundedString(value.selection_id, 128, true)
    && isBoundedString(value.page_path, 2048, true)
    && String(value.page_path).startsWith('/')
    && String(value.page_path).includes('?') === false
    && String(value.page_path).includes('#') === false
    && isBoundedString(value.selector, 1024, true)
    && String(value.selector).includes('\n') === false
    && isBoundedString(value.tag_name, 32, true)
    && (value.role === undefined || isBoundedString(value.role, 64))
    && (value.accessible_name === undefined || isBoundedString(value.accessible_name, 256))
    && (value.text_content === undefined || isBoundedString(value.text_content, 500))
    && (value.test_id === undefined || isBoundedString(value.test_id, 256))
    && isVisualEditClassNames(value.class_names)
    && isVisualEditRectangle(value.rect)
    && isVisualEditComputedStyles(value.computed_styles);
}

export function parseVisualEditBridgeMessage(value: unknown): VisualEditBridgeMessage | null {
  if (isRecord(value) === false || value.schema_version !== VISUAL_EDIT_SCHEMA_VERSION) {
    return null;
  }
  const type = value.type;
  if (type === 'yistack:visual-edit-ready' || type === 'yistack:visual-edit-cancelled') {
    return { type, schema_version: VISUAL_EDIT_SCHEMA_VERSION };
  }
  if (type === 'yistack:visual-edit-selection' && isVisualEditContext(value.selection)) {
    return {
      type,
      schema_version: VISUAL_EDIT_SCHEMA_VERSION,
      selection: value.selection,
    };
  }
  return null;
}

function resolvedVisualEditUrl(rawUrl: string, baseHref: string): URL | null {
  const normalized = rawUrl.trim();
  if (normalized.length === 0 || normalized === 'about:blank') return null;
  try {
    const resolved = new URL(normalized, baseHref);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return null;
    return resolved;
  } catch {
    return null;
  }
}

export function isVisualEditPreviewEligible(
  previewUrl: string,
  runtimeHomeUrl: string,
  baseHref: string,
): boolean {
  const preview = resolvedVisualEditUrl(previewUrl, baseHref);
  const runtimeHome = resolvedVisualEditUrl(runtimeHomeUrl, baseHref);
  if (preview === null || runtimeHome === null || preview.origin !== runtimeHome.origin) return false;
  if (runtimeHome.pathname === '/preview' || runtimeHome.pathname.startsWith('/preview/')) {
    return preview.pathname === '/preview' || preview.pathname.startsWith('/preview/');
  }
  return true;
}

export function buildVisualEditPreviewUrl(rawUrl: string, enabled: boolean, baseHref: string): string {
  const resolved = resolvedVisualEditUrl(rawUrl, baseHref);
  if (resolved === null) return rawUrl;
  if (enabled) resolved.searchParams.set(VISUAL_EDIT_QUERY_KEY, '1');
  else resolved.searchParams.delete(VISUAL_EDIT_QUERY_KEY);
  const isRelative = rawUrl.trim().startsWith('/');
  return isRelative
    ? `${resolved.pathname}${resolved.search}${resolved.hash}`
    : resolved.toString();
}

export function getVisualEditPreviewOrigin(rawUrl: string, baseHref: string): string | null {
  return resolvedVisualEditUrl(rawUrl, baseHref)?.origin ?? null;
}

export function getVisualEditTargetLabel(context: VisualEditContext): string {
  const accessibleName = context.accessible_name?.trim();
  if (accessibleName) return `${context.tag_name} · ${accessibleName}`;
  const textContent = context.text_content?.trim();
  if (textContent) return `${context.tag_name} · ${textContent.slice(0, 80)}`;
  return `${context.tag_name} · ${context.selector}`;
}

export function buildVisualEditUserPrompt(context: VisualEditContext, instruction: string): string {
  const normalizedInstruction = instruction.trim().slice(0, 2000);
  return `修改预览页面 ${context.page_path} 中选中的 ${getVisualEditTargetLabel(context)}：${normalizedInstruction}`;
}
