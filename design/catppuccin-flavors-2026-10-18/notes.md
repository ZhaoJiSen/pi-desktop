# Catppuccin 风格补齐 · 2026-10-18

设计北极星：四种风格保留各自气质，继续沿用统一导航底座与阅读画布；聊天文字清楚，选择器名称完整。

## 修改

- 新增仅深色可用的 Frappé、Macchiato，按较浅到较深排在 Mocha 前。亮色仍为 Latte，原有用户选择与强调色保持兼容。
- 色板来自 [Catppuccin 官方](https://catppuccin.com/palette/)，默认强调色使用各自 Mauve：Frappé #ca9ee6、Macchiato #c6a0f6。
- 各自完整映射纸面、导航、文字、语法和状态色。新增风格复用现有 chat/composer 表面关系，缩略图共用实际主题变量。
- Frappé 纸面较亮，辅助文字用官方 Subtext 1 #b5bfe2；代码底色适配为 #393d51，保证官方蓝色和紫色语法文字的对比度。
- 持久化恢复时，暗色专用风格不可落入亮色配置；缺失可用亮色时回退 Catppuccin Latte。
- 实际画面发现 Macchiato 两行名称超出原先 20px 行盒，选择器统一给名称两行高度与足够选项高度。

## 验证

主 Agent 连续三轮验证结果见 verification.json：三轮均通过，包含既有外观切换、键盘预览、主题默认强调色、主色范围、分别记忆亮暗模式、刷新读回、跟随系统、保存失败，以及新增三个暗色风格主色分别保存与恢复。

四种风格每轮各测 61 个真实 DOM 样本。最低文字对比度 4.64197:1，最低图标对比度 3.57233:1；导航底座与侧栏同色，阅读画布略亮，无横向页面溢出。这里只代表已覆盖样本。

类型检查、lint、diff 空白检查通过。未运行生产构建或全量测试。

主 Agent 查看四种聊天截图、选择器与 200% 主设置内容画面；这是新增两个配色与名称空间的局部修改，未派独立评审。未新增动效、未删界面文案，沿用已有浮层过渡。未对原生 WebView 单独复测。

验证使用真实产品组件与隔离存储的本地预览；没有写入用户实际偏好，没有发起模型请求。原型中的聊天内容是固定测试数据。

## 后续建议（未实施）

1. [Rosé Pine Moon](https://rosepinetheme.com/palette/)：补齐现有 Main / Dawn 之外的中间暗色风格。
2. [Tokyo Night Storm / Moon](https://github.com/folke/tokyonight.nvim)：给现有 Night / Day 补充更柔和、稍亮的暗色选择。
3. [Everforest](https://github.com/sainnhe/everforest)：新系列中优先考虑暖绿，补充当前蓝紫与中性主题之外的气质。

先补成熟系列的缺失风格，再添加新系列，避免选项数量增长但视觉区别很小。

## 证据

- gallery.html、latte/frappe/macchiato/mocha.png：真实聊天画面。
- settings-dark.png：三种暗色风格在选择器中的实际效果。
- settings-200.png：200% 主设置内容。预览采用 CSS zoom，HeroUI 浮层定位在此方式下偏出视口，因此这张图不用于证明浮层在真实浏览器缩放下通过验收；未为预览特例更改产品浮层逻辑。
- verify.mjs、verification.json：验证流程与连续三轮结果。
