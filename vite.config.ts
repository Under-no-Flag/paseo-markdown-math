import { defineConfig } from 'vite';
import { loadResource } from './server/resources';
import {renderNative} from './server/native';
import {nativePreview} from './shared/native';
import { readResource } from './shared/resources';

export default defineConfig({
  define: { __DEV_PROJECT_ROOT__: JSON.stringify(process.cwd()) },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  plugins: [{
    name: 'markdown-resource-development-adapter',
    configureServer(server) {
      server.middlewares.use('/__markdown_resource', (req, res) => {
        const origin = req.headers.origin;
        if (req.method !== 'POST' || (origin && origin !== `http://${req.headers.host}`)) {res.statusCode=403;res.end();return;}
        let body='';
        req.on('data', chunk=>{body+=chunk;if(body.length>800000)req.destroy();});
        req.on('end',()=>{void (async()=>{
          try {
            const request=JSON.parse(body);
            const input=(request.method===nativePreview.name?nativePreview:readResource).input.parse(request.input);
            if(input.workspaceId!=='dev')throw new Error('Invalid development workspace');
            const result='source' in input ? await renderNative(process.cwd(),input) : await loadResource(process.cwd(),input.sourcePath,input.href,input.kind);
            res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
          }catch(error){res.statusCode=400;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:error instanceof Error?error.message:String(error)}));}
        })();});
      });
    },
  }],
});
