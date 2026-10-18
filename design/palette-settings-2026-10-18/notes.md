# 外观设置：主题与强调色

北极星：选之前看得出配色效果，设置页面保持安静紧凑。

沿用现有系统字体、HeroUI 控件、圆角和设置分组。主要任务依次是选择明暗模式、选择配色主题、调整强调色。保留三张模式预览卡；主题展开为三列缩略图网格，640px 以下改为两列，并限制弹层高度以内部滚动。关闭后只保留主题名称和配色色片。缩略图与工作区使用同一份 Sass 配色角色，不另维护一套预览色。

## 实现

- 每个模式 11 个有效主题，名称随模式显示：Min Light / Min Dark、One Light / One Dark、Catppuccin Latte / Mocha 等。按明确的模式可用性过滤，当前所有内置系列均有亮暗版本。
- 新增 Solarized、Rosé Pine Dawn / Rosé Pine、Tokyo Night Day / Tokyo Night。纸面和主要色相参考上游，辅助文字、代码色和按钮色按 Pi 的背景适配对比度。新增主题的正文、辅助字、语法、状态及按钮文字对比记录在 contrast.json。
- 亮暗主题分开保存。跟随系统时监听模式变化并恢复各自主题和强调色。系统模式显示当前生效的明暗状态；编辑另一模式时先切换到该模式，改完可重新选择跟随系统。
- 强调色使用 HeroUI ColorSwatchPicker，主题默认加八个色相。每个主题的每种模式分别保存，恢复默认会删除对应覆盖值。
- 自定义强调色只覆盖主动作、选中控件及焦点色。纸面、代码高亮、链接与状态色继续由主题提供。顶部预览也显示保存的强调色。
- 旧 palette 偏好迁移到亮暗两份配置；保留旧字段供既有调用兼容。读回时过滤无效主题与覆盖值。保存失败保留当前选择，并沿用现有错误反馈，刷新恢复最后成功保存的配置。
- 模式切换时重建色板选项，避免组件集合把颜色值变化视为条目 ID 变化。

## 视觉与动效

- 保留模式卡片 180ms 的边框与悬停反馈。
- 主题弹层沿用 HeroUI 的进入退出过渡；选项按压 100ms 缩放至 .98，悬停/选中反馈 140ms。
- 色板沿用组件的选中缩放和勾号反馈。减少动态效果时关闭相关过渡。
- 删去模糊的 Palette 标签及不随模式变化的旧主题名。缩略图用形状模拟正文、代码和输入区，不添加制作说明或装饰文案。
- 未加入任意 HEX 输入、主题编辑器或外部主题市场，保持首版选择成本。

## 验证

- 类型检查通过；代码检查通过。
- SettingsPage 与 workspace 的定向测试：35 项通过，覆盖旧配置迁移、无效值清理、亮暗恢复、强调色保存/清除，以及模式切换后的组件集合。
- verify.mjs 在真实浏览器连续三次通过。每轮包括 11 个浅色名称、键盘预览不提交、Escape 关闭、强调色不改纸面及语法、恢复默认、亮暗分开恢复、刷新读回、系统变更、保存失败保留选择并回到上次成功保存状态。结果见 verification.json。
- 1280×720、640×860 的浅色/深色/系统模式截图以及 2 倍图已查看。390×844 的主页面与主题弹层已额外查看，修正了模式标签在极窄容器中的排布。
- 截图工具报告 issues / lint 全为空，没有控制台错误、横向溢出或加载失败的图片。
- 一轮独立存量界面视觉评审，不打分：没有必改问题。保留分层设置、缩略预览、选中描边加勾号和窄窗重排，未建议删去新增文案。独立评审不能从静态图验证保存逻辑，交互结果以上述主 Agent 的三轮验证为准。
- 已录制进场和弹层展开视频；当前评审工具无正常速度视频播放能力，动效以实际交互走查和状态图检查为限，未声称完整视频播放验收。未运行生产构建或全量测试。

## 证据

修改前：../palette-research-2026-10-18/before-settings.png。

当前截图：light.png、dark.png、system.png、dark-picker.png、narrow-390.png、narrow-picker.png。截图工具的多尺寸图、放大图、report.json、录屏在 evidence/。preview.html 使用隔离的会话存储，测试不会写入真实工作区偏好；F6 模拟保存失败，F7 模拟系统明暗变化。

## 参考

后续修正：Catppuccin 默认强调色由原有蓝色改为官方 VS Code 主题默认的 Mauve：Latte #8839ef、Mocha #cba6f7，并同步焦点颜色。主题默认色块、预览和实际界面共用变量，随之同步；用户自选强调色保留。实际明暗截图见 catppuccin-mauve/，类型检查和 lint 通过。这是局部颜色修正，主 Agent 自检，未增加独立评审和动效。

- Catppuccin 默认强调色：https://github.com/catppuccin/vscode#custom-accent-color
- Catppuccin 官方色值：https://catppuccin.com/palette/

- Linear：https://linear.app/now/behind-the-latest-design-refresh
- VS Code：https://code.visualstudio.com/docs/configure/themes
- Slack：https://slack.com/help/articles/205166337-Change-your-Slack-theme
- Solarized：https://ethanschoonover.com/solarized/
- Rosé Pine：https://rosepinetheme.com/palette/
- Tokyo Night：https://github.com/folke/tokyonight.nvim
- HeroUI ColorSwatchPicker：https://heroui.com/en/docs/react/components/color-swatch-picker
