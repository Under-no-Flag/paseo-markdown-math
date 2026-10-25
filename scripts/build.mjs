import { build } from 'esbuild';
await build({ entryPoints: ['index.client.tsx'], bundle: true, format: 'cjs', platform: 'neutral', mainFields: ['module','main'], target: 'es2020', jsx: 'automatic', supported: {'async-await': false}, external: ['@getpaseo/plugin','@getpaseo/plugin/client','@getpaseo/plugin/client/ui','react','react/jsx-runtime','react-native','zod'], outfile: 'dist/index.client.cjs', metafile: true });
console.log('Client build complete; Paseo recompiles index.client.tsx when installed.');

await build({entryPoints:['index.server.ts'],bundle:true,format:'cjs',platform:'node',target:'node20',external:['@getpaseo/plugin','@getpaseo/plugin/server','zod'],outfile:'dist/index.server.cjs'});
