// Standalone, offline demonstration. Linked example is appended as an anchor target.
import {readFile,writeFile} from 'node:fs/promises';
import {createDocument} from '../client/render';
let source=await readFile('examples/math-demo.md','utf8');
let linked=await readFile('examples/guide/details.md','utf8');
source=source.replace('./guide/details.md#详细说明','#详细说明');
linked=linked.replace('../math-demo.md#mermaid-图表','#mermaid-图表');
const image=await readFile('examples/assets/流程 示意.svg');
const html=createDocument(source+'\n\n---\n\n'+linked).replace(/data-local-image="[^"]+"/g,`src="data:image/svg+xml;base64,${image.toString('base64')}"`);
await writeFile('../markdown-math-demo.html',html);
console.log('Wrote ../markdown-math-demo.html (self-contained offline demo)');
