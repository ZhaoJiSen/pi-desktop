# Discover 排序 tab 等宽与截断提示

- 方向：保留 HeroUI 胶囊 tab，两个选项等宽，视觉重心对称；空间不足时仅文字省略，图标保持完整。
- 原因：原来的 `flex: 1 0 auto` 和 `min-width: max-content` 按内容宽度分配空间；在 360px 面板下实际宽度为 126px / 192px。
- 修改：将排序 tab 改为 `flex: 1 1 0; min-width: 0`；增加可收缩的单行文本层；复用 `useTextTruncated` 的 ResizeObserver 检测，只有 scrollWidth 大于 clientWidth 时启用 HeroUI Tooltip。保留完整 aria-label。
- 范围：仅 PackageLibrary.tsx 与 _packages.scss 的排序控件；未改查询、排序逻辑、字体、分类切换和文案。无新增动画，沿用 HeroUI 选中和 Tooltip 过渡。未删除文字。
- 自查：主 Agent 看图一轮，检查暗色省略及提示、浅色选中、实际 CSS 200% 缩放和中文。局部修改，未派独立评审。
- 验证：verify.mjs 从真实 Discover 入口操作，使用真实分栏手柄的 Home/End 调整宽度。覆盖等宽、对称 padding、无横向溢出、未截断无提示、截断有提示、拉宽后关闭提示、缩窄重新提示、鼠标选择、方向键切换、中英文、390px、200% 缩放。最终连续三轮结果见 results.json。
- 浏览器验证通过本地 1432 预览；页面关闭开发热更新连接，避免写入截图触发自动重载。未验证原生桌面 WebView。未安装扩展，数据量不影响本控件验证。
- 类型检查、lint、目标文件格式检查与 diff 空白检查通过；未运行构建或全量测试。
- 证据：before.png、narrow-tooltip-dark.png、narrow-selected-light.png、390-light.png、zoom-200.png、narrow-zh.png、results.json。
