import { defineRpc } from '@getpaseo/plugin';
import { z } from 'zod';

export const readResource = defineRpc({
  name: 'markdown.resource',
  input: z.object({
    workspaceId: z.string().min(1),
    sourcePath: z.string().min(1).max(8192),
    href: z.string().min(1).max(8192),
    kind: z.enum(['image', 'document']),
  }),
  output: z.object({ path: z.string(), content: z.string(), modifiedAt: z.string() }),
});
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
