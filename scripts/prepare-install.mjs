// npm artifacts ship generated assets; Git checkouts prepare them once.
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const generated=['shared/generated/katex-css.ts','shared/generated/frame-runtime.ts'];
if(generated.every(file=>existsSync(file))){
  console.log('Prebuilt preview assets are present; no installation build is needed.');
}else{
  if(!existsSync('scripts/build-assets.mjs'))throw new Error('Incomplete npm package: generated preview assets are missing. Reinstall a complete published version.');
  const npm=process.platform==='win32'?'npm.cmd':'npm';
  execFileSync(npm,['ci','--include=dev','--ignore-scripts','--no-audit','--no-fund'],{stdio:'inherit',shell:process.platform==='win32'});
  execFileSync(npm,['run','assets'],{stdio:'inherit',shell:process.platform==='win32'});
}
