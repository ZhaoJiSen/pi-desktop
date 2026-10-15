# Discover 与 Commands 分类圆角统一

根据用户最新意见，沿用 HeroUI 自带的胶囊圆角，移除两处分类按钮的 8px 覆盖规则。实测两处默认 border-radius 均为 24px，在 26px 高的控件上呈现胶囊形。窄栏 Select、文字、间距及现有动效保留。

主 Agent 自检一轮，无独立评审。已查看 light-commands.png 与 light-extensions.png。浏览器预览不支持原生扩展目录，截图中的目录错误为现有环境限制。

类型检查、全项目 lint、样式格式检查通过。圆角比对连续第 1、2、3 次均通过；响应式交互连续第 1、2、3 次均通过，覆盖中英文、宽窄切换、键盘选择、390px、200% 缩放。证据：result.json、light-commands.png、light-all.png、light-extensions.png；响应式证据 ../discover-category-select/verified/ 本次已重新生成。
