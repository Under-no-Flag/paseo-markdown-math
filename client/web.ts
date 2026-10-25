import { Platform } from 'react-native';
import type { PreviewColors } from './render';

interface Message { source: unknown; data: { token?: string; type?: string; id?: string; href?: string } }
interface Frame {
  srcdoc: string; contentWindow: { postMessage(message: unknown, target: string): void } | null;
  style: { cssText: string }; setAttribute(name: string, value: string): void;
  addEventListener(name: string, listener: () => void): void;
  removeEventListener(name: string, listener: () => void): void; remove(): void;
}
interface Parent {
  ownerDocument: {
    createElement(name: 'iframe'): Frame;
    defaultView: {
      crypto: { randomUUID(): string };
      addEventListener(name: 'message', listener: (event: Message) => void): void;
      removeEventListener(name: 'message', listener: (event: Message) => void): void;
    };
  };
  appendChild(child: Frame): void;
}
export interface PreviewActions {
  loadImage(href: string): Promise<string>;
  navigate(href: string): void;
  hash?: string;
  dark?: boolean;
}
export interface PreviewHandle { destroy(): void }
export function mountPreview(parent: unknown, source: string, colors: PreviewColors, onReady: () => void, actions: PreviewActions): PreviewHandle | null {
  if (Platform.OS !== 'web' || !parent) return null;
  const { createDocument } = require('./render') as typeof import('./render');
  const host = parent as Parent;
  const window = host.ownerDocument.defaultView;
  const token = window.crypto.randomUUID();
  const frame = host.ownerDocument.createElement('iframe');
  let active = true;
  let totalBytes = 0;
  const seen = new Set<string>();
  const images = new Map<string, Promise<string>>();
  // Sequential reads bound memory/RPC pressure even for documents with many images.
  let queue = Promise.resolve();
  const onMessage = (event: Message) => {
    if (!active || event.source !== frame.contentWindow || event.data?.token !== token) return;
    const { type, href, id } = event.data;
    if (typeof href !== 'string' || href.length > 8192) return;
    if (type === 'navigate') { actions.navigate(href); return; }
    if (type !== 'image' || typeof id !== 'string' || !/^image-\d+$/.test(id) || seen.has(id) || seen.size >= 32) return;
    seen.add(id);
    queue = queue.then(async () => {
      if (!active) return;
      try {
        let image = images.get(href);
        if (!image) {
          image = actions.loadImage(href).then(url => {
            totalBytes += url.length;
            if (totalBytes > 28 * 1024 * 1024) throw new Error('单页图片总量超过约 20 MiB 限制');
            return url;
          });
          images.set(href, image);
        }
        const url = await image;
        if (active) frame.contentWindow?.postMessage({ token, type: 'image-result', id, url }, '*');
      } catch (cause) {
        if (active) frame.contentWindow?.postMessage({ token, type: 'image-result', id, error: cause instanceof Error ? cause.message : String(cause) }, '*');
      }
    });
  };
  frame.setAttribute('title', 'Markdown 与 LaTeX 公式预览');
  // Only the nonce-bearing bundled renderer may run; the frame never gets same-origin access.
  frame.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox');
  frame.setAttribute('referrerpolicy', 'no-referrer');
  frame.style.cssText = 'display:block;width:100%;height:100%;flex:1;border:0;min-height:0;';
  frame.addEventListener('load', onReady);
  window.addEventListener('message', onMessage);
  try {
    frame.srcdoc = createDocument(source, colors, { token, nonce: token, hash: actions.hash, dark: actions.dark });
    host.appendChild(frame);
  } catch (error) {
    window.removeEventListener('message', onMessage); frame.removeEventListener('load', onReady); throw error;
  }
  return { destroy() { active = false; window.removeEventListener('message', onMessage); frame.removeEventListener('load', onReady); frame.remove(); } };
}
