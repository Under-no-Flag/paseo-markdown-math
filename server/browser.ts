// Minimal Chrome DevTools pipe transport. No browser downloads, user profile, or TCP listener.
import {spawn,type ChildProcess} from 'node:child_process';
import {access,mkdtemp,rm} from 'node:fs/promises';
import {constants} from 'node:fs';
import {tmpdir,homedir} from 'node:os';
import path from 'node:path';
import type {Readable,Writable} from 'node:stream';

export async function findBrowser():Promise<string>{
  const explicit=process.env.PASEO_MARKDOWN_BROWSER;
  const candidates=explicit?[explicit]:process.platform==='darwin'?[
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    path.join(homedir(),'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
  ]:process.platform==='win32'?[
    ...[process.env.PROGRAMFILES,process.env['PROGRAMFILES(X86)'],process.env.LOCALAPPDATA].filter(Boolean).flatMap(base=>[path.join(base!,'Google/Chrome/Application/chrome.exe'),path.join(base!,'Microsoft/Edge/Application/msedge.exe')]),
  ]:['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser','/opt/google/chrome/chrome','/usr/bin/microsoft-edge'];
  for(const candidate of candidates){try{await access(candidate,process.platform==='win32'?constants.F_OK:constants.X_OK);return candidate}catch{/* try next */}}
  throw new Error('iOS 预览需要主机已安装 Chrome、Edge 或 Chromium。请在主机安装浏览器，或在启动 Paseo 时设置 PASEO_MARKDOWN_BROWSER 为浏览器可执行文件路径。');
}
export class BrowserPipe {
  private id=0;
  private pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void}>();
  private buffer='';
  private failure:Error|null=null;
  private timer:ReturnType<typeof setTimeout>;
  private exited:Promise<void>;
  onEvent:(event:any)=>void=()=>{};
  private constructor(private child:ChildProcess,private directory:string){
    this.exited=new Promise(resolve=>child.once('close',()=>resolve()));
    const output=child.stdio[4] as Readable;
    output.setEncoding('utf8');output.on('data',(chunk:string)=>{
      this.buffer+=chunk;
      let index:number;
      while((index=this.buffer.indexOf('\0'))>=0){
        const raw=this.buffer.slice(0,index);this.buffer=this.buffer.slice(index+1);
        if(!raw)continue;
        try{const event=JSON.parse(raw);const task=this.pending.get(event.id);
          if(task){this.pending.delete(event.id);if(event.error)task.reject(new Error(`浏览器渲染失败：${event.error.message}`));else task.resolve(event.result)}
          else this.onEvent(event);
        }catch{this.fail(new Error('浏览器返回无效响应。'))}
      }
    });
    child.on('error',()=>this.fail(new Error('无法启动主机浏览器，请检查浏览器路径和执行权限。')));
    child.on('close',()=>this.fail(new Error('主机浏览器已退出。请确认浏览器可在当前主机以正常沙箱模式运行。')));
    (child.stdio[3] as Writable).on('error',()=>this.fail(new Error('浏览器通信已关闭。')));
    this.timer=setTimeout(()=>{this.fail(new Error('移动端预览超过 20 秒，请简化文档后重试。'));child.kill('SIGKILL')},20000);
  }
  static async launch(){
    const executable=await findBrowser();
    const directory=await mkdtemp(path.join(tmpdir(),`paseo-markdown-browser-${process.pid}-`));
    try{return new BrowserPipe(spawn(executable,['--headless=new','--remote-debugging-pipe',`--user-data-dir=${directory}`,'--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--disable-breakpad','--disable-crash-reporter','about:blank'],{stdio:['ignore','ignore','ignore','pipe','pipe'],windowsHide:true}),directory)}
    catch(error){await rm(directory,{recursive:true,force:true});throw error}
  }
  send(method:string,params:Record<string,unknown>={},sessionId?:string):Promise<any>{
    if(this.failure)return Promise.reject(this.failure);
    const id=++this.id;
    return new Promise((resolve,reject)=>{
      this.pending.set(id,{resolve,reject});
      (this.child.stdio[3] as Writable).write(JSON.stringify({id,method,params,...sessionId?{sessionId}:{}})+'\0');
    });
  }
  private fail(error:Error){if(this.failure)return;this.failure=error;for(const item of this.pending.values())item.reject(error);this.pending.clear()}
  async close(){
    clearTimeout(this.timer);
    this.fail(new Error('浏览器渲染已结束。'));
    this.child.kill('SIGKILL');
    await this.exited;
    await rm(this.directory,{recursive:true,force:true,maxRetries:3,retryDelay:200});
  }
}
