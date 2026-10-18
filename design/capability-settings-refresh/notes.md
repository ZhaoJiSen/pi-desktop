# Composer 与 Settings 信息层级优化

日期：2026-10-18

## 方向与范围

北极星：聊天保持轻量，选择器负责查找，设置集中管理。

用户批准上一轮方案，并新增 Settings 左菜单、右内容的要求。本轮沿用现有主题、配色和字体，未重做品牌，也未修改 Pi 桥接和能力执行协议。

## 已落地

- Settings 使用 HeroUI ListBox 分类：通用、外观、快捷入口、能力管理、扩展、Pi 连接。内容独立滚动，分类切换保留能力编辑和连接路径草稿。
- 宽栏输入框将标签放到 + 右侧；使用 HeroUI TagGroup、Tag、原生移除操作，支持 Delete。显示“会话 / 单次”范围；详情继续可查看提示词、来源和范围。
- 能力选择器使用 HeroUI Popover、SearchField、ListBox.Section、Label、Description；常用单次、持续模式、其他单次分组，搜索包含命令及插件来源。上下箭头进入结果，Enter 选择，Escape 关闭。
- 菜单仅中间列表使用 ScrollShadow，搜索和管理入口保持固定。关闭快捷栏或数量设为 0 时，能力菜单仍保留。
- 快捷配置：左侧名称与说明、右侧 0–6 的 HeroUI Select。快捷栏预览和固定项顺序独立显示。
- 管理列表按来源分组，支持名称、描述、斜杠别名、来源搜索，以及来源/启用状态筛选。常驻操作仅固定、启用、更多；编辑、复制、恢复默认、删除使用详情和 HeroUI Dropdown。
- 宽内容区显示列表与详情，较窄时详情替换列表；返回保持搜索与筛选。插件来源在条目和详情中保留。
- 新增共享 CapabilitySearch、来源/搜索辅助函数，分离能力配置状态 Hook 与管理列表组件。

## 响应式与动效

- Settings 内容容器小于 500px 时使用顶部横向分类导航。这是为保留内容宽度的响应式例外；常规桌面仍为左菜单右内容。不是图标折叠菜单。
- Composer 小于 620px 时标签换到工具栏上一行，不挤压模型、思考强度和发送按钮。
- 标签内容 150ms 透明度/位移淡入；分类标题 160ms 轻移淡入；快捷按钮使用按压缩放，菜单沿用 HeroUI 出入场。只使用变换与透明度，保留减少动态效果。
- 未提供动作录屏：当前浏览器控制只暴露截图，未把静态截图当作动效性能证据，未报告帧率。

## 一轮独立视觉复查

使用 Oil UI 存量界面润色评审，不打分。评审者与实现过程隔离，基于截图和 DESIGN.md。

处理：
- 为标签补充“会话 / 单次”，菜单分组明确单次与持续。
- 详情对象名称提升到操作之前；窄内容区保留名称正文。
- 默认来源分组下删除行内重复“内置 / 我的能力”；插件具体来源保留。
- 删除说明中的 Pi 内部过程措辞，保留“发送成功后”这一准确条件。
- 缩短固定顺序说明；放大自检发现数量说明出现中文孤字，缩为“其余能力可从菜单选择。”
- 窄窗口顶部导航为明确保留的响应式取舍，记录在 DESIGN.md。

实现中发现并修复：TagGroup 子项缓存旧 disabled 状态、Tag 内按钮 slot 上下文冲突、全局 SearchField 旧样式影响新搜索框、窄分类每项默认 100% 宽度、搜索框 Escape 被内部处理导致菜单无法关闭。最终验证覆盖这些实际路径。

## 验证

主 Agent 使用 CUA 操作真实生产组件，连续三轮完整交互通过：10、11、12。结果见 ui-results.json，执行脚本 verify-ui.mjs。期间窗口由 1280×720 变为 679×1100，验证逻辑按实际容器宽度检查宽栏与窄栏布局。

覆盖：
- 中文草稿保留、标签详情、Delete 移除、斜杠选择和范围标识。
- Pi 回读后模式标签可操作；计划冲突任务禁用。
- 插件来源搜索、键盘结果选择、菜单关闭、真实管理入口路由。
- 原生模板发送链路、失败保留草稿与标签、重试成功后清除单次标签，聊天不展示模板正文。
- 搜索与来源组合筛选，详情打开/返回、未保存编辑跨分类保留。
- 数量 Select、固定项排序、保存失败保留、重试保存、刷新读回。
- 自定义能力新建/复制/删除/固定、斜杠调用、多行编辑。
- 连接设置迁移、菜单键盘操作、明暗主题、380/520px 容器和减少动态效果。
- 宽栏最终几何校验（wide-layout.json）：736px Composer 中两个 145px 标签位于 + 右侧，同一行，全部子项处于输入框内，无标签内容溢出。

本轮针对 UI，Pi IPC 使用隔离的本地模拟响应；没有调用真实模型或真实插件任务。实际应用 /#/settings 入口另行查看，见 app-settings.png；不宣称原生 WebView 复测。

类型检查通过：应用、scripts、tests 三个 TypeScript 配置。
Lint 通过：oxlint src scripts tests vite.config.ts vitest.config.ts。
样式扫描：Impeccable 目标文件 detect 返回 []，没有新增忽略项。
git diff --check 通过。更新既有 SettingsPage 测试的分区入口与布局预期；未运行生产构建、全量测试或单元测试。本轮未修改原生代码，因此没有重复 Rust 检查。

## 图像与记录

- app-settings.png：1280×720 实际浏览器应用壳，Settings 左右结构，通用页。
- settings-dark.png / shortcuts-dark.png / details-dark.png / composer-dark.png / picker-dark.png：1280×720 初版稳定截图，用于独立复查；后续补充范围文案与精修。
- settings-light-narrow.png / shortcuts-light-narrow.png：1280×720 浏览器中的 520px 内容容器，浅色与减少动态效果。
- settings-current.png / details-current.png / shortcuts-current.png / composer-current.png / picker-current.png：最终实际 679×1100 浏览器截图；数量说明精简后再次更新 shortcuts-current.png。
- shortcut-detail-200.png：最终数量设置截图局部放大 2 倍，仅用于文字细节检查，不冒充系统/浏览器 200% 缩放验证。
- ui-results.json：连续三轮交互记录。
- wide-layout.json：最终宽栏几何校验。
- visual-review.md：独立复查原始要点与处理。

未做：新增能力执行逻辑、插件安装管理、项目级覆盖、真实模型运行；这些不是本轮视觉与组织结构改动。
