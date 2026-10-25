# Paseo API 与源码核实

核实日期：2026-10-25（Asia/Shanghai）。读取官方文档、GitHub 源码和 npm 发布包，没有修改或克隆 Paseo 主项目。实现以文档、发布包和源码接口核查为准。

核查时 npm `@getpaseo/plugin` latest/beta 都为 0.13.0。官方 main HEAD 为 `72e3316f4f5dfe775c77dbf998968c92e2de9019`，`v0.13.0` tag ref 为 `eeaa68a965b13fcb268fdea22ffbf330d50e9ea0`。安装的真实编译器和开发 SDK 都为 0.13.0。文档 main 可继续变化；本项目的实际验证以锁文件和安装版本为准。

## 一手资料

- [插件参考：文件面板](https://paseo.sh/docs/plugins/reference#file-panels)：`addFilePanel`、props、文件句柄、读取 hooks、选择器、版本要求。
- [插件开发入口](https://paseo.sh/docs/plugins)：目录创建、安装与 reload。
- [官方 Markdown 示例](https://github.com/getpaseo/paseo/tree/72e3316f4f5dfe775c77dbf998968c92e2de9019/plugin-examples/markdown-panel)：注册、web.ts、预览与源码状态。该示例主要演示 CodeMirror 编辑与冲突处理，不是数学预览实现。
- [官方 PDF 示例](https://github.com/getpaseo/paseo/tree/72e3316f4f5dfe775c77dbf998968c92e2de9019/plugin-examples/pdf-panel)：读取 hook 与 DocumentFrame。
- [SDK 文件句柄与 hooks](https://github.com/getpaseo/paseo/blob/72e3316f4f5dfe775c77dbf998968c92e2de9019/packages/plugin/src/client/file.ts)：读取结果竞态屏蔽、删除与重建事件、卸载时取消订阅。
- [真实插件编译器](https://github.com/getpaseo/paseo/blob/72e3316f4f5dfe775c77dbf998968c92e2de9019/packages/server/src/server/plugins/compiler.ts)：client/server/shared 边界、宿主 external、neutral 平台依赖解析与 bundle 包装。
- [内置文件面板](https://github.com/getpaseo/paseo/blob/72e3316f4f5dfe775c77dbf998968c92e2de9019/packages/app/src/file-panels/builtin.tsx) 及 [Markdown 预览](https://github.com/getpaseo/paseo/blob/72e3316f4f5dfe775c77dbf998968c92e2de9019/packages/app/src/file-panels/markdown-preview/index.tsx)：内置面板也接收同类 file props；使用内部 MarkdownRenderer，插件不能直接依赖私有宿主实现。
- [宿主挂载插件面板](https://github.com/getpaseo/paseo/blob/72e3316f4f5dfe775c77dbf998968c92e2de9019/packages/app/src/file-panels/plugin-host.tsx)：安装上下文与错误边界。
- [KaTeX Markdown 插件](https://mdit-plugins.github.io/katex.html)：delimiters=all、mathFence、KaTeX 配置。
- [KaTeX 选项](https://katex.org/docs/options)：trust、宏展开、尺寸、错误处理。

## 采用的公开契约

1. 默认导出 `contribute(client)`，调用 `client.addFilePanel({id,title,icon,files,Component})`，返回其 cleanup。
2. `files.extensions` 不带点，不区分大小写。
3. `PluginFilePanelProps.file` 由宿主解析，对本机与远程文件都成立。通过 `useFileText(file)` 读取，不自行拼接 daemon URL 或访问 Node fs。
4. `useFileText` 跟随文件变更，处理删除/重建与过期异步结果。源码/预览模式由 `useTabState` 持久化。
5. 文件面板 API 要求 app 与 daemon 均至少 0.13.0。不能只升级 CLI。
6. 主入口与 client/ 下的实现遵循模块边界。DOM 只在 web.ts 中受平台检查后执行。
7. 选择器与 Open with 由 Paseo 管理；插件不私自修改文件关联。

## 渲染容器选择

`DocumentFrame` 公开 API 接收宿主 `PluginFile.url()` 的本地文件 URL，没有公开的 HTML 字符串 prop。本插件需要展示“由 Markdown 计算出的 HTML”，因此沿用官方 Markdown 示例的 web.ts DOM 适配模式，在 React Native Web 的 View 中挂载静态隔离 iframe。移动端明确回退为源码，不假冒 DocumentFrame 或私有 SDK 接口。

主项目内置渲染是否支持所有公式，不是本插件的运行前提。本次没有声称完整审计内置 MarkdownRenderer 的所有语法分支。

## v0.2 图片、链接与 Mermaid 补充核实

- SDK 0.13 的公开导航只提供打开浏览器、agent、workspace，没有 `openFile`。因此相对 Markdown 文档在本面板内浏览，并实现返回；不调用宿主私有文件标签接口。
- [官方 RPC 文档](https://paseo.sh/docs/plugins/reference)：共享 `defineRpc` 契约，客户端 `useRpc`，服务端 `server.handle`；请求上下文提供 `paseo`。服务端通过 `paseo.workspaces.ref(workspaceId)` 与 `refresh()` 获取 `directory`，再做普通文件的只读读取。这些调用已对照安装的 0.13.0 `.d.ts` 检查。
- 原始文件继续使用宿主 `PluginFile` / `useFileText`；相对文档缺少公开的创建新 PluginFile 接口，采用只针对当前显示文档的 2 秒轮询。服务器资源路径与操作系统使用对应 daemon 的 Node path，不把远程路径当成本机路径。
- [Mermaid securityLevel](https://mermaid.js.org/config/schema-docs/config-properties-securitylevel.html) 与 [配置接口](https://mermaid.js.org/config/setup/mermaid/interfaces/MermaidConfig.html)：采用 strict、禁用自动启动、限制文本/边数量，并保护安全配置不被文档指令覆盖。
- [Mermaid 配置方式](https://mermaid.js.org/config/configuration)：构建时打包 JavaScript；只在 iframe 的 nonce 脚本内初始化/渲染。宿主 native 求值不会访问 DOM。
- Mermaid 依赖锁定 12.2.0；渲染新增脚本，因此 v0.1 的“完全无脚本 iframe”描述已替换为 CSP nonce + 不允许同源访问的 iframe。HTTP 图片经用户文档中的 URL 直接加载，不经过服务端下载代理。
