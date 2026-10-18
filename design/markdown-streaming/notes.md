# Chat Markdown 与流式渲染适配

北极星：延续已确认的对话书页；回复内容是主角，排版接近 HeroUI Pro Markdown，字号与颜色服从当前项目。

## 官方对照

已通过浏览器查看官方文档和实际示例：

- https://heroui.pro/docs/react/components/markdown
- https://heroui.pro/docs/react/demos/markdown-default?theme=light
- https://heroui.pro/docs/react/demos/markdown-with-streamdown?theme=light

官方默认示例使用 20px h1、18px h2、14px 正文、语言标签与复制按钮；Streaming 说明强调按块缓存；With Streamdown 使用开源 Streamdown 提供未闭合语法修复、动画与流式光标。

原实现是 react-markdown + 自定义样式，视觉方向接近，但 h1/h2 同为 18px，任务列表、分隔线、图片与表格样式不完整；流式仅靠自定义 CSS 光标，缺少对应解析及缓存能力。

## 已交付

- 真实接入 Streamdown 2.7.0 的流式块渲染、语法修复和 memoization；保持同一个渲染器处理 Thinking 与正文。
- 使用现有 HeroUI Button / ScrollShadow 与 Prism 实现代码和表格；没有引入 @heroui-pro/react。原 react-markdown / remark-gfm 直接依赖已移除，GFM 由 Streamdown 内置支持。
- h1/h2/h3/h4–h6 为 20/18/16/15px。正文保持项目的 15px/1.7，未照搬默认示例的 14px，优先保证中文阅读。
- 表格有圆角、细边框与表头背景，保留 Markdown 的左/中/右列对齐；横向滚动与渐隐只在内层发生。
- 完善只读任务列表、嵌套列表、分隔线和图片宽度约束；保留行内代码、引用和外链。
- 流式末块采用 150ms fadeIn 与原生块状光标。完成后无动画 span 与光标；减少动态效果时通过 hook 和 CSS 关闭渐显。
- 保留 Thinking 到回复 8px、工具到回复 16px、连续 assistant 12px；Markdown 首尾块不叠加边距。
- 没有改动界面文案、RPC 流程、工具状态、主题变量；没有添加数学和 Mermaid 插件等本次未要求的功能。未复制 Pro 私有组件源码。

## 验证

局部视觉自检 1 轮，主 Agent 执行，未独立评审。查看浅色、Nord 深色、200% 与 320px 容器；窄容器聊天横向溢出 0，表格在自身容器产生 45px 可滚动区域，未验证独立的浏览器窄视口断点。

| 检查                                                   | 第 1 轮 | 第 2 轮 | 第 3 轮 |
| ------------------------------------------------------ | ------- | ------- | ------- |
| Markdown 排版、任务状态、列对齐、代码原文、复制        | 通过    | 通过    | 通过    |
| 流式粗体修复、未闭合代码围栏、高亮、链接补齐、结束清理 | 通过    | 通过    | 通过    |
| Thinking 五种入口间距、展开/收起                       | 通过    | 通过    | 通过    |
| 既有 Chat 换行、复制、流式选择保留                     | 通过    | 通过    | 通过    |
| 工具分组、子项展开、错误和流式完成                     | 通过    | 通过    | 通过    |
| 对话/工具 ScrollShadow 与固定边界                      | 通过    | 通过    | 通过    |

类型检查、lint、差异检查通过；按 skill 未运行生产构建与全量测试。浏览器是实际组件与 store 的 fixture，用按键推动真实流式 reducer，没有连接模型服务。减少动态效果分支已检查实现，未通过浏览器媒体偏好覆盖做交互验证。

## 证据

- after-light.png、after-content.png、after-dark.png：完成后的排版。
- streaming-text.png、streaming-code.png：真实流式解析的两个中间状态。
- after-200.png、narrow.png：放大与窄容器。
- verify.mjs、results.json：本次验证脚本与三轮结果。
- regressions.json：复用现有验证脚本的三轮回归结果。

参考：Streamdown 官方 configuration / components / animation 文档，https://streamdown.ai/docs/ 。截图内容为验证数据。
