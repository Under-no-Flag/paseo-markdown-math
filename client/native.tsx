import {openExternalUrl, useRpc} from '@getpaseo/plugin/client';
import {useEffect, useRef, useState} from 'react';
import {Image, Pressable, ScrollView, Text, View} from 'react-native';
import {nativePreview, type NativePreviewResult} from '../shared/native';
import type {PreviewColors} from './render';
import type {PreviewActions} from './web';

export function NativePreview({text, sourcePath, workspaceId, colors, actions}: {
  text: string; sourcePath: string; workspaceId: string; colors: PreviewColors; actions: PreviewActions;
}) {
  const rpc = useRpc(nativePreview);
  const scroll = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<NativePreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const renderWidth = Math.min(1024, Math.max(280, Math.round(width)));
  const scale = width / renderWidth;
  useEffect(() => {
    if (!width) return;
    if (text.length > 120000) {setResult(null); setError('移动端预览最多支持 120,000 字符，请使用源码视图。'); return}
    let active = true;
    setResult(null); setError(null);
    const timer = setTimeout(() => {
      void rpc({workspaceId, sourcePath, source: text, width: renderWidth, colors, dark: !!actions.dark}).then(
        value => {if (active) setResult(value)},
        cause => {if (active) setError(cause instanceof Error ? cause.message : String(cause))},
      );
    }, 150);
    return () => {active = false; clearTimeout(timer)};
  }, [rpc, workspaceId, sourcePath, text, renderWidth, colors, actions.dark, retry, !!width]);
  const jump = (hash: string) => {
    let id: string;
    try {id = decodeURIComponent(hash.replace(/^#/, ''))} catch {return}
    const y = result?.anchors[id];
    if (y !== undefined) scroll.current?.scrollTo({y: y * scale, animated: true});
  };
  useEffect(() => {if (result && actions.hash) jump(actions.hash)}, [result, actions.hash]);
  const follow = (href: string) => {
    if (href.startsWith('#')) jump(href);
    else if (/^(https?:|mailto:|tel:)/i.test(href)) void openExternalUrl(href).catch(cause => setError(String(cause)));
    else void actions.navigate(href);
  };
  return <View style={{flex: 1, minHeight: 0}} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    {error ? <View style={{padding: 16}}><Text accessibilityRole="alert" style={{color: colors.foreground}}>{error}</Text><Pressable accessibilityRole="button" accessibilityLabel="重试原生预览" onPress={() => setRetry(n => n + 1)}><Text style={{color: colors.accent, paddingVertical: 12}}>重试预览</Text></Pressable></View> : null}
    {!result && !error ? <Text style={{padding: 16, color: colors.muted}}>主机正在渲染公式与图表…</Text> : null}
    {result ? <>
      <Text style={{paddingHorizontal: 12, paddingVertical: 6, color: colors.muted, fontSize: 12}}>双指缩放查看细节 · 复制文字请切换只读源码{result.warnings.length ? ` · ${result.warnings.join('；')}` : ''}</Text>
      <ScrollView ref={scroll} style={{flex: 1}} minimumZoomScale={1} maximumZoomScale={4} bouncesZoom>
        <View style={{width, height: result.height * scale}}>
          {result.pages.map(page => <View key={page.y} style={{position: 'absolute', left: 0, top: page.y * scale, width, height: page.height * scale}}>
            <Image onError={() => setError('预览图无法加载，请重试或切换只读源码。')} source={{uri: page.uri}} resizeMode="stretch" accessibilityLabel={page.text || 'Markdown 公式和图表预览'} style={{width, height: page.height * scale}} />
          </View>)}
          {result.links.map((link, index) => <Pressable key={index} accessibilityRole="link" accessibilityLabel={link.label || link.href} onPress={() => follow(link.href)} style={{position: 'absolute', left: link.x * scale, top: link.y * scale, width: link.width * scale, height: link.height * scale}} />)}
        </View>
      </ScrollView>
    </> : null}
  </View>;
}
