import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, symlink, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {loadResource,resolveResource} from '../server/resources';

async function fixture(run:(root:string,outside:string)=>Promise<void>){
 const outer=await mkdtemp(path.join(tmpdir(),'paseo-math-test-'));
 const root=path.join(outer,'workspace');await mkdir(path.join(root,'docs'),{recursive:true});await mkdir(path.join(root,'assets'));
 await writeFile(path.join(root,'docs','main.md'),'# source');await writeFile(path.join(root,'docs','next.md'),'# linked');
 await writeFile(path.join(root,'assets','图 一.svg'),'<svg xmlns="http://www.w3.org/2000/svg"/>');
 await writeFile(path.join(outer,'secret.md'),'private');
 try{await run(root,outer)}finally{await rm(outer,{recursive:true,force:true})}
}
test('local image resolves relative to source, including encoded Chinese/space and root paths',()=>fixture(async root=>{
 const source=path.join(root,'docs','main.md');
 const image=await loadResource(root,source,'../assets/图%20一.svg','image');assert.match(image.content,/^data:image\/svg\+xml;base64,/);
 const same=await loadResource(root,source,'/assets/图%20一.svg?x=1','image');assert.equal(same.path,image.path);
}));
test('Markdown link strips fragment and query, and loads UTF-8 text',()=>fixture(async root=>{
 const doc=await loadResource(root,path.join(root,'docs/main.md'),'next.md?preview=1#title','document');assert.equal(doc.content,'# linked');
}));
test('traversal, external schemes, UNC paths and malformed encodings are rejected',()=>fixture(async root=>{
 const source=path.join(root,'docs/main.md');
 for(const href of ['../../secret.md','%2e%2e/%2e%2e/secret.md','https://example.com/x','file:///etc/passwd','//host/path','%zz','%00.png'])await assert.rejects(()=>resolveResource(root,source,href));
}));
test('source and target symlinks cannot escape the workspace',()=>fixture(async(root,outer)=>{
 await symlink(path.join(outer,'secret.md'),path.join(root,'secret.md'));
 await assert.rejects(()=>loadResource(root,path.join(root,'docs/main.md'),'../secret.md','document'),/工作区之外/);
 await assert.rejects(()=>loadResource(root,path.join(outer,'secret.md'),'docs/next.md','document'),/当前工作区/);
}));
test('missing files, unsupported formats and image size limits yield errors',()=>fixture(async root=>{
 const source=path.join(root,'docs/main.md');
 await assert.rejects(()=>loadResource(root,source,'missing.png','image'));
 await assert.rejects(()=>loadResource(root,source,'next.md','image'),/图片格式/);
 await writeFile(path.join(root,'assets','large.png'),Buffer.alloc(5*1024*1024+1));
 await assert.rejects(()=>loadResource(root,source,'../assets/large.png','image'),/5 MiB/);
}));
