export const VISUAL_CONTEXT_SCHEMA_VERSION = 'visual_context.v1' as const;
export const MAX_VISUAL_ATTACHMENT_COUNT = 4;
export const MAX_VISUAL_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_VISUAL_ATTACHMENT_TOTAL_BYTES = 12 * 1024 * 1024;

export type VisualAttachmentContentType = 'image/png' | 'image/jpeg';

export interface VisualAttachmentInput {
  name: string;
  content_type: VisualAttachmentContentType;
  size: number;
  data_url: string;
}

export interface VisualAttachmentSummary {
  name: string;
  content_type: string;
  size: number;
  sha256: string;
  width: number;
  height: number;
}

export interface VisualContext {
  schema_version: typeof VISUAL_CONTEXT_SCHEMA_VERSION;
  id: string;
  server_proof: string;
  summary: string;
  layout: string[];
  components: string[];
  color_palette: string[];
  typography: string[];
  spacing: string[];
  responsive_behavior: string[];
  interaction_notes: string[];
  attachments: VisualAttachmentSummary[];
  provider: string;
  model: string;
  analyzed_at: string;
}

export function hasVisionCapability(capabilityTags: string | null | undefined): boolean {
  if (typeof capabilityTags !== 'string') {
    return false;
  }
  for (const rawTag of capabilityTags.split(',')) {
    if (rawTag.trim().toLowerCase() === 'vision') {
      return true;
    }
  }
  return false;
}

export function toVisualAttachmentInput(attachment: {
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
}): VisualAttachmentInput | null {
  const contentType = attachment.type;
  const dataUrl = attachment.dataUrl;
  if ((contentType !== 'image/png' && contentType !== 'image/jpeg') || typeof dataUrl !== 'string' || dataUrl.length === 0) {
    return null;
  }
  return {
    name: attachment.name,
    content_type: contentType,
    size: attachment.size,
    data_url: dataUrl,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && Array.isArray(value) === false;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isNonEmptyStringList(value: unknown): value is string[] {
  return isStringList(value) && value.length > 0;
}

function isVisualAttachmentSummary(value: unknown): value is VisualAttachmentSummary {
  if (isRecord(value) === false) {
    return false;
  }
  return isNonEmptyString(value.name)
    && isNonEmptyString(value.content_type)
    && typeof value.size === 'number'
    && Number.isSafeInteger(value.size)
    && value.size > 0
    && isNonEmptyString(value.sha256)
    && typeof value.width === 'number'
    && Number.isSafeInteger(value.width)
    && value.width > 0
    && typeof value.height === 'number'
    && Number.isSafeInteger(value.height)
    && value.height > 0;
}

export function isVisualContext(value: unknown): value is VisualContext {
  if (isRecord(value) === false || value.schema_version !== VISUAL_CONTEXT_SCHEMA_VERSION) {
    return false;
  }
  return isNonEmptyString(value.id)
    && isNonEmptyString(value.server_proof)
    && isNonEmptyString(value.summary)
    && isNonEmptyStringList(value.layout)
    && isNonEmptyStringList(value.components)
    && isNonEmptyStringList(value.color_palette)
    && isNonEmptyStringList(value.typography)
    && isNonEmptyStringList(value.spacing)
    && isNonEmptyStringList(value.responsive_behavior)
    && isStringList(value.interaction_notes)
    && Array.isArray(value.attachments)
    && value.attachments.length > 0
    && value.attachments.every(isVisualAttachmentSummary)
    && isNonEmptyString(value.provider)
    && isNonEmptyString(value.model)
    && isNonEmptyString(value.analyzed_at);
}


export function resolveVisualContextForPlans(
  plans: readonly { id: string; visual_context?: VisualContext }[],
  selectedPlanId: string | null,
  recommendedPlanId: string | null,
): VisualContext | undefined {
  for (const targetId of [selectedPlanId, recommendedPlanId]) {
    if (targetId === null) continue;
    for (const plan of plans) {
      if (plan.id === targetId && plan.visual_context !== undefined) {
        return plan.visual_context;
      }
    }
  }
  for (const plan of plans) {
    if (plan.visual_context !== undefined) return plan.visual_context;
  }
  return undefined;
}
export function parseVisualContextJSON(value: string | null | undefined): VisualContext | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return isVisualContext(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isVisualAttachmentContentType(value: string): value is VisualAttachmentContentType {
  return value === 'image/png' || value === 'image/jpeg';
}

function isVisualAttachmentInput(value: unknown): value is VisualAttachmentInput {
  if (isRecord(value) === false) {
    return false;
  }
  return isNonEmptyString(value.name)
    && isVisualAttachmentContentType(String(value.content_type))
    && typeof value.size === 'number'
    && Number.isSafeInteger(value.size)
    && value.size > 0
    && isNonEmptyString(value.data_url)
    && value.data_url.startsWith(`data:${String(value.content_type)};base64,`);
}

export function parseVisualAttachmentInputsJSON(
  value: string | null | undefined,
): VisualAttachmentInput[] {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed) === false) {
      return [];
    }
    const inputs: VisualAttachmentInput[] = [];
    for (const item of parsed) {
      if (isVisualAttachmentInput(item)) inputs.push(item);
    }
    return inputs;
  } catch {
    return [];
  }
}
