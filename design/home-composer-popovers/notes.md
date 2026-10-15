# 首页输入框与弹层边界修复

方向：沿用现有 HeroUI 和首页构图，弹层围绕输入操作出现，保留内容区边缘呼吸空间；输入提示保持静止，不制造额外字符。

## 修改

- 模型和思考级别菜单：启用 HeroUI 自动翻转，内容区为定位边界，边缘间距 24px。模型搜索区固定，列表 flex 收缩并内部滚动，避免外壳被压低后内部列表仍按大高度布局。
- 斜杠菜单：从固定绝对定位改为 HeroUI 非模态 Popover，以整个输入框为锚点，自动翻转、按可用高度收缩，保留原来的内缩 12px 和锚点间隔 8px。编辑焦点、aria-activedescendant、方向键和点击插入沿用现有编辑逻辑。
- 输入提示：删除模拟光标及整段 Placeholder 的无限闪烁动画，恢复原生文本光标。全新草稿原本即为空，未发现自动插入 `/` 的初始化代码；没有为了清除外观而删除已有草稿里用户输入的 `/`。
- 保留界面文案、字号、圆角和输入逻辑；仅删除模拟光标装饰。斜杠菜单沿用 HeroUI 弹层过渡，模型原有内容淡入保留；不再有 Placeholder blink。

## 检查

主 Agent 一轮局部看图自查，检查暗色空输入、矮窗口模型菜单、斜杠菜单、浅色与中文；未独立评审。多 TSX 修改按 React 规范自查：定位边界由稳定 ref 回调捕获，不在渲染时读取 current；效果无需额外全局监听，交互和持久化逻辑保持现状。

最终 verify.mjs 连续第 1 / 2 / 3 轮均通过，结果见 results.json。覆盖 480/560/800px 窗高、浏览器带边框与浏览器模拟 native 布局、1200px 高窗口保留下方展开、模型/斜杠菜单打开时缩窗重算、列表内部滚动、搜索、方向键与鼠标插入、Esc、已有对话向上展开、思考菜单、真实草稿刷新保留及保存失败后仍可见。Placeholder 采样超过原 1.1 秒周期，保持常显。

正常尺寸和 2 倍阅读尺寸截图已查看。2 倍采用 Chromium 550×600 CSS 视口、2x 像素密度（对应 1100×1200 物理画面），用于检查小视口与文字可读性；不声称 CSS zoom 或原生桌面系统缩放已通过。浏览器证据使用 14 条预览命令及预览模型，空会话通过预览状态切换；未启动原生 WebView 复验。关闭测试页开发热更新连接，避免截图落盘触发自动重载。

类型检查、lint、目标文件格式与 diff 空白检查通过。未运行生产构建或全量测试。

## 证据

- before-home.png / before-model.png / before-slash.png：修改前浏览器复现；入场动画可能尚未结束，不用作静态透明度判断。斜杠菜单底部到 606px，超出 560px 视口。
- empty-dark.png：无模拟光标、静态 Placeholder。
- model-short-dark.png / slash-short-dark.png：480px 高布局，弹层向上避让。
- slash-light.png：浅色。
- model-200-zh.png / slash-200-zh.png：2x 阅读尺寸中文截图。
- verify.mjs / results.json：可复跑的三轮交互与几何检查。

## Placeholder 未显示的后续修复

复现到一条换行文本节点时，编辑器视觉空白但节点数组非空，原来的 `value.length === 0` 会隐藏提示。新增共享 isDraftEmpty 判断：只有空白/换行文本也视为视觉空白，命令标签或普通文字仍视为有内容；同步编辑器 data-empty。只改变显示判断，不清理或覆盖用户草稿。

verify-placeholder.mjs 最终连续 1 / 2 / 3 轮通过（placeholder-results.json）：覆盖空文本、换行、空格/tab/NBSP、WebKit 风格 BR 和 DIV/BR 残留、输入删除、聚焦失焦、刷新保留草稿、普通文字/命令标签隐藏提示及 1.3 秒无闪烁。before 见 placeholder-missing-before.png，修复后见 placeholder-fixed-dark.png / placeholder-fixed-light.png。已主 Agent 看图自查；类型检查和 lint 通过。原生应用确认运行在正确 pi-desktop 目录，但原生查看工具缺少 Node runtime，未完成原生画面复验。
