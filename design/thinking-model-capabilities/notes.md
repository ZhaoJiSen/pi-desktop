# 思考强度：中性背景与真实模型能力

设计北极星：模型面板保持安静统一，等级差异只在滑轨内表达。

## 本次改动

- 移除强度区域的整块彩色背景；等级标题恢复普通文字色。滑轨依等级呈青、蓝、紫色，Extra high/Max 保留轨道内渐变与星点。没有增加新动画；既有星点支持减少动态效果。
- 闪电只是上一版的装饰，并没有 Fast 行为。本次改为思考图标，避免误认成速度开关。
- 桌面继续以当前模型的 `get_available_thinking_levels` 为权威，不按名称猜测；切换前清空旧列表，读取失败不展示旧模型档位。浏览器预览按模型 `thinkingLevelMap` 推导，不再共用所有模型的等级。
- 明确切换模型后请求 Medium，再读回实际模型/强度。Medium 不可用时，按 Pi 的 clamp 顺序先找更高可用档，再找更低档；非推理模型为 Off。恢复按钮采用同一规则。
- 手动调节后也读取 runtime 实际接受的值，避免前端展示被服务端裁剪掉的等级。重新打开已有会话保留用户强度，不因打开面板重置。
- 未增加 Fast 开关：本机 Pi 1.3.0 的 RPC 类型没有速度模式控制命令，项目允许列表也未接入这一能力。Fast 与推理等级不应混为一档。
- 没有新增或删减可见说明文案；移除了标题渐变这一重复装饰。

## 能力依据

本机 @earendil-works/pi-coding-agent 1.3.0，配套 pi-ai 的 `getSupportedThinkingLevels()`、`clampThinkingLevel()`、提供方目录和 RPC 类型。只读取代码与公开目录，未读取凭据，未调用模型服务。

`installed-catalog.json` 保存读取结果：

| 模型/提供方 | 等级 |
| --- | --- |
| Grok 4.7 / xai | low, medium, high, xhigh |
| GPT-5.3 Codex Spark / openai-codex | off, minimal, low, medium, high, xhigh |
| GPT-5.6 Sol / openai-codex | off, minimal, low, medium, high, xhigh, max |
| Claude Sonnet 4.6 / anthropic | off, minimal, low, medium, high, max |

这些是本机当前目录，不硬编码进产品。用户自定义提供方及后续 Pi 版本以其 RPC 返回为准。

官方协议：[可用等级与设置等级](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc-commands.md#get_available_thinking_levels)。

## 验证

- `verify.mjs` 第 1、2、3 轮连续通过，记录见 `results.json`。
- 原滑块验证第 101、102、103 轮连续通过，见 `slider-regressions.json`。
- 原样式/恢复验证第 201、202、203 轮连续通过，见 `presentation-regressions.json`。
- 类型检查与 lint 通过；没有跑生产构建或全量测试。
- 真实组件 + 真实桌面请求函数在浏览器内运行；RPC 服务为隔离模拟，能力目录取自本机安装版本。覆盖 Medium 请求顺序、模型切换、无 Extra high/有 Max、无推理、单档、服务端裁剪、保存失败、列表读取失败、恢复、刷新读回。
- 普通浏览器路径覆盖拖动只提交一次、键盘、错误回退、窄容器、无等级/七等级、连接中禁用与 Escape。
- 主 Agent 自检一轮，未独立评审。明暗主题、中文 200% 组件视图无裁切或重叠。200% 为组件 CSS zoom，不宣称原生 WebView 验证；本轮未启动桌面应用或真实 RPC 子进程。

## 证据

- `before-full.png`：本次调整前。
- `medium-full.png`、`extra-high-full.png`：实际 Composer/ModelSelector 上下文画面。
- `comparison.png`：两种等级并排，面板与标题保持同色，滑轨变化。
- `light-200-full.png`：浅色中文组件 200% 检查。
- `*-context.json`：截图时 DOM 几何。裁剪图来自完整截图，未重绘界面。
- `rpc.html`：模拟 IPC 的桌面路径验证入口；`preview.html`：普通浏览器路径；`control.html`：组件放大检查。
