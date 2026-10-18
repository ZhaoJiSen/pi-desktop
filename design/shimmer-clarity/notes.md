# 文字扫光重影与发虚

用户确认问题是文字重影、变粗或发虚。此次只改文字扫光，不再修改Spinner或加载行布局。

## 修正

旧实现由一个可读文字层和一个复制文字层叠加，后者通过两层反向translate抵消位移。逻辑矩形可以完全一致，但两层文字经过独立栅格化和叠加，字缘会更重，移动时也可能发虚；原有“复制层位移为0”的断言不足以验证这点。

TextShimmer现在仅输出一个span及一个文本节点，不再复制文字、不生成伪元素文字、不移动字形。高光使用background-clip:text，背景渐变按原有2.4秒周期扫过。沿用状态文字颜色与主题主文字高光，字重、字号、行高和状态触发条件保持。

选择单层清晰度意味着短活动标签使用background-position绘制，不再追求旧方案的双层GPU位移。动画仅作用于Thinking、工具动词/分组及Running等短标签，不作用于正文；没有宣称帧率或性能改善。减少动态效果和强制颜色时关闭渐变，恢复实色文字；不支持文字背景裁切时也显示普通文字。

HeroUI参考文档仍用于短状态标签、配色和静态回退的使用约束：https://heroui.pro/docs/react/components/text-shimmer 。本次未复制Pro私有实现，实际渲染方案按项目中的清晰度问题调整。

## 验证

局部自检一轮，未独立评审。查看深浅主题100%及深色200%的实际画面，并检查8个不同扫光阶段的字缘；phase-review.png为实际截图帧的局部对照。

现有design/text-shimmer/verify.mjs更新为当前结构的验证，第1、2、3轮连续通过，见results.json：只有一个文本节点、没有复制元素、没有transform/translate、背景扫动、字号/字重/矩形保持；活动Thinking/工具/分组/Running范围、完成/错误/中断清理、键盘折叠及38px工具行保持。

加载图标验证也连续第1、2、3轮（31/32/33）通过，见loading-regressions.json；Running/工具/工具组/发送加载图标与状态结束均保持正常。类型检查、lint及差异检查通过。按skill未运行构建或全量测试。

preview.gif来自真实浏览器截图：录制178帧、3109ms，按实际采样时间选取一个2400ms流光周期的138帧；仅裁出文字区域以避免Spinner不同周期在GIF循环点造成跳变。未重画文字或合成流光。capture.json记录原始帧时间，label-rect.json记录实际DOM裁切区域。

证据包括before.png、after.png、after-light.png、after-200.png、preview.gif、phase-review.png。fixture使用实际Conversation与Composer；onlyrun仅隐藏相邻区域方便观察。未连接模型、未修改界面文案。减少动态效果/强制颜色的规则已检查，但未通过系统偏好覆盖实测。桌面原生WebView未复测，不能将浏览器画面等同于原窗口验证。
