# Loading 图标尺寸与旋转中心

保持现有 Running 状态行、文字流光、HeroUI Spinner 和主题颜色，只修正图标几何。

原因：全局 svg 规则固定17×17px，Running/工具调用的HeroUI Spinner外层为14×14px。HeroUI旋转外层span，内部SVG溢出3px并偏离旋转中心；发送加载状态同样会遇到全局图标尺寸覆盖。

修复：_base.scss只对HeroUI的 [data-slot=spinner] > [data-slot=spinner-icon] 设置display:block、width/height:100%。普通图标维持17px，Spinner的内部SVG跟随各自容器；HeroUI原有0.75s旋转、减少动态效果规则和文本流光均保留，不增加新动画、文案或组件。

局部自检一轮，未独立评审。查看深色100%和浅色200%的实际画面；200%测得SVG与容器均14px，屏幕矩形中心误差0。

verify.mjs连续第1/2/3轮（21/22/23）通过：每轮对运行图标采样8帧，核对旋转矩阵确实变化且SVG始终与容器同尺寸、同中心；继续检查2个工具图标、工具组图标与16px发送加载图标；结束后移除Spinner及流光。results.json记录采样数据。

现有TextShimmer验证连续第1/2/3轮通过，见regressions.json，覆盖文字固定位置、键盘折叠、工具与工具组运行/结束/错误状态。类型检查、lint和差异检查通过。未运行构建/全量测试。

preview.html使用真实Conversation与Composer和隔离验证数据；onlyrun参数仅隐藏相邻内容以单独观察状态行，没有复制加载组件。未连接模型。证据为before.png、after.png、after-200.png。
