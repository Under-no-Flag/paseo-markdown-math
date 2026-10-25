import type { PluginClientContext } from '@getpaseo/plugin/client';
import { MarkdownMathPanel } from './client/panel';

export default function contribute(client: PluginClientContext) {
  return client.addFilePanel({
    id: 'markdown-math',
    title: 'Markdown + Math',
    icon: 'Sigma',
    files: { extensions: ['md', 'markdown', 'mdown', 'mkd'] },
    Component: MarkdownMathPanel,
  });
}
