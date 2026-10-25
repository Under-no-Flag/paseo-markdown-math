import { open, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { MAX_IMAGE_BYTES, MAX_DOCUMENT_BYTES } from '../shared/resources';

const imageTypes: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.bmp': 'image/bmp' };
function inside(root: string, file: string) {
  const relative = path.relative(root, file);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}
export async function resolveResource(root: string, sourcePath: string, href: string) {
  const base = await realpath(root);
  const source = await realpath(sourcePath);
  if (!inside(base, source)) throw new Error('Markdown 文件不在当前工作区内。');
  // Interpret root-relative URLs relative to the workspace, never the machine root.
  let decoded: string;
  try { decoded = decodeURIComponent(href.split(/[?#]/, 1)[0]); }
  catch { throw new Error('资源路径包含无效编码。'); }
  if (!decoded || /[\x00-\x1f]/.test(decoded) || /^[a-z][a-z\d+.-]*:/i.test(decoded) || /^[\\/]{2}/.test(decoded)) throw new Error('仅支持工作区内的相对路径。');
  decoded = decoded.replaceAll('\\', '/');
  const candidate = path.resolve(decoded.startsWith('/') ? base : path.dirname(source), decoded.replace(/^\/+/, ''));
  if (!inside(base, candidate)) throw new Error('资源路径超出了当前工作区。');
  const target = await realpath(candidate);
  if (!inside(base, target)) throw new Error('资源符号链接指向工作区之外。');
  return target;
}
export async function loadResource(root: string, sourcePath: string, href: string, kind: 'image' | 'document') {
  const target = await resolveResource(root, sourcePath, href);
  const ext = path.extname(target).toLowerCase();
  const mime = imageTypes[ext];
  if (kind === 'image' && !mime) throw new Error('不支持此图片格式。');
  if (kind === 'document' && !['.md', '.markdown', '.mdown', '.mkd'].includes(ext)) throw new Error('本地链接目前支持 Markdown 文件；图片请使用 Markdown 图片语法。');
  const limit = kind === 'image' ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES;
  // Reject directories/devices/FIFOs before open (opening a FIFO could block).
  if (!(await stat(target)).isFile()) throw new Error('目标不是普通文件。');
  const file = await open(target, 'r');
  try {
    const stat = await file.stat();
    if (!stat.isFile()) throw new Error('目标不是普通文件。');
    if (stat.size > limit) throw new Error(kind === 'image' ? '图片超过 5 MiB 限制。' : 'Markdown 超过 2 MiB 限制。');
    const buffer = Buffer.alloc(limit + 1);
    let size = 0;
    while (size <= limit) {
      const { bytesRead } = await file.read(buffer, size, buffer.length - size, null);
      if (!bytesRead) break;
      size += bytesRead;
    }
    if (size > limit) throw new Error('读取过程中资源增长，超过大小限制。');
    const bytes = buffer.subarray(0, size);
    return { path: target, content: kind === 'image' ? `data:${mime};base64,${bytes.toString('base64')}` : bytes.toString('utf8').replace(/^\uFEFF/, ''), modifiedAt: stat.mtime.toISOString() };
  } finally { await file.close(); }
}
