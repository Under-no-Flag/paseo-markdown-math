import type { PluginServerContext } from '@getpaseo/plugin/server';
import { readResource } from './shared/resources';
import { loadResource } from './server/resources';

export default function contribute(server: PluginServerContext) {
  server.handle(readResource, async (input, { paseo }) => {
    const workspace = paseo.workspaces.ref(input.workspaceId);
    await workspace.refresh();
    if (!workspace.directory) throw new Error('工作区不可用，无法读取相对资源。');
    return loadResource(workspace.directory, input.sourcePath, input.href, input.kind);
  });
  return () => {};
}
