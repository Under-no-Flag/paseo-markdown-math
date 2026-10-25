import MarkdownIt from 'markdown-it';
import { katex } from '@mdit/plugin-katex';
import { katexCss } from './generated/katex-css';
import { frameRuntime } from './generated/frame-runtime';

export const MAX_PREVIEW_CHARACTERS = 500_000;
export interface PreviewColors {
  background: string;
  foreground: string;
  muted: string;
  border: string;
  accent: string;
  codeBackground: string;
}
export const lightColors: PreviewColors = {
  background: '#ffffff', foreground: '#20252b', muted: '#66717e',
  border: '#dce2e8', accent: '#226a9e', codeBackground: '#f4f6f8',
};
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]!));
}

// A new parser per document prevents user-defined TeX macros crossing file boundaries.
export function renderMarkdown(source: string): string {
  if (source.length > MAX_PREVIEW_CHARACTERS) throw new Error('文件超过 500,000 字符，请使用源码视图。');
  const md = new MarkdownIt({ html: false, linkify: true, typographer: false })
    .use(katex, { delimiters: 'all', mathFence: true, throwOnError: false,
      trust: false, strict: 'ignore', maxExpand: 1000, maxSize: 20,
      output: 'htmlAndMathml', macros: {} });
  const defaultFence = md.renderer.rules.fence!;
  md.renderer.rules.fence = (tokens, index, options, env, renderer) => {
    if (tokens[index].info.trim().toLowerCase() === 'mermaid') return `<pre class="mermaid-source">${escapeHtml(tokens[index].content)}</pre>`;
    return defaultFence(tokens, index, options, env, renderer);
  };
  const headings = new Map<string, number>();
  md.renderer.rules.heading_open = (tokens, index, options, env, renderer) => {
    const label = tokens[index + 1].children?.filter(t => t.type !== 'html_inline').map(t => t.content).join('') || tokens[index + 1].content;
    const base = label.trim().toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\s-]/gu, '').replace(/\s/g, '-') || 'section';
    let id = base; let suffix = 0;
    while (headings.has(id)) id = `${base}-${++suffix}`;
    headings.set(id, 1); tokens[index].attrSet('id', id); tokens[index].attrSet('tabindex', '-1');
    return renderer.renderToken(tokens, index, options);
  };
  md.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
    const token = tokens[index];
    const href = String(token.attrGet('href') ?? '');
    if (/^https?:\/\//i.test(href)) {
      token.attrSet('target', '_blank'); token.attrSet('rel', 'noopener noreferrer');
    } else if (href && !href.startsWith('#') && !/^[a-z][a-z\d+.-]*:|^[\\/]{2}/i.test(href)) {
      token.attrSet('data-local-link', href); token.attrSet('href', '#');
      token.attrSet('title', `在预览中打开：${href}`);
    } else if (!href.startsWith('#')) {
      token.attrs = (token.attrs ?? []).filter(([key]) => key !== 'href');
      token.attrSet('title', '不支持此链接协议');
    }
    return renderer.renderToken(tokens, index, options);
  };
  md.renderer.rules.image = (tokens, index) => {
    const token = tokens[index];
    const label = escapeHtml(token.content || '图片');
    const src = String(token.attrGet('src') ?? '');
    const title = escapeHtml(String(token.attrGet('title') ?? token.content ?? ''));
    const common = `alt="${label}" title="${title}" referrerpolicy="no-referrer" decoding="async"`;
    if (/^https?:\/\//i.test(src) || /^data:image\/(?:png|jpeg|gif|webp|avif|svg\+xml|bmp);base64,[A-Za-z0-9+/=\s]+$/.test(src)) return `<img src="${escapeHtml(src)}" ${common} loading="lazy">`;
    if (src && !/^[a-z][a-z\d+.-]*:|^[\\/]{2}/i.test(src)) return `<img data-local-image="${escapeHtml(src)}" ${common}>`;
    return `<span class="resource-error">不支持的图片地址：${label}</span>`;
  };
  return md.render(source.replace(/^\uFEFF/, ''));
}

function safeColor(color: string): string {
  // Theme values are data, never CSS declarations or HTML.
  return /^(#[\da-f]{3,8}|rgba?\([\d.,%\s]+\)|hsla?\([\d.,%\s]+\)|[a-z]+)$/i.test(color) ? color : 'inherit';
}
export interface DocumentOptions { token?: string; nonce?: string; dark?: boolean; hash?: string }
export function createDocument(source: string, colors: PreviewColors = lightColors, options: DocumentOptions = {}): string {
  const c = Object.fromEntries(Object.entries(colors).map(([k,v]) => [k,safeColor(v)]));
  const body = renderMarkdown(source);
  const nonce = /^[a-zA-Z0-9-]+$/.test(options.nonce || '') ? options.nonce! : 'static-preview';
  const config = escapeHtml(JSON.stringify({ token: options.token || '', dark: options.dark || false, hash: options.hash || '' }));
  const runtime = frameRuntime.replace(/<\/script/gi, '<\\/script');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data: https: http:; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'"><meta name="referrer" content="no-referrer"><title>Markdown + Math</title><style>${katexCss}
html{color-scheme:normal;background:${c.background};color:${c.foreground}}*{box-sizing:border-box}body{margin:0;font:16px/1.75 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow-wrap:anywhere}main{max-width:960px;margin:auto;padding:28px 36px 64px}h1,h2,h3{line-height:1.35;letter-spacing:-.02em}h1{font-size:2em;border-bottom:1px solid ${c.border};padding-bottom:.45em}h2{font-size:1.4em;margin-top:1.8em}a{color:${c.accent}}pre,code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}code{background:${c.codeBackground};padding:.15em .3em;border-radius:4px;font-size:.9em}pre{background:${c.codeBackground};padding:16px;border:1px solid ${c.border};border-radius:8px;overflow:auto}pre code{padding:0;background:transparent}blockquote{margin-left:0;padding:2px 18px;border-left:3px solid ${c.border};color:${c.muted}}table{display:block;overflow:auto;border-collapse:collapse;max-width:100%}th,td{border:1px solid ${c.border};padding:8px 14px;text-align:left}th{background:${c.codeBackground}}hr{border:0;border-top:1px solid ${c.border};margin:28px 0}.katex-display{overflow-x:auto;overflow-y:hidden;padding:12px 2px}.katex{font-size:1.1em}.katex-error{white-space:pre-wrap}img{max-width:100%;height:auto;border-radius:6px}img[data-local-image]:not([src]){min-height:24px}.resource-error{display:block;color:${c.muted};border:1px dashed ${c.border};padding:10px;white-space:pre-wrap}.mermaid-diagram{margin:24px 0;padding:16px;border:1px solid ${c.border};border-radius:8px;overflow:auto}.mermaid-visual{min-width:0;overflow:auto;text-align:center}.mermaid-visual svg{max-width:100%;height:auto}details{font-size:13px;color:${c.muted};margin-top:12px}summary{cursor:pointer}h1,h2,h3,h4,h5,h6{scroll-margin-top:20px}@media(max-width:600px){main{padding:18px 18px 40px}body{font-size:15px}h1{font-size:1.65em}}
</style></head><body><div id="preview-config" hidden data-config="${config}"></div><main>${body || '<p>此 Markdown 文件为空。</p>'}</main><script nonce="${nonce}">${runtime}</script></body></html>`;
}
