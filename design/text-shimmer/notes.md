> 此文档记录最初的双层扫光方案。当前实现已改为单层文字，详见 ../shimmer-clarity/notes.md；原始截图保留作历史证据。

# 状态文字扫光

沿用当前 Chat 的安静阅读方向。参考 HeroUI Pro Text Shimmer，把扫光限制在短的活动状态文案，正文保持 Streamdown 原有渐显。

官方参考：https://heroui.pro/docs/react/components/text-shimmer
已查看官方实际 demo，组件用于 thinking / generating 等短状态。其说明建议 currentColor、隐藏的装饰文本层、translate 扫光以及减少动态效果时的静态回退。

实现为共享 src/components/TextShimmer.tsx 与 _text-shimmer.scss，不增加依赖，不复制 Pro 私有源码。

- 当前末块仍在输出的 Thinking、运行中的工具动词、工具分组状态、底部进行中提示启用扫光。
- 状态结束、错误或中断时退回普通文字，历史 Thinking 不动。
- 2.4 秒线性扫光，静态渐变遮罩配合正反向 translate；复制字形保持原位，不逐帧修改 background-position。
- 为保持当前字体的对比度，底色沿用原状态色，不照搬官方的 45% 透明度；主文字色作为高光。
- 辅助层 aria-hidden/inert，伪元素生成文字，DOM textContent 与可访问名称不重复。布局、文案、行高和展开选择保留。
- 减少动态效果/强制颜色模式隐藏光效层，保留实色文字；实现已检查，本次未通过浏览器媒体偏好覆盖验证该分支。

局部视觉自检 1 轮，未独立评审。查看浅色、Nord 深色、200% 以及 GIF 实际截图帧预览，没有删改界面文案。

verify.mjs 第 1、2、3 轮均通过：只有活动 Thinking 扫光、扫光随时间移动、复制字形位移为 0、辅助层不可交互且不重复文案、工具行仍为 38px、执行启动后 Thinking 停止扫光、运行工具/分组显示扫光、正文无扫光、完成后所有扫光移除、错误/中断静态、键盘折叠和选择保留。

既有工具卡片与 Markdown 流式验证也各连续 3 轮通过。类型检查、lint、差异检查通过，没有运行生产构建与全量测试。

证据：after-light.png、after-dark.png、after-200.png；preview.gif 来自实际组件的 45 张截图帧、约 2.85 秒（capture.json），是验证数据，未调用模型。results.json / regressions.json 保存三轮结果。无全页改版、无独立视觉评分。
