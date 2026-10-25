# 主题样式

`src/styles/index.scss` 只通过 `@use 'themes'` 加载主题层。

```text
themes/
  _index.scss             入口：默认变量、主题输出、文本选中样式
  _defaults.scss          默认变量、共享表面关系、HeroUI 语义变量映射
  _palettes.scss          汇总各主题系列，保持原来的 CSS 输出顺序
  _emit.scss              同时为工作区与设置预览生成变量
  _navigation.scss        导航字段、悬停与选中前景的主题适配
  _text-selection.scss    浏览器文本选中样式
  ink/
    _index.scss           系列内的 palette ID 与明暗版本对应关系
    _light.scss           浅色语义颜色
    _dark.scss            深色语义颜色
  everforest/
    _index.scss
    _light.scss           Medium 浅色
    _dark.scss            Medium 深色
  catppuccin/
    _index.scss
    _latte.scss
    _frappe.scss
    _macchiato.scss
    _mocha.scss
  …
```

其余系列同样各占一个按名称命名的文件夹：Gruvbox、Linear、Nord、Ayu、One Dark、Min Dark、Solarized、Rosé Pine、Tokyo Night。每个系列包含自己的 `_index.scss` 与亮暗色板。Rosé Pine 另有 `_moon.scss`，Tokyo Night 另有 `_storm.scss` 和 `_moon.scss`，这些版本仅在深色模式可用。

## 修改与新增

- 调整某个主题时，修改对应版本的 `$tokens`。颜色按 paper、sidebar、ink、muted、syntax-* 等语义角色命名，组件继续引用 CSS 变量。
- 各系列的 `_index.scss` 将版本映射到实际 palette ID 与 light/dark 模式。Catppuccin 的既有 `catppuccin` ID 仍映射到 Latte/Mocha，保留已保存的偏好。
- 新增系列时，在 `_palettes.scss` 引入其模块并加入汇总列表；新增版本时，在所属系列的映射中注册。主题 ID、模式可用性和中英文显示名继续由 `src/types.ts`、`src/lib/appearance.ts`、`src/locales/` 管理。
- 工作区与 `.palette-preview` 使用 `_emit.scss` 的同一套输出，预览无需额外维护一份颜色。
- 所有主题共用的表面层级、HeroUI 映射在 `_defaults.scss`。设置页的布局与控件样式仍归 `src/styles/_appearance.scss`。
- 文本选中背景使用各版本独立的 `text-selection-bg`，与导航选中项的 `--selection`、用户自选操作强调色分别管理。使用不透明底色，让纸面、代码与输入框的选区保持一致。Catppuccin 使用各自 Mauve 柔紫，Tokyo Night 使用蓝色；其余系列沿用各自色调。
- `_text-selection.scss` 统一输出选区样式：普通文字使用正文色，关键词、字符串、函数和注释保留原色相，并与正文色混合以保证选中后的对比度。未选中的语法色不变。
- `_navigation.scss` 从每个版本自己的 sidebar、paper、selection 与 ink 生成 `nav-hover`、`nav-field` 和轻边界；不改全局 hover、聊天或语法色。字段与悬停是临时状态，持续的当前项继续用 selection。
- 导航辅助/状态色及选中行前景按实际底色校准，只有不足时才向该主题 ink 小幅混合，目标留出 4.65:1 余量；ink 本身不足时，再向黑/白做最小调整。`nav-selected-*` 局部映射给文件列表、树和历史当前行，保留新增/删除的语义颜色。Ink 与 Min Dark 的 selection 单独拉开，Min 的 focus 使用可辨认的中性灰。

此前的目录整理经过 Sass 编译结果等价比对。随后文本选中颜色的适配记录见 `design/text-selection-2026-10-18/notes.md`。
