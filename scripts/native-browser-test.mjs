// React Native component through RN Web + real SDK hooks and host renderer.
// This is not an iPhone/WKWebView test. Browser plugin not available: use Playwright.
import {chromium, expect} from '@playwright/test';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve(process.env.NATIVE_EVIDENCE_DIR||'../../work/native-qa');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[],consoleErrors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
const ready=()=>page.getByText('双指缩放查看细节',{exact:false}).waitFor({timeout:30000});
const pass=name=>{checks.push(name);console.log('PASS '+name)};
const apply=async text=>{await page.getByRole('textbox',{name:'模拟磁盘文件内容'}).fill(text);await page.getByRole('button',{name:'应用变更',exact:true}).click();await ready()};
try{
 await page.goto('http://127.0.0.1:5173/?native');await ready();
 await expect(page).toHaveTitle(/Paseo Markdown/);expect(page.url()).toContain('?native');await expect(page.locator('vite-error-overlay')).toHaveCount(0);await expect(page.locator('iframe')).toHaveCount(0);
 await expect.poll(()=>page.locator('img').evaluateAll(images=>images.length>0&&images.every(img=>img.complete&&img.naturalWidth>0))).toBe(true);
 await page.screenshot({path:path.join(out,'native-formulas.png')});pass('identity, nonblank native branch, PNG loaded, no iframe or framework overlay at 390px');
 const local=page.getByRole('link',{name:'打开详细说明',exact:true});await local.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'native-mermaid.png')});
 await page.getByRole('link',{name:'跳回行内公式'}).click();await expect(page.getByRole('img').first()).toBeVisible();pass('native anchor link responds');
 await local.click();await ready();await expect(page.getByRole('button',{name:'返回上一文档'})).toBeVisible();await expect(page.getByRole('img').first()).toHaveAttribute('alt',/链接目标文档/);
 await page.screenshot({path:path.join(out,'native-sequence.png')});pass('local Markdown link, sequence diagram and nested image');
 await page.getByRole('button',{name:'只读源码',exact:true}).click();await expect(page.getByText('# 链接目标文档',{exact:false})).toBeVisible();await expect(page.getByRole('img')).toHaveCount(0);
 await page.getByRole('button',{name:'公式预览',exact:true}).click();await ready();await page.getByRole('button',{name:'重新读取文件'}).click();await ready();pass('source/preview toggle and refresh');
 await page.getByRole('button',{name:'返回上一文档'}).click();await ready();await expect(page.getByRole('button',{name:'返回上一文档'})).toHaveCount(0);
 await page.getByRole('button',{name:'切换明暗'}).click();await ready();await page.getByRole('link',{name:'打开详细说明'}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'native-dark.png')});pass('back and dark theme');
 await page.setViewportSize({width:900,height:900});await ready();await expect.poll(()=>page.locator('img').first().evaluate(img=>img.naturalWidth)).toBe(1800);pass('width change re-renders at 2x resolution');
 expect(errors).toEqual([]);expect(consoleErrors).toEqual([]);pass('normal flow has no JavaScript or console errors');
 await page.getByRole('button',{name:'模拟文件变更'}).click();await apply('# Changed\n\n$z^3$\n\n[外链](https://native-preview.invalid/target)');
 await expect(page.getByRole('img').first()).toHaveAttribute('alt',/Changed/);
 await page.context().route('https://native-preview.invalid/target',r=>r.fulfill({body:'External'}));
 const opened=page.waitForEvent('popup');await page.getByRole('link',{name:'外链'}).click();const popup=await opened;await popup.waitForLoadState();expect(await popup.evaluate(()=>opener===null)).toBe(true);await popup.close();pass('file watch and external link through SDK adapter');
 await page.getByRole('button',{name:'模拟删除'}).click();await expect(page.getByRole('alert')).toContainText('文件已删除');await page.getByRole('button',{name:'恢复文件'}).click();await ready();pass('deleted and recreated source');
 // One failure then retry: deterministic RPC failure, independent of installed browser.
 let failed=false;await page.route('**/__markdown_resource',async route=>{const data=route.request().postDataJSON();if(data.method==='markdown.native-preview'&&!failed){failed=true;await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'测试：主机缺少 Chrome 浏览器'})})}else await route.continue()});
 await page.getByRole('button',{name:'重新读取文件'}).click();await expect(page.getByRole('alert')).toContainText('缺少 Chrome');await page.getByRole('button',{name:'重试原生预览'}).click();await ready();pass('host error visible, explicit retry recovers');
 // Superseded response must never replace newer file contents.
 await page.route('**/__markdown_resource',async route=>{const data=route.request().postDataJSON();if(data.input?.source?.includes('STALE_MARKER')){await new Promise(r=>setTimeout(r,1500));await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'STALE_MARKER'})})}else await route.fallback()});
 await page.getByRole('textbox',{name:'模拟磁盘文件内容'}).fill('# STALE_MARKER');await page.getByRole('button',{name:'应用变更',exact:true}).click();await page.waitForTimeout(300);await apply('# Current version\n\n$x^2$');await page.waitForTimeout(1600);await expect(page.getByRole('img').first()).toHaveAttribute('alt',/Current version/);await expect(page.getByRole('alert')).toHaveCount(0);pass('stale async response ignored');
 expect(errors).toEqual([]);await writeFile(path.join(out,'results.json'),JSON.stringify({checks,errors,consoleErrors,scope:'React Native Web adapter, actual SDK hooks and headless Chrome renderer; not physical iOS'},null,2));
}finally{await browser.close()}
