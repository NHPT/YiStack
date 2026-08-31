type StructuredErrorLike = {
  message?: unknown;
  details?: unknown;
  source?: unknown;
};

type ApiErrorDisplaySuffixSegment = string;
type ApiErrorDisplaySuffixSegmentList = ApiErrorDisplaySuffixSegment[];

function isStructuredErrorLike(error: unknown): error is StructuredErrorLike {
  return typeof error === 'object' && error !== null;
}

function getApiErrorDisplayText(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  const text = value.trim();
  if (text.length === 0) {
    return '';
  }

  return text;
}

function getApiErrorDisplaySourceSegment(source: string): ApiErrorDisplaySuffixSegment | undefined {
  if (source.length === 0) {
    return undefined;
  }

  return `来源：${source}`;
}

function addApiErrorDisplaySuffixSegment(
  segments: ApiErrorDisplaySuffixSegmentList,
  message: string,
  segment: ApiErrorDisplaySuffixSegment | undefined,
) {
  if (segment === undefined) {
    return;
  }

  if (message.includes(segment)) {
    return;
  }

  segments.push(segment);
}

function materializeApiErrorDisplaySuffixSegments(
  message: string,
  source: string,
  details: string,
): ApiErrorDisplaySuffixSegmentList {
  const segments: ApiErrorDisplaySuffixSegmentList = [];
  const sourceSegment = getApiErrorDisplaySourceSegment(source);

  addApiErrorDisplaySuffixSegment(segments, message, sourceSegment);
  addApiErrorDisplaySuffixSegment(segments, message, details);

  return segments;
}

export function formatUserVisibleApiError(error: unknown, fallback: string) {
  const message = error instanceof Error && error.message.trim()
    ? error.message.trim()
    : fallback;

  if (!isStructuredErrorLike(error)) {
    return message;
  }

  const source = getApiErrorDisplayText(error.source);
  const details = getApiErrorDisplayText(error.details);
  const suffixSegments = materializeApiErrorDisplaySuffixSegments(message, source, details);
  const suffix = suffixSegments.join('；');

  return suffix ? `${message}（${suffix}）` : message;
}
