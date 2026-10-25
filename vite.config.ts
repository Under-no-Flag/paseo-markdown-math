import { defineConfig } from 'vite';
import { loadResource } from './server/resources';
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
        req.on('data', chunk=>{body+=chunk;if(body.length>20000)req.destroy();});
        req.on('end',()=>{void (async()=>{
          try {
            const input=readResource.input.parse(JSON.parse(body));
            if(input.workspaceId!=='dev')throw new Error('Invalid development workspace');
            const result=await loadResource(process.cwd(),input.sourcePath,input.href,input.kind);
            res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
          }catch(error){res.statusCode=400;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:error instanceof Error?error.message:String(error)}));}
        })();});
      });
    },
  }],
});
