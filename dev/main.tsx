// Development-only adapter. The plugin uses the real SDK file/tab hooks and its compiled bundle.
import React, {useMemo, useState} from 'react';
import * as jsx from 'react/jsx-runtime';
import {createRoot} from 'react-dom/client';
import * as RN from 'react-native-web';
import * as zod from 'zod';
import * as fileHooks from '../node_modules/@getpaseo/plugin/dist/client/file.js';
import {defineRpc} from '../node_modules/@getpaseo/plugin/dist/rpc.js';
import * as rpcHooks from '../node_modules/@getpaseo/plugin/dist/client/rpc-context.js';
import * as tabHooks from '../node_modules/@getpaseo/plugin/dist/client/tab.js';
import code from '../dist/index.client.cjs?raw';
import demo from '../examples/math-demo.md?raw';
import type {PluginFile, PluginFileEvent, PluginFilePanelProps} from '@getpaseo/plugin/client';

const modules = {'@getpaseo/plugin':{defineRpc},react:React,'react/jsx-runtime':jsx,'react-native':RN,zod,'@getpaseo/plugin/client':{...fileHooks,...tabHooks,...rpcHooks},'@getpaseo/plugin/client/ui':{Loading:()=> <RN.Text style={{padding:16}}>正在读取…</RN.Text>}};
const mod={exports:{}};
new Function('require','module','exports',code)((id:string)=>{if(!(id in modules))throw new Error(`Unknown host module ${id}`);return modules[id as keyof typeof modules]},mod,mod.exports);
let Panel: React.ComponentType<PluginFilePanelProps>;
(mod.exports as any).default({addFilePanel:({Component}:any)=>{Panel=Component;return ()=>{}}});
let currentText=demo;
let uploaded = false;
let gone=false;
const listeners=new Set<(event:PluginFileEvent)=>void>();
const file:PluginFile={path:__DEV_PROJECT_ROOT__+'/examples/math-demo.md',name:'math-demo.md',extension:'md',get size(){return currentText.length},modifiedAt:'',mimeType:'text/markdown',
 async readText(){await new Promise(r=>setTimeout(r,30));if(gone)throw new fileHooks.PluginFileDeletedError();return currentText},
 async readBytes(){return new TextEncoder().encode(await file.readText())},async url(){throw new Error('Preview does not use file.url')},
 async writeText(){throw new Error('Read-only preview must never write')},async writeBytes(){throw new Error('Read-only preview must never write')},
 watch(listener){listeners.add(listener);return ()=>{listeners.delete(listener)}}};
const emit=(type:PluginFileEvent['type'])=>listeners.forEach(fn=>fn({type}));
const light={surface0:'#ffffff',surface1:'#f4f6f8',foreground:'#20252b',foregroundMuted:'#66717e',border:'#dce2e8',accent:'#226a9e',statusDanger:'#c24040'};
const dark={surface0:'#191e25',surface1:'#252d37',foreground:'#e5eaf0',foregroundMuted:'#a2adba',border:'#3a4552',accent:'#8ecbff',statusDanger:'#ff9696'};
function App(){
 const [isDark,setDark]=useState(false);
 const [edit,setEdit]=useState(false);
 const [draft,setDraft]=useState(demo);
 const [state,setState]=useState<unknown>(null);
 const tab=useMemo(()=>({state,setState,setModified:(modified:boolean)=>{if(modified)throw new Error('Preview must never modify the tab')}}),[state]);
 const theme=useMemo(()=>({colors:isDark?dark:light}),[isDark]);
 const apply=(text:string)=>{currentText=text;gone=false;emit('changed')};
 return <>
  <header className="dev-tools"><strong>Paseo 插件 · 独立开发预览</strong><label>打开 .md <input aria-label="打开 Markdown 文件" type="file" accept=".md,.markdown,.mdown,.mkd" onChange={async e=>{const f=e.target.files?.[0];if(f){const t=await f.text();uploaded=true;setDraft(t);apply(t)}}}/></label><button onClick={()=>setDark(v=>!v)}>切换明暗</button><button onClick={()=>setEdit(v=>!v)}>模拟文件变更</button><button onClick={()=>{gone=true;emit('deleted')}}>模拟删除</button><button onClick={()=>apply(draft)}>恢复文件</button></header>
  {edit?<section><textarea aria-label="模拟磁盘文件内容" className="dev-editor" value={draft} onChange={e=>setDraft(e.target.value)}/><div className="dev-tools"><span>仅模拟 file.watch 事件，不写入磁盘。</span><button onClick={()=>apply(draft)}>应用变更</button></div></section>:null}
  <Panel {...{file,tab,theme,layout:{platform:'web',compact:false},params:{path:file.path},workspaceId:'dev',revision:0,host:{id:'dev'}} as unknown as PluginFilePanelProps}/>
 </>;
}
async function invoke(_method:string,input:unknown){
 if(uploaded)throw new Error('浏览器选择的文件不提供目录访问；请在 Paseo 内打开以读取相对资源，或刷新开发页恢复项目示例。');
 const response=await fetch('/__markdown_resource',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
 const data=await response.json();if(!response.ok)throw new Error(data.error);return data;
}
createRoot(document.getElementById('root')!).render(<rpcHooks.PluginRpcProvider invoke={invoke}><App/></rpcHooks.PluginRpcProvider>);
