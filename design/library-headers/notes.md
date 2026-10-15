# Commands / Extensions 顶部统一

北极星：同级资料库页面拥有一致的标题和工具位置，页面内容决定下方的切换或筛选方式。

## 变更

- 两个标题共用 16px / 24px、600 字重及颜色；桌面顶距 20px、窄窗 16px，标题左缩进均为 16px。
- 搜索与刷新统一放在标题右侧；HeroUI 按钮共用 28px 点击区域、14px 图标、2px 间距、悬浮和键盘聚焦样式。刷新统一为单箭头环形图标。
- 共享规则位于 src/styles/_sidebar-layout.scss，删除对应页面重复定义。
- Extensions 的 Installed / Discover 与 Commands 的来源筛选保留语义上的控件区别，继续使用 HeroUI 胶囊选中态。
- 命令总数属于目录；安装数量属于 Installed，因此数量位置保持各自含义。
- 没有删文案或增加装饰；沿用现有搜索展开动效，未新增动效。没有修改业务数据和更新逻辑。

## 验证

- 一轮主 Agent 视觉自检，未独立评审：检查深浅色、相邻列表、展开搜索、390px、实际 CSS 200% 缩放；移动窄窗与 200% 分别验证。
- verify.mjs 由主 Agent 连续三次运行全部通过：英文深色、英文浅色、中文浅色；标题计算样式与坐标完全相同，工具尺寸与中心对齐，搜索展开/Escape 关闭、Installed/Discover 切换、窄窗与缩放无标题行溢出，无页面异常。结果见 results.json。
- 类型检查、lint、格式检查和 diff 空白检查通过；未运行构建或全量测试。
- 浏览器预览使用 14 条命令及未安装扩展的状态，没有验证原生 166 条目录或真实扩展更新网络结果。

## 证据

- before-commands-dark.png / before-extensions-dark.png 为修改前运行画面。
- commands-_.png / extensions-_.png 为修改后深浅色默认、搜索、390px 和 200% 标题区域画面。
- capture.mjs 只用于取图；verify.mjs 为相关交互和样式验证。
