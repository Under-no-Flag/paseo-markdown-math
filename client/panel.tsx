import { PluginFileDeletedError, useFileText, useTabState, useRpc, type PluginFilePanelProps } from '@getpaseo/plugin/client';
import { Loading } from '@getpaseo/plugin/client/ui';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { z } from 'zod';
import type { PreviewColors } from './render';
import { mountPreview, type PreviewHandle, type PreviewActions } from './web';
import { readResource } from '../shared/resources';

const viewSchema = z.object({ view: z.enum(['preview', 'source']) });
const defaultView = { view: 'preview' } as const;

function Preview({ text, colors, actions }: { text: string; colors: PreviewColors; actions: PreviewActions }) {
  const parent = useRef<View>(null);
  const handle = useRef<PreviewHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onReady = useCallback(() => setReady(true), []);
  useLayoutEffect(() => {
    setReady(false);
    setError(null);
    try {
      handle.current = mountPreview(parent.current, text, colors, onReady, actions);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
    return () => { handle.current?.destroy(); handle.current = null; };
  }, [text, colors, onReady, actions]);
  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <View ref={parent} style={{ flex: 1, minHeight: 0 }} />
      {error ? <Text accessibilityRole="alert" style={{ color: colors.foreground, padding: 16 }}>{error}</Text> : !ready ? <Loading /> : null}
    </View>
  );
}

function FileContent(props: PluginFilePanelProps & { view: 'preview' | 'source'; linked?: {text:string}; actions: PreviewActions }) {
  const original = useFileText(props.file);
  const state = props.linked ? {status:'ready' as const, text:props.linked.text} : original;
  const colors = useMemo<PreviewColors>(() => ({
    background: props.theme.colors.surface0,
    foreground: props.theme.colors.foreground,
    muted: props.theme.colors.foregroundMuted,
    border: props.theme.colors.border,
    accent: props.theme.colors.accent,
    codeBackground: props.theme.colors.surface1,
  }), [props.theme]);
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <Text accessibilityRole="alert" style={{ color: props.theme.colors.statusDanger, padding: 16 }}>{state.error instanceof PluginFileDeletedError ? '文件已删除；重新创建后会自动刷新。' : `无法读取文件：${state.error.message}`}</Text>;
  if (props.view === 'source' || props.layout.platform !== 'web') return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
      {props.layout.platform !== 'web' ? <Text style={{ color: colors.muted, marginBottom: 12 }}>公式预览支持 Paseo 桌面端与 Web；此设备显示只读源码。</Text> : null}
      <Text selectable style={{ color: colors.foreground, fontFamily: 'monospace', lineHeight: 23 }}>{state.text || '（空文件）'}</Text>
    </ScrollView>
  );
  return <Preview text={state.text} colors={colors} actions={props.actions} />;
}

export function MarkdownMathPanel(props: PluginFilePanelProps) {
  return <Panel key={props.file.path} {...props} />;
}
function Panel(props: PluginFilePanelProps) {
  const [state, setState] = useTabState(props.tab, viewSchema, defaultView);
  const [refresh, setRefresh] = useState(0);
  const rpc = useRpc(readResource);
  const [history, setHistory] = useState<Array<{path:string;text:string;hash:string;request:{sourcePath:string;href:string}}>>([]);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const current = history[history.length - 1];
  const currentPath = current?.path || props.file.path;
  useEffect(() => () => { generation.current++; }, []);
  const navigate = useCallback(async (href: string) => {
    const version = ++generation.current;
    setBusy(true); setNavigationError(null);
    try {
      const result = await rpc({workspaceId: props.workspaceId, sourcePath: currentPath, href, kind: 'document'});
      if (version !== generation.current) return;
      const hash = href.includes('#') ? href.slice(href.indexOf('#')) : '';
      setHistory(items => [...items, {path:result.path,text:result.content,hash,request:{sourcePath:currentPath,href}}]);
    } catch (error) {
      if (version === generation.current) setNavigationError(error instanceof Error ? error.message : String(error));
    } finally { if (version === generation.current) setBusy(false); }
  }, [rpc, props.workspaceId, currentPath]);
  // Linked documents do not have a PluginFile handle in the public SDK: poll only the displayed document.
  useEffect(() => {
    if (!current) return;
    let active = true;
    let pending = false;
    const poll = async () => {
      if (pending) return; pending = true;
      try {
        const result = await rpc({workspaceId:props.workspaceId,...current.request,kind:'document'});
        if (active) {
          setHistory(items => items.map((item,index) => index === items.length - 1 && item.path === result.path && item.text !== result.content ? {...item,text:result.content} : item));
          setNavigationError(null);
        }
      } catch (error) { if (active) setNavigationError(error instanceof Error ? error.message : String(error)); }
      finally { pending = false; }
    };
    void poll();
    const interval = setInterval(() => { void poll(); }, 2000);
    return () => { active = false; clearInterval(interval); };
  }, [current?.path, current?.request, rpc, props.workspaceId, refresh]);
  const loadImage = useCallback(async (href: string) => (await rpc({workspaceId:props.workspaceId,sourcePath:currentPath,href,kind:'image'})).content, [rpc,props.workspaceId,currentPath]);
  const actions = useMemo<PreviewActions>(() => ({loadImage,navigate:href=>{void navigate(href)},hash:current?.hash,
    dark: /^#(?:[01][0-9a-f]|2[0-9a-f]){3}$/i.test(props.theme.colors.surface0),
  }), [loadImage,navigate,current?.hash,props.theme.colors.surface0]);
  const back = () => { generation.current++;setBusy(false);setNavigationError(null);setHistory(items=>items.slice(0,-1)); };
  const reload = () => setRefresh(n=>n+1);
  return (
    <View style={{ flex: 1, minHeight: 0, backgroundColor: props.theme.colors.surface0 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 18, padding: 12, borderBottomWidth: 1, borderBottomColor: props.theme.colors.border }}>
        {(['preview', 'source'] as const).map(view => (
          <Pressable key={view} accessibilityRole="button" accessibilityLabel={view === 'preview' ? '公式预览' : '只读源码'} accessibilityState={{ selected: state.view === view }} onPress={() => setState({ view })}>
            <Text style={{ color: state.view === view ? props.theme.colors.accent : props.theme.colors.foreground, fontWeight: state.view === view ? '600' : '400' }}>{view === 'preview' ? '公式预览' : '只读源码'}</Text>
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" accessibilityLabel="重新读取文件" onPress={reload}><Text style={{ color: props.theme.colors.foreground }}>刷新</Text></Pressable>
        {current ? <Pressable accessibilityRole="button" accessibilityLabel="返回上一文档" onPress={back}><Text style={{color:props.theme.colors.accent}}>← 返回</Text></Pressable> : null}
        <Text style={{ color: props.theme.colors.foregroundMuted, fontSize: 12 }}>{busy ? '正在打开…' : current ? current.path.split(/[\\/]/).pop() : 'Markdown + Math · 自动同步'}</Text>
      </View>
      {navigationError ? <Text accessibilityRole="alert" style={{color:props.theme.colors.statusDanger,padding:10}}>{navigationError}</Text> : null}
      <FileContent key={`${props.file.path}:${refresh}`} {...props} view={state.view} linked={current} actions={actions} />
    </View>
  );
}
