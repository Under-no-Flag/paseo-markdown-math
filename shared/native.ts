import {defineRpc} from '@getpaseo/plugin';
import {z} from 'zod';
export const nativeColors = z.object({background:z.string().max(80),foreground:z.string().max(80),muted:z.string().max(80),border:z.string().max(80),accent:z.string().max(80),codeBackground:z.string().max(80)});
export const nativePreview = defineRpc({
  name:'markdown.native-preview',
  input:z.object({workspaceId:z.string().min(1),sourcePath:z.string().min(1).max(8192),source:z.string().max(120000),width:z.number().int().min(280).max(1024),colors:nativeColors,dark:z.boolean(),page:z.number().int().min(0).max(10000).default(0)}),
  output:z.object({width:z.number(),height:z.number(),totalHeight:z.number(),page:z.number(),pageCount:z.number(),startY:z.number(),pageStarts:z.array(z.number()),pages:z.array(z.object({y:z.number(),height:z.number(),uri:z.string(),text:z.string()})),links:z.array(z.object({x:z.number(),y:z.number(),width:z.number(),height:z.number(),href:z.string(),label:z.string()})),anchors:z.record(z.string(),z.number()),warnings:z.array(z.string())}),
});
export type NativePreviewResult=z.infer<typeof nativePreview.output>;
