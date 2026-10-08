# pi Desktop

为本机 pi CLI 提供桌面工作台，主要用户是使用 Agent 进行开发的个人开发者。主任务是按项目管理会话、读清回复与执行过程、继续输入、选择模型和思考强度、查看本地 Token/费用、访问扩展命令。

技术栈：Tauri 2、React + TypeScript + Vite、Tailwind CSS 4、Zustand、ahooks、Motion、HeroUI 3。macOS 优先。沿用本地 pi 安装和认证配置，不收集或复制密钥；通过 JSONL RPC 运行单个活动会话。浏览器用于界面预览，不运行 Agent。桌面会话可恢复，草稿与偏好保存在应用本地。

第一版包含模板还原、项目/会话导航与搜索、可搜索的模型选择、工具输出、流式回复、取消、附件、真实 RPC 用量、扩展命令浏览、主题与语言偏好。扩展包的安装/卸载、会话树分叉、发布与更新不在第一版范围。费用来自 pi 的使用统计，不等同于订阅额度。

视觉权威：用户确认的 docs/design/oil-ui/09-layout-preview.html 和 09-layout-refined.png。实现保留这版身份，不重新探索风格。
