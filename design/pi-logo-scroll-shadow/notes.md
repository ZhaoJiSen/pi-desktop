# 空会话 Pi 标识被滚动遮罩渐隐

保持现有布局、颜色、标识尺寸和动效，只修复空会话的滚动遮罩状态。

复现：有消息时 Conversation 滚到末尾，data-top-scroll=true；清空消息后 isEnabled=false 会停止监听，但没有清除旧边界属性，mask-image 仍是顶部24px渐隐。空会话容器只有标识高度，所以顶部像素被遮住。

修正：Conversation 对空会话显式设置 HeroUI ScrollShadow visibility="none"，由组件自身清除旧边界属性；有消息时恢复auto，继续显示正常滚动渐隐。未修改HeroUI源码或共享CSS，也未给标识另加覆盖层。

局部自检一轮，未独立评审。verify.mjs 连续第1、2、3轮通过：初始空态mask=none，有长消息恢复auto和溢出边界，切回空态清除mask及旧边界，再重复切换。Pi保持64×64。结果见results.json。

类型检查、lint和差异检查通过；未运行构建/全量测试。before.png和after.png为真实组件在隔离验证页面中的实际截图。未增加动效或删改界面文案。
