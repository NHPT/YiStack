import {
  MAX_VISUAL_ATTACHMENT_BYTES,
  MAX_VISUAL_ATTACHMENT_COUNT,
  MAX_VISUAL_ATTACHMENT_TOTAL_BYTES,
  type VisualAttachmentContentType,
  type VisualAttachmentInput,
} from '@/lib/visual-context';

import type { WorkspaceAttachment } from './workspace-page-local-state-contract';

export class WorkspaceVisualAttachmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceVisualAttachmentError';
  }
}

function isVisualAttachmentContentType(value: string): value is VisualAttachmentContentType {
  return value === 'image/png' || value === 'image/jpeg';
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new WorkspaceVisualAttachmentError(`无法读取图片 ${file.name || '未命名图片'}`));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new WorkspaceVisualAttachmentError(`无法读取图片 ${file.name || '未命名图片'}`));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function visualAttachmentIdentity(file: Pick<File, 'name' | 'size' | 'type' | 'lastModified'>): string {
  return [file.name, file.size, file.type, file.lastModified].join('\u0000');
}

function currentVisualAttachmentIdentity(file: WorkspaceAttachment): string {
  return [file.name, file.size, file.type].join('\u0000');
}

export async function materializeWorkspaceVisualAttachments(
  uploads: readonly File[],
  currentFiles: readonly WorkspaceAttachment[],
): Promise<WorkspaceAttachment[]> {
  const existing = new Set<string>();
  for (const file of currentFiles) {
    existing.add(currentVisualAttachmentIdentity(file));
  }

  const uniqueFiles: File[] = [];
  for (const file of uploads) {
    if (!isVisualAttachmentContentType(file.type)) {
      throw new WorkspaceVisualAttachmentError('仅支持 PNG 或 JPEG 图片');
    }
    if (file.size <= 0 || file.size > MAX_VISUAL_ATTACHMENT_BYTES) {
      throw new WorkspaceVisualAttachmentError('单张图片大小必须在 1 字节到 5 MiB 之间');
    }
    const key = visualAttachmentIdentity(file);
    const fallbackKey = [file.name, file.size, file.type].join('\u0000');
    if (existing.has(key) || existing.has(fallbackKey)) {
      continue;
    }
    existing.add(key);
    existing.add(fallbackKey);
    uniqueFiles.push(file);
  }

  if (currentFiles.length + uniqueFiles.length > MAX_VISUAL_ATTACHMENT_COUNT) {
    throw new WorkspaceVisualAttachmentError(`最多允许上传 ${MAX_VISUAL_ATTACHMENT_COUNT} 张参考图`);
  }

  let totalSize = 0;
  for (const file of currentFiles) {
    totalSize += file.size;
  }
  for (const file of uniqueFiles) {
    totalSize += file.size;
  }
  if (totalSize > MAX_VISUAL_ATTACHMENT_TOTAL_BYTES) {
    throw new WorkspaceVisualAttachmentError('参考图总大小不能超过 12 MiB');
  }

  const result: WorkspaceAttachment[] = [];
  for (let index = 0; index < uniqueFiles.length; index += 1) {
    const file = uniqueFiles[index];
    if (file === undefined) {
      continue;
    }
    if (isVisualAttachmentContentType(file.type) === false) {
      throw new WorkspaceVisualAttachmentError(`图片 ${file.name || index + 1} 的类型无效`);
    }
    const contentType = file.type;
    const dataUrl = await readFileAsDataURL(file);
    const expectedPrefix = `data:${contentType};base64,`;
    if (!dataUrl.startsWith(expectedPrefix)) {
      throw new WorkspaceVisualAttachmentError(`图片 ${file.name || index + 1} 的编码格式无效`);
    }
    result.push({
      name: file.name || `pasted-image-${index + 1}.${file.type === 'image/png' ? 'png' : 'jpg'}`,
      size: file.size,
      type: contentType,
      dataUrl,
    });
  }
  return result;
}

export function toWorkspaceVisualAttachmentInputs(
  attachments: readonly WorkspaceAttachment[],
): VisualAttachmentInput[] {
  const inputs: VisualAttachmentInput[] = [];
  for (const attachment of attachments) {
    inputs.push({
      name: attachment.name,
      content_type: attachment.type,
      size: attachment.size,
      data_url: attachment.dataUrl,
    });
  }
  return inputs;
}
