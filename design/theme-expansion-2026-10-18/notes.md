# 配色扩展 · 2026-10-18

方向：沿用已有布局与统一导航底座，把成熟主题的缺失版本补齐，再增加暖绿色系列。新增 5 个有效版本，主题选项总计深色 17、浅色 12。

## 新增与来源

- Rosé Pine Moon：官方底色 #232136、导航 #1f1d30，保留 Iris 紫色与 Rose / Gold 语法色。[官网](https://rosepinetheme.com/palette/) · [官方色板](https://github.com/rose-pine/neovim/blob/main/lua/rose-pine/palette.lua)
- Tokyo Night Storm：底色 #24283b、导航 #1f2335，蓝色主色。[官方 Storm 色板](https://github.com/folke/tokyonight.nvim/blob/main/lua/tokyonight/colors/storm.lua)
- Tokyo Night Moon：底色 #222436、导航 #1e2030，采用自己的蓝色、绿色和紫色。[官方 Moon 色板](https://github.com/folke/tokyonight.nvim/blob/main/lua/tokyonight/colors/moon.lua)
- Everforest Light / Dark：采用官方默认 Medium 的亮暗底色与暖绿基调。暗色 #2d353b，浅色 #fdf6e3。[官方项目](https://github.com/sainnhe/everforest) · [官方颜色定义](https://github.com/sainnhe/everforest/blob/master/autoload/everforest.vim)

色相与基础表面取自官方，辅助文字、语法、状态颜色根据 Pi 的实际表面调整可读性，明细见 color-adaptations.json；这些是应用适配，并非逐个色值都与编辑器原样相同。Everforest 浅色的操作主色也按按钮文字对比度加深。

## 实现

- 新增变体各自保存在 themes/rose-pine、themes/tokyo-night，Everforest 建立独立 themes/everforest 文件夹。预览与真实页面复用同一份颜色。
- 三个暗色专用变体只出现在暗色列表，新增中英文名称，复用现有选择器、两行名称空间与 ColorSwatchPicker。
- 所有新增主题分别记忆自选主色；模式切换、跟随系统及刷新恢复沿用已有机制。
- 不支持的亮色保存值优先恢复同系列的 Dawn / Day，避免让暗色颜色进入亮色模式。
- 补齐每个版本的文本选中背景，保留已确认的语法色相和选中文字对比度规则。
- 未新增布局、动效或额外说明，未删除已有文案；保留原主题 ID 与用户保存的偏好。

## 验证

最终连续三轮通过，见 verification.json。每轮验证：浅色 12 / 深色 17 个选项与模式过滤、键盘预览不保存、5 个新增版本的默认主色、各自强调色记忆、刷新恢复、跟随系统、保存失败时留存当前选择并提示，以及恢复主题默认主色。

每轮还检查五个版本的真实聊天页面（每页 60 个文字/图标样本）、文本选区（每版 89 个样本），以及三种暗色专用 ID 的同系列亮色回退。

- 正常聊天文字最低对比度：4.95500:1。
- 必要图标最低对比度：3.66872:1。
- 选中文字最低对比度：4.75313:1。
- 导航与外壳同底，阅读面比导航略亮；无页面横向溢出。

主 Agent 自查五种实际聊天截图、设置选择器，以及 Everforest 的 200% 阅读画面；局部新增配色采用自检，未做独立评审。结论仅代表已覆盖样本；没有把浏览器验证称为原生 WebView 复测。

类型检查、lint、Sass 编译、格式与差异空白检查通过；未运行生产构建和全量测试。

预览服务曾缓存生成色板期间的缺失文件错误，重启开发预览后恢复，未修改项目配置。早期配置回退验证向错误的桌面存储键写入数据，改为隔离浏览器预览的存储键后重新完成三轮验证。

## 证据

- 五张 `<palette>-<mode>.png`：新增主题在完整聊天界面的实际效果。
- gallery.html：五版图集。
- settings-dark.png：暗色主题选择器。
- everforest-dark-200.png：200% 阅读。
- verify.mjs、verification.json：验证脚本与结果。
- settings.html：隔离设置测试入口，使用独立 sessionStorage 命名空间，支持模拟系统模式变化、保存失败和旧配置；不修改用户真实偏好。
- 聊天与文本选区沿用本对话先前的隔离预览入口，复用真实产品组件与样式，聊天内容为固定测试数据，不发起模型请求。
