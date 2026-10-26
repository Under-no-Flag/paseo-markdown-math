// Browser-only program, bundled into a string. Never evaluated in Paseo's host context.
import mermaid from 'mermaid';
const settings = JSON.parse(document.getElementById('preview-config')!.getAttribute('data-config')!);
const notify = (message: Record<string, unknown>) => parent.postMessage({ ...message, token: settings.token }, '*');
const pending = new Map<string, { image: HTMLImageElement; timer: ReturnType<typeof setTimeout> }>();
function showError(image: HTMLImageElement, message: string) {
  const text = document.createElement('span');
  text.className = 'resource-error';
  text.textContent = `图片无法显示：${image.alt || image.getAttribute('data-local-image') || ''}（${message}）`;
  image.replaceWith(text);
}
for (const image of document.querySelectorAll<HTMLImageElement>('img')) {
  image.addEventListener('error', () => showError(image, '资源不存在、不可访问或格式错误'));
}
const localImages = [...document.querySelectorAll<HTMLImageElement>('img[data-local-image]')];
// Bound work per document. Repeated image paths are deduplicated by the parent bridge.
for (const [index, image] of localImages.entries()) {
  if (index >= 32) { showError(image, '单页最多加载 32 张本地图片'); continue; }
  const id = `image-${index}`;
  const timer = setTimeout(() => { pending.delete(id); showError(image, '读取超时'); }, 15000);
  pending.set(id, { image, timer });
  notify({ type: 'image', id, href: image.getAttribute('data-local-image') });
}
window.addEventListener('message', event => {
  if (event.source !== parent || event.data?.token !== settings.token) return;
  const data = event.data;
  if (data.type === 'image-result' && pending.has(data.id)) {
    const { image, timer } = pending.get(data.id)!;
    clearTimeout(timer); pending.delete(data.id);
    if (typeof data.url === 'string' && /^data:image\/(?:png|jpeg|gif|webp|avif|svg\+xml|bmp);base64,/.test(data.url)) image.src = data.url;
    else showError(image, String(data.error || '无效图片数据'));
  }
});
function scrollToHash(hash: string) {
  let id = hash.replace(/^#/, '');
  try { id = decodeURIComponent(id); } catch { /* retain literal */ }
  const target = document.getElementById(id);
  if (target) { target.scrollIntoView(); target.focus({ preventScroll: true }); }
  else if (!id) window.scrollTo(0, 0);
}
document.addEventListener('click', event => {
  const link = (event.target as Element)?.closest?.('a');
  if (!link) return;
  const local = link.getAttribute('data-local-link');
  if (local) { event.preventDefault(); notify({ type: 'navigate', href: local }); return; }
  const href = link.getAttribute('href') || '';
  if (href.startsWith('#')) { event.preventDefault(); scrollToHash(href); }
});
mermaid.initialize({
  startOnLoad: false, securityLevel: 'strict', theme: settings.dark ? 'dark' : 'default',
  suppressErrorRendering: true, maxTextSize: 50000, maxEdges: 1000,
  flowchart: { htmlLabels: false },
  secure: ['secure','securityLevel','startOnLoad','maxTextSize','maxEdges','suppressErrorRendering','themeCSS','fontFamily','altFontFamily','flowchart'],
});
async function diagrams() {
  // Sequence diagrams measure SVG text. Wait until the newly inserted iframe
  // participates in layout and its local fonts have settled before measuring.
  await document.fonts.ready;
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  const blocks = [...document.querySelectorAll<HTMLElement>('pre.mermaid-source')];
  for (const [index, block] of blocks.entries()) {
    const source = block.textContent || '';
    const figure = document.createElement('figure'); figure.className = 'mermaid-diagram';
    const details = document.createElement('details');
    const summary = document.createElement('summary'); summary.textContent = 'Mermaid 源码';
    const pre = document.createElement('pre'); pre.textContent = source;
    details.append(summary, pre);
    block.replaceWith(figure); figure.append(details);
    try {
      if (index >= 20 || source.length > 50000) throw new Error('超过单页 20 张图或单图 50,000 字符限制');
      const result = await mermaid.render(`diagram-${index}`, source);
      const visual = document.createElement('div'); visual.className = 'mermaid-visual';
      visual.innerHTML = result.svg;
      figure.prepend(visual);
    } catch (error) {
      const note = document.createElement('p'); note.className = 'resource-error';
      note.textContent = `Mermaid 无法渲染：${error instanceof Error ? error.message : String(error)}`;
      figure.prepend(note); details.open = true;
    }
  }
  if (settings.hash) scrollToHash(settings.hash);
  document.documentElement.setAttribute('data-preview-ready', 'true');
  notify({ type: 'ready' });
}
void diagrams().catch(error => { notify({ type: 'error', message: String(error) }); });
