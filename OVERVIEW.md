# Markdown + Math

在 Paseo 中阅读已有 Markdown，支持 KaTeX 公式、Mermaid 图表、本地/HTTP(S) 图片、标题锚点、外链和相对 Markdown 文档导航。

- 文件标签页选择 **Open with → Markdown + Math**。
- 相对路径以当前文档为基准；点击「← 返回」回到上一文档。
- 原文件保存后自动刷新；链接文档每 2 秒检查更新；单独修改图片后点击「刷新」。
- 字体和图表依赖本地打包，无需 Canvas、CDN 或 TeX 安装。
- 只读源码、手动刷新、明暗主题适配。
- 本地资源只读、限定当前工作区。完整 LaTeX、TikZ 和 MDX 不支持。
- 桌面/Web 预览；iOS 原生公式与 Mermaid 图像预览、双指缩放。
- 长文档按需分页，支持上一页、下一页和跨页标题定位，避免整篇截图超限。
- 移动端预览要求对应主机已安装 Chrome/Edge/Chromium；网络图片作为链接打开，复制文字使用源码视图。
- 主机渲染及原生分支适配器已验证；iPhone 真机手势仍待验收。

需要 Paseo 客户端和 daemon 0.13.x，各 host 分别安装。详见 README。
