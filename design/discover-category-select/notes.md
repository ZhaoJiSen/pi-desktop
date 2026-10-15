# Discover 分类自适应

沿用命令页面的既定规则：宽栏保留五个分类的单行按钮，左侧栏内容宽度不超过 339px 时显示 HeroUI Select。依据左侧栏容器判断，适配拖动分栏和窄窗口。按钮组与 Select 共用原有 category 状态与 changeCategory，保持原来的分类筛选与翻页逻辑。

实现涉及 PackageLibrary.tsx 与 _packages.scss。Select 使用现有 HeroUI 组合组件、颜色变量及命令页同款 34px 高度与边框样式，键盘选择由组件提供。没有新增文案、删减文字或加入额外动效；沿用 HeroUI 默认交互。Installed 模式不显示分类控件。

局部自检，无独立评审。已查看宽栏、窄栏菜单、390px 中文和实际 200% CSS 缩放截图；未发现分类控件换行或裁切。

验证脚本 verify.mjs 连续三轮均通过：第 1 轮英文、第 2 轮英文、第 3 轮中文；涵盖五项单行、窄栏 Select、键盘选择、窄宽切换保留分类、390px、200% 缩放、Installed/Discover 切换及零页面异常。

类型检查通过；本次组件 lint 通过。全项目 lint 被已有的 src/hooks/usePiUpdatePrompt.ts 第 18、23 行 react(set-state-in-effect) 错误阻挡，未改动该文件。未执行生产构建或全量测试。

浏览器预览无法调用桌面扩展目录接口，显示现有目录不可用提示。本次验证覆盖筛选控件及其状态，不声称验证了原生目录请求或安装结果。

证据：before/page.png、after/page.png、verified/english-wide.png、verified/english-narrow-menu.png、verified/zh-390.png、verified/english-zoom-200.png；每轮结果见 verified/results.json。
