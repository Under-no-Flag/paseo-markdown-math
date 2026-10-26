import {createDocument,escapeHtml,type PreviewColors} from '../shared/render';
import type {NativePreviewResult} from '../shared/native';
import {BrowserPipe} from './browser';
import {loadResource,resolveResource} from './resources';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {realpath} from 'node:fs/promises';

const MAX_HEIGHT=24000;
const MAX_OUTPUT=8*1024*1024;
let active=false;
const waiters:Array<()=>void>=[];
async function acquire(){
  if(active){
    if(waiters.length>=2)throw new Error('主机正在生成其他预览，请稍后刷新。');
    await new Promise<void>((resolve,reject)=>{
      const resume=()=>{clearTimeout(timer);resolve()};
      const timer=setTimeout(()=>{const index=waiters.indexOf(resume);if(index>=0)waiters.splice(index,1);reject(new Error('主机正在生成其他预览，请稍后刷新。'))},2000);
      waiters.push(resume);
    });
  }
  active=true;
}
function release(){const next=waiters.shift();if(next)next();else active=false}
const unescape=(value:string)=>value.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');

export async function renderNative(root:string,input:{sourcePath:string;source:string;width:number;colors:PreviewColors;dark:boolean}):Promise<NativePreviewResult>{
  if(input.source.length>120000)throw new Error('移动端预览最多支持 120,000 字符，请使用源码视图。');
  // Validate the originating document even when it contains no image references.
  await resolveResource(root,input.sourcePath,encodeURIComponent(path.basename(await realpath(input.sourcePath))));
  await acquire();
  let browser:BrowserPipe|undefined;
  try{
    const warnings:string[]=[];
    let html=createDocument(input.source,input.colors,{nonce:randomUUID(),dark:input.dark});
    const images=[...html.matchAll(/<img data-local-image="([^"]+)"[^>]*>/g)];
    const imageCache=new Map<string,string>();let total=0;
    for(const [index,match]of images.entries()){
      const href=unescape(match[1]);
      try{
        if(index>=32)throw new Error('单页最多加载 32 张本地图片');
        let url=imageCache.get(href);
        if(!url){url=(await loadResource(root,input.sourcePath,href,'image')).content;total+=url.length;if(total>28*1024*1024)throw new Error('本地图片总量超过约 20 MiB');imageCache.set(href,url)}
        html=html.replace(match[0],match[0].replace(/data-local-image="[^"]+"/,`src="${url}"`));
      }catch(error){html=html.replace(match[0],`<span class="resource-error">图片无法显示：${escapeHtml(href)}（${escapeHtml(error instanceof Error?error.message:String(error))}）</span>`)}
    }
    // Do not turn remote Markdown image URLs into network requests from the daemon.
    html=html.replace(/<img src="(https?:[^\"]+)"[^>]*>/gi,(_match,href)=>{
      warnings.push('网络图片未由主机下载；可点击图片链接在当前设备浏览器查看。');
      return `<p><a href="${href}" target="_blank" rel="noopener noreferrer">在浏览器查看网络图片</a></p>`;
    });
    html=html.replace('</head>',`<style>pre{white-space:pre-wrap;word-break:break-word}table{font-size:13px}th,td{padding:6px;overflow-wrap:anywhere}details:not([open]){display:none}main{padding:20px 18px 36px}.katex-display{overflow:hidden}</style></head>`);
    browser=await BrowserPipe.launch();
    const {targetId}=await browser.send('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await browser.send('Target.attachToTarget',{targetId,flatten:true});
    browser.onEvent=event=>{if(event.method==='Fetch.requestPaused')void browser!.send('Fetch.failRequest',{requestId:event.params.requestId,errorReason:'BlockedByClient'},event.sessionId).catch(()=>{})};
    await browser.send('Browser.setDownloadBehavior',{behavior:'deny'});
    await browser.send('Page.enable',{},sessionId);
    await browser.send('Fetch.enable',{patterns:[{urlPattern:'*'}]},sessionId);
    await browser.send('Emulation.setDeviceMetricsOverride',{width:input.width,height:900,deviceScaleFactor:2,mobile:false},sessionId);
    const {frameTree}=await browser.send('Page.getFrameTree',{},sessionId);
    await browser.send('Page.setDocumentContent',{frameId:frameTree.frame.id,html},sessionId);
    const evaluate=async(expression:string)=>{
      const result=await browser!.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},sessionId);
      if(result.exceptionDetails)throw new Error('移动端预览脚本执行失败。');
      return result.result.value;
    };
    await evaluate(`new Promise((resolve,reject)=>{const start=Date.now();function check(){if(document.documentElement.getAttribute('data-preview-ready')==='true')resolve(true);else if(Date.now()-start>15000)reject(new Error('Diagram timeout'));else setTimeout(check,50)}check()})`);
    await evaluate(`(async()=>{await document.fonts.ready;await Promise.all(Array.from(document.images).map(i=>{i.loading='eager';return i.decode().catch(()=>{})}));
      for(const el of document.querySelectorAll('.katex-display')){const inner=el.querySelector('.katex');if(inner&&inner.getBoundingClientRect().width>el.clientWidth){inner.style.fontSize=(parseFloat(getComputedStyle(inner).fontSize)*el.clientWidth/inner.getBoundingClientRect().width)+'px'}}
      for(const el of document.querySelectorAll('table')){el.style.tableLayout='fixed';el.style.width='100%'}
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return true})()`);
    const geometry=await evaluate(`(()=>{const anchors=Object.create(null);for(const el of document.querySelectorAll('main [id]'))anchors[el.id]=el.getBoundingClientRect().top+scrollY;
      const links=[];for(const el of document.querySelectorAll('main a')){const href=el.getAttribute('data-local-link')||el.getAttribute('href');if(!href)continue;for(const r of el.getClientRects())links.push({x:r.x,y:r.y+scrollY,width:r.width,height:r.height,href,label:el.textContent||href})}
      const paragraphs=Array.from(document.querySelectorAll('main p, main h1, main h2, main h3, main pre, main li')).filter(el=>el.getClientRects().length && !el.closest('details')).map(el=>({y:el.getBoundingClientRect().top+scrollY,text:(el.textContent||'').slice(0,1000)}));
      return {height:Math.ceil(document.documentElement.scrollHeight),anchors,links,paragraphs,warnings:Array.from(document.querySelectorAll('.resource-error')).map(el=>el.textContent||'渲染错误')}})()`);
    if(geometry.height>MAX_HEIGHT)throw new Error('移动端预览过长（超过 24,000 像素），请拆分文档或使用源码视图。');
    if (geometry.height * input.width * 4 > 16000000) throw new Error('移动端预览超过 1,600 万像素，请拆分文档或使用源码视图。');
    const pages:NativePreviewResult['pages']=[];let output=0;
    for(let y=0;y<geometry.height;y+=1000){
      const height=Math.min(1000,geometry.height-y);
      const {data}=await browser.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y,width:input.width,height,scale:1}},sessionId);
      output+=data.length;if(output>MAX_OUTPUT)throw new Error('移动端预览图片超过 8 MiB，请减少图片或拆分文档。');
      pages.push({y,height,uri:`data:image/png;base64,${data}`,text:geometry.paragraphs.filter((p:{y:number})=>p.y>=y&&p.y<y+height).map((p:{text:string})=>p.text).join('\n').slice(0,4000)});
    }
    return {width:input.width,height:geometry.height,pages,links:geometry.links.slice(0,500),anchors:geometry.anchors,warnings:[...new Set<string>([...warnings,...geometry.warnings])].slice(0,32)};
  }finally{try{await browser?.close()}finally{release()}}
}
