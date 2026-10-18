# 工具高亮、Thinking 间距与组件拆分

沿用已确认的「对话书页」方向和 HeroUI 工具卡片：阅读内容优先，轻量状态行保持安静。此次只修局部视觉和整理用户指定的两个页面，不探索新方向。

## 本次修改

- 读取工具按 args.path / args.file_path（缺少时用 label）的文件后缀选择已支持的 Prism 语言；Go、TypeScript、Rust、JSON、TOML 等与 Markdown、diff 共用 Highlight。命令日志、错误与未知文件保留原文。参数 JSON 同样高亮。
- 工具参数与输出复用 ToolCode，继续保留固定圆角背景、内层 ScrollShadow 和代码区内部滚动。
- Thinking 到后续 Markdown 的入口间距从 16px 收紧为 8px，覆盖纯文字、代码、标题、次级标题和列表。工具到后续回复仍为 16px，连续 assistant 仍为 12px，用户轮次仍为 32px。
- Conversation.tsx：585 → 103 行。拆出 MessageView、ReplyContent、ToolCall、ToolCode、Diff、Highlight，保留原有展开选择、分组顺序、滚动和流式状态。
- SettingsPage.tsx：363 → 36 行。按外观、通用、扩展、连接四个区块拆分，复用 SettingsSection 与 SettingsSwitch；原有草稿同步和保存/重连流程原样迁移。
- HeroUI Disclosure、Spinner、ScrollShadow 继续复用；沿用原有动效，没有新增装饰动效，没有删改界面文案。未新增依赖。

## 检查

主 Agent 局部视觉自检 1 轮，未做独立评审。查看了浅色、Nord 深色、窄容器、200% 下的间距与代码。窄容器使用 390px 根容器（扣除内边距后面板 354px），未模拟浏览器断点；聊天横向溢出为 0。

按照已安装 React 最佳实践检查：组件均为模块级声明，状态留在所属区块，工具回调与键保持稳定，代码高亮沿用 memo，无新请求/副作用。保留 HeroUI 可访问标签与键盘展开能力。

| 浏览器验证                                                                        | 第 1 轮 | 第 2 轮 | 第 3 轮 |
| --------------------------------------------------------------------------------- | ------- | ------- | ------- |
| 语言高亮 / JSON 参数 / 未知语言原文                                               | 通过    | 通过    | 通过    |
| Thinking 5 种后续内容 / 展开 / 8px 边界                                           | 通过    | 通过    | 通过    |
| 工具分组 / 键盘 / 子项展开 / 错误 / 流式完成                                      | 通过    | 通过    | 通过    |
| Markdown / 复制 / 换行 / 流式选择保留                                             | 通过    | 通过    | 通过    |
| 对话与工具 ScrollShadow / 固定表面边界                                            | 通过    | 通过    | 通过    |
| 设置主题 / 配色 / 扩展开关 / 保存 / 刷新读回 / 存储失败保留草稿 / 恢复 / 忙碌禁用 | 通过    | 通过    | 通过    |

类型检查、lint、git diff --check 均通过。遵循 oil-ui 范围，没有运行生产构建和全量测试。

验证通过设计 fixture 加载实际组件与 store，设置使用单独 sessionStorage，不改真实应用偏好。存储失败由 fixture 注入；未连接真实 Pi 会话，也未调用模型服务；真实 Pi 重连流程本次未做端到端验证。

## 文件

- after-light.png / after-dark.png：实际组件的工具高亮与间距，内容为验证数据。
- after-200.png / output-200.png：200% 显示。
- narrow.png：窄容器。
- settings.png：拆分后设置页。
- results.json：各检查 3 轮结果。
- verify-highlight.mjs / verify-settings.mjs：本次验证脚本，其他回归复用上级目录现有脚本。
