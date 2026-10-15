# Commands 来源分组

设计目标：命令名称和说明是列表的主角，来源由分组标题表达一次。

这是命令管理页的局部延续，保留已有 HeroUI 控件与圆角。All 按 Pi 内置、扩展、提示词模板、技能固定顺序分组，保持组内原顺序。分组标题右侧显示当前结果数量；空组不显示。搜索沿用同样的分组，单一分类平铺。使用 HeroUI ListBox.Section + Header，保留单一 ListBox 的键盘连续导航、选择与右侧详情。移除每行重复来源标签，详情中的来源 Chip 保留。

参考：Raycast 的 List.Section 将相关结果归组；HeroUI 的 With Sections 提供对应组件及语义。

- https://developers.raycast.com/api-reference/user-interface/list
- https://heroui.com/en/docs/react/components/list-box

不增加折叠操作，避免隐藏命令和增加展开步骤。没有新增文案、图片、装饰容器或动画；保留原来的搜索展开、选择详情过渡。组间留白区分来源，不再给每行增加标识。

验收：主 Agent 自检一轮，查看暗色、亮色、中文和实际 CSS 200% 放大截图；未独立评审。类型检查、lint、格式检查及 git diff --check 通过。verify.mjs 最终连续第 1/2/3 次全部通过：分组及数量、空组隐藏、14 条命令保留、无重复来源标签、分组可访问名称、跨组上下键选择及详情同步、搜索和无结果、单分类平铺、宽栏胶囊和窄栏 Select、390px、明暗主题、中英文、200% 放大、无页面错误。

截图使用浏览器现有的 14 条预览命令，未验证原生桌面实际 166 条目录。原始视觉基线为用户提供截图 before-user.png；未取得运行中的旧代码截图。最终证据：dark.png、light.png、zh.png、dark-200.png、results.json。
