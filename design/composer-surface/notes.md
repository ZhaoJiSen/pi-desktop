# 输入区改为表面

空会话的主角仍是 Pi 标记。输入区跟着 HeroUI 字段和 ChatGPT、Claude、Gemini 的写法：形状来自填充或投影，不来自描边。状态行写在表面上方。

## 参照

- HeroUI 字段默认 `--field-border: transparent`、`--field-border-width: 0`。浅色用白底加 `--field-shadow`（含一层 1px 投影），深色去掉投影，靠比页面更亮的填充分开。聚焦是字段自己的状态，不把边框换成另一条线。
- ChatGPT、Claude、Gemini 的首屏输入都是圆角表面。模型、附件和发送在表面里面。用量和分支不压在边缘上，也不做成 fieldset 的缺口。

## 改动

- 去掉 `1px solid var(--frame)`。浅色表面用投影从白底抬起；页面本身是白的，所以投影比 HeroUI 小字段略长，否则表面会消失。深色表面比画布亮一阶，不用投影。
- 悬停和编辑器聚焦共用略亮的填充（深色）或略深的投影（浅色）。光标是焦点提示。空会话会自动聚焦，实线焦点环会把表面又画成输入框。
- 分支、上下文、token 和费用改到表面上方右对齐，不再用底色切断边缘。
- 深色里圆形附件比表面再亮一阶，避免和表面填色贴在一起。
- 圆角仍是 20px。工具栏、占位文案、发送按钮和弹层位置没改。

## 检查

局部修改，主 Agent 看了深色空会话、深色有消息、浅色空会话、浅色有消息（2 倍）和 800px 浅色空会话。未独立评审。

截图检查提示代码高亮里 `useMemo`、`filterModels`、`SearchInput` 对比度约 4.44:1。这是原有语法色，这次没改。

类型检查和 lint 通过。未跑生产构建和全量测试。浏览器预览，未看原生窗口。

## 证据

- dark/page-focused.png
- dark/page-thread.png
- light/page-light-1280x860.png
- light/page-light-800x700.png
- light-docked/page-docked-@2x.png
