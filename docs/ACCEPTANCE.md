# 验收说明

## 自动检查

`npm run check` 构建客户端、服务端、Mermaid iframe 脚本与内嵌字体，运行三组严格类型检查及 27 项单元测试。覆盖公式分隔符、数学围栏、宏隔离、HTML/URL 注入、代码不误解析、Mermaid 源码转义、标题锚点、图片地址、空文档、超限内容，以及真实临时目录中的资源解析、中文编码、缺失文件、大小限制、路径越界和符号链接越界。

`npm run verify:host` 使用安装的 Paseo 0.13.0 编译器生成客户端及服务端 bundle，并在无 DOM 的模拟 native 环境验证客户端模块加载、addFilePanel 注册与 cleanup。不是宿主 UI 或手机实测。

`npm run dev` 后，另一个终端运行 `npm run test:browser`（已安装 Chrome）。测试加载同一编译后的客户端、真实 SDK hooks，以及复用服务端资源函数的本地中间件。结果与截图写入 `test-results/`。会临时修改并在 finally 中恢复示例 `examples/guide/details.md`；若强制终止进程，需检查示例末尾是否留下测试标记。

## Paseo 桌面手工验收

1. 客户端和当前 host 均为 0.13.x，插件 `paseo-markdown-math` 显示 running。
2. 将本仓库作为工作区，打开 `examples/math-demo.md`，选择 **Markdown + Math**。
3. 确认公式、流程图、本地 SVG 显示。展开 Mermaid 源码。
4. 点击「打开详细说明」，确认跳到详细说明标题，时序图与嵌套相对图片正常；点击「← 返回」。
5. 保存当前原文件确认自动更新；打开链接文档后修改目标文件，约 2 秒后应更新。单独更换图片后点击「刷新」。
6. 切换源码/预览和明暗主题；打开外链应出现独立页面。
7. 删除测试副本或引用不存在的图片，确认就地错误提示；恢复后预览应恢复。
8. 用 Open with 切回内置面板，确认原文件未被插件写入。

远程 host 需要单独安装、单独验收。原生移动端只读源码回退。

## 2026-10-25 v0.2 结果

- 验证环境为 macOS，CLI、桌面应用、daemon 均为 0.13.0；插件 reload 返回 running，日志记录 Plugin ready。服务端入口已被实际宿主编译和加载。
- 构建、三组 TypeScript 检查、27/27 单元测试通过。
- 真实 Paseo 编译器、客户端/服务端 bundle、native 安全求值与注册/清理通过。
- 独立浏览器 16/16 组检查通过。覆盖：离线流程图/公式/中文空格路径 SVG；20 个 KaTeX font-face；文内锚点；相对 Markdown 导航/定位/返回；时序图与嵌套图片；链接文件磁盘更新和恢复；当前文档源码/刷新；明暗主题；1280×900 与 390×844 布局；HTTP 图片、外链 opener 隔离；异常图表、缺失图片、HTML 转义、越界链接；原文件变更/删除/恢复；空内容、超限及恢复。
- HTTP 图片与外链用 Playwright 控制的网络响应验证，不代表任意网站可访问。正常示例没有外部请求、页面或控制台错误；负例中的资源请求预期返回 HTTP 400。
- 独立 HTML 演示文件也验证了两个 Mermaid 图表、本地内嵌图片，页面错误为 0。
- Mermaid 时序图文字测量曾在 iframe 初次布局时失败，已增加字体就绪与动画帧等待；后续浏览器检查通过。
- 浏览器测试将异常资源用例放在新页面，避免 Chrome 在多次调整窗口、关闭弹窗和替换 iframe 后出现的点击命中 iframe 容器现象；正常文档鼠标导航与负例导航均分别验证。
- Browser 插件未提供，按前端测试技能使用 Playwright 本机 Chrome。开发页工作区/文件句柄由适配器提供；不能代替真实 daemon 的 RPC 往返或原始文件监听验收。
- 尚未完成：Paseo 桌面中实际选择插件打开 .md 的视觉验收；真实远程工作区与原生手机 UI 未验收。

## v0.2.1 npm 包验证

- 生成资源随 npm 包发布；npm 12 使用 bundleDependencies 固定运行依赖，避免依赖已移除的 shrinkwrap 机制。
- 在仓库外的临时目录安装实际 tgz，使用 `--ignore-scripts --omit=dev --legacy-peer-deps`，模拟 Paseo npm 获取方式。
- 验证生成字体、Mermaid、运行依赖、入口和图片存在；开发页、测试目录及 Vite 未安装。
- manifest 准备步骤确认无需构建；真实 Paseo 编译器成功编译两个入口；客户端注册/清理成功；打包后的服务端 RPC 成功读取示例 SVG。
