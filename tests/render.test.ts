import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument, renderMarkdown, MAX_PREVIEW_CHARACTERS} from '../client/render';

test('headings, lists, tables, code and Chinese text', () => {
 const html=renderMarkdown('# 中文标题\n\n- one\n- two\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n`x < y`');
 for (const tag of ['中文标题</h1>', '<ul>', '<table>', '<code>x &lt; y</code>']) assert.ok(html.includes(tag),tag);
});
for (const [name,source,display] of [
 ['dollar','$E=mc^2$',false],['bracket',String.raw`\(x^2+y^2\)`,false],
 ['display','$$\n\\frac{1}{2}\n$$',true],['display bracket',String.raw`\[\int_0^1 x\,dx\]`,true],
 ['fence','```math\nx^2\n```',true],['matrix',String.raw`$$\begin{bmatrix}1&2\\3&4\end{bmatrix}$$`,true],
] as const) test(`renders ${name}`,()=>{
 const html=renderMarkdown(source);assert.match(html,/class="katex"/);assert.match(html,/<math/);
 if(display)assert.match(html,/katex-display/);
});
test('math in inline and fenced code remains literal',()=>{
 const html=renderMarkdown('`$x$`\n\n```text\n$$x$$\n\\(y\\)\n```');assert.doesNotMatch(html,/class="katex"/);assert.match(html,/\$\$x\$\$/);
});
test('escaped dollars and normal currency remain text',()=>{
 const html=renderMarkdown(String.raw`\$x$ and $5 and $10.`);assert.doesNotMatch(html,/class="katex"/);
});
test('invalid TeX is visible without taking down the document',()=>{
 const html=renderMarkdown('$\\notARealCommand{a}$\n\nStill here');assert.match(html,/notARealCommand/);assert.match(html,/Still here/);
});
test('HTML and dangerous URLs cannot become executable markup',()=>{
 const html=renderMarkdown('<script>alert(1)</script>\n<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))\n\n[x](data:text/html,hello)');
 assert.doesNotMatch(html,/<script|<img|href="(?:javascript|data):/i);assert.match(html,/&lt;script&gt;/);
});
test('untrusted TeX cannot create external resource requests',()=>{
 const html=renderMarkdown(String.raw`$\href{javascript:alert(1)}{x}$ $\includegraphics{https://example.com/x.png}$`);
 assert.doesNotMatch(html,/<(?:a|img)\b/);
});
test('external links are isolated and local links use the navigation bridge',()=>{
 const html=renderMarkdown('[web](https://example.com) [file](../a.md) [local](file:///secret)');
 assert.match(html,/rel="noopener noreferrer"/);assert.match(html,/target="_blank"/);assert.doesNotMatch(html,/href="\.\.|href="file:/);
});
test('remote images render; malicious alt text is escaped',()=>{
 const html=renderMarkdown('![<img src=x onerror=x>](https://example.com/p.png)');assert.match(html,/<img src="https:/);assert.doesNotMatch(html,/<img src=x/);assert.match(html,/&lt;img/);
});
test('macro state does not cross documents',()=>{
 renderMarkdown(String.raw`$\gdef\userMacro{abc}\userMacro$`);
 assert.match(renderMarkdown(String.raw`$\userMacro$`),/userMacro/);
});
test('empty input, BOM, and CRLF are supported',()=>{
 assert.match(createDocument(''),/此 Markdown 文件为空/);assert.match(renderMarkdown('\uFEFF# Heading\r\n'),/Heading<\/h1>/);
});
test('fonts are inline and only the nonce renderer is permitted',()=>{
 const html=createDocument('$x$');assert.match(html,/font\/woff2;base64,/);assert.match(html,/default-src 'none'/);assert.ok(!html.includes('url(fonts/'));assert.ok(html.includes("script-src 'nonce-static-preview'"));
});
test('oversized documents fail with a useful source-view message',()=>{
 assert.throws(()=>renderMarkdown('x'.repeat(MAX_PREVIEW_CHARACTERS+1)),/源码视图/);
});

test('Mermaid fences preserve escaped source for the isolated renderer',()=>{
 const html=renderMarkdown('```mermaid\nflowchart LR\n A[<script>] --> B\n```');
 assert.match(html,/class="mermaid-source"/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
});
test('relative images, encoded names and local document fragments survive rendering',()=>{
 const html=renderMarkdown('![diagram](../assets/图%20一.svg) [next](./guide.md#details)');
 assert.match(html,/data-local-image="..\/assets\/%E5%9B%BE%20%E4%B8%80.svg"/);assert.match(html,/data-local-link=".\/guide.md#details"/);
});
test('heading anchors are stable, Unicode-aware and deduplicated',()=>{
 const html=renderMarkdown('# 标题\n\n# 标题\n\n# 标题-1\n\n# 标题');
 for(const id of ['标题','标题-1','标题-1-1','标题-2'])assert.ok(html.includes(`id="${id}"`));
});
test('plain HTTP URLs become links',()=>{assert.match(renderMarkdown('https://example.com'),/href="https:\/\/example.com"/)});
