# 命令详情切换时的横向滚动条

方向：保持既有 Extensions / Commands 视觉，只修复切换时的滚动闪现。

原因：命令详情卡片以 translateX(12px) 入场，宽度为容器的 100%；HeroUI ScrollShadow 的纵向 auto 让横向的默认 visible 计算为 auto。原始逐帧记录 before.json 显示入场过程中 scrollWidth 大于 clientWidth，overflowX 为 auto。

修复：在 src/styles/_commands.scss 的 .commands-detail 中显式设置 overflow-x: hidden。限制动画产生的横向溢出，保留纵向 auto 和原有 180ms 详情过渡。未改文案、组件、字号或间距；未增加装饰或动效。

验证：verify.mjs 最终由主 Agent 连续执行三轮，1 / 2 / 3 均通过（深色英文、浅色英文、浅色中文）。通过真实侧栏按钮进入 Commands，按动画帧确认横向 hidden、scrollLeft 为 0，并切换前后不同命令。动画期间 scrollWidth 仍可能增加最多 12px，但不产生横向滚动条。验证 reduced motion、200% 实际 CSS 缩放和 390px 长路径换行。将详情容器临时限高至 160px 验证纵向滚动，完成后恢复；预览应用本身有最低窗口高度，单纯缩小视口高度不足以产生详情纵向溢出。

截图：after-1.png / after-2.png / after-3.png、after-200.png、after-390-zh.png。主 Agent 看图自检一轮，未独立评审。before.png 是修复前稳定状态，瞬间溢出的证据以 before.json 为准。results.json 保存最终三轮结果。

类型检查、lint、目标样式格式检查、git diff --check 通过。未运行构建或全量测试。验证环境为 Chromium 浏览器预览（14 条预览命令），未在原生桌面 WebView 中复验。
