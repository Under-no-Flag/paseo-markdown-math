// Host integration tests: real headless browser, no Paseo daemon changes.
import assert from 'node:assert/strict';
import {readFile, mkdtemp, writeFile, rm, readdir, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer} from 'node:http';
import {renderNative} from '../server/native';
import {findBrowser} from '../server/browser';
import {lightColors} from '../shared/render';
import {nativePreview} from '../shared/native';
const root=process.cwd(),sourcePath=path.join(root,'examples/math-demo.md');
const input={sourcePath,source:await readFile(sourcePath,'utf8'),width:390,colors:lightColors,dark:false};
const profiles=async()=>(await readdir(tmpdir())).filter(name=>name.startsWith(`paseo-markdown-browser-${process.pid}-`)).sort();
const before=await profiles();
const result=nativePreview.output.parse(await renderNative(root,input));
assert.equal(result.width,390);assert.ok(result.height>1200);assert.ok(result.pages.length>=2);assert.deepEqual(result.warnings,[]);
for(const page of result.pages){const png=Buffer.from(page.uri.split(',')[1],'base64');assert.equal(png.readUInt32BE(16),780);assert.equal(png.readUInt32BE(20),page.height*2)}
assert.ok(result.links.some(link=>link.href.includes('details.md#')));assert.ok(result.anchors['行内公式']>0);
console.log('PASS: real KaTeX/Mermaid document, 2x PNG tiles, local SVG, links and anchors');
const sequence=await renderNative(root,{...input,sourcePath:path.join(root,'examples/guide/details.md'),source:await readFile('examples/guide/details.md','utf8'),dark:true});
assert.deepEqual(sequence.warnings,[]);assert.ok(sequence.pages[0].uri.length>10000);
console.log('PASS: sequence diagram, dark theme and nested local image');
let requests=0;
const server=createServer((_req,res)=>{requests++;res.end('should not be fetched')});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
try{
 const port=(server.address() as {port:number}).port;
 const broken=await renderNative(root,{...input,source:'# Errors\n\n```mermaid\ninvalid diagram\n```\n\n![missing](missing.png)\n\n![network](http://127.0.0.1:'+port+'/private)\n\n<script>fetch("http://127.0.0.1:'+port+'/execute")</script>\n\n$E=mc^2$'});
 assert.equal(requests,0);assert.ok(broken.warnings.some(w=>w.includes('Mermaid')));assert.ok(broken.warnings.some(w=>w.includes('图片无法显示')));assert.ok(broken.links.some(link=>link.href.includes('/private')));
 console.log('PASS: network images never fetched, raw HTML inert, bad diagram/image isolated');
}finally{server.close()}
await assert.rejects(renderNative(root,{...input,source:'x'.repeat(120001)}),/120,000/);
const longSource='# Long start\n\n[To end](#long-end)\n\n'+Array.from({length:300},(_,i)=>`## Section ${i}\n\nEquation $x^2 + y^2 = z^2$.\n\n`).join('')+'# Long end\n\n[To start](#long-start)';
const longInput={...input,source:longSource,width:1024};
const first=await renderNative(root,longInput);
assert.ok(first.totalHeight*first.width*4>16000000,'Fixture must exceed the old whole-document pixel limit');
assert.ok(first.totalHeight>24000,'Fixture must also exceed the old height limit');
assert.equal(first.page,0);assert.ok(first.pageCount>3);assert.equal(first.startY,0);
assert.ok(first.links.some(link=>link.href==='#long-end'));
assert.ok(first.pages.reduce((pixels,tile)=>pixels+tile.height*first.width*4,0)<=12288000);
const second=await renderNative(root,{...longInput,page:1});
assert.equal(second.startY,first.pageStarts[1]);assert.equal(second.pages[0].y,0);assert.equal(second.page,1);
assert.ok(second.links.every(link=>link.y>=0&&link.y+link.height<=second.height));
const last=await renderNative(root,{...longInput,page:9999});
assert.equal(last.page,last.pageCount-1);assert.equal(last.startY+last.height,last.totalHeight);
assert.match(last.pages.map(tile=>tile.text).join(' '),/Long end/);assert.ok(last.links.some(link=>link.href==='#long-start'));
console.log('PASS: document over 16M pixels/24k height, bounded first/second/last page, cross-page anchors and page clamping');
const outside=await mkdtemp(path.join(tmpdir(),'paseo-native-outside-'));
try{
 await writeFile(path.join(outside,'secret.md'),'secret');await assert.rejects(renderNative(root,{...input,sourcePath:path.join(outside,'secret.md')}),/不在当前工作区/);
 await writeFile(path.join(outside,'math # %.md'),'$x^2$');
 await symlink(path.join(outside,'math # %.md'),path.join(outside,'alias.md'));
 const alias=await renderNative(outside,{...input,sourcePath:path.join(outside,'alias.md'),source:'$x^2$'});assert.ok(alias.pages.length>0);
}finally{await rm(outside,{recursive:true,force:true})}
const original=process.env.PASEO_MARKDOWN_BROWSER;
try{process.env.PASEO_MARKDOWN_BROWSER=path.join(tmpdir(),'nonexistent-browser-paseo-test');await assert.rejects(findBrowser(),/Chrome/)}finally{if(original===undefined)delete process.env.PASEO_MARKDOWN_BROWSER;else process.env.PASEO_MARKDOWN_BROWSER=original}
assert.deepEqual(await profiles(),before);
console.log('PASS: source/height/workspace limits, missing browser message and temporary profile cleanup');
