import { useWorkspace } from '../store/workspace'

const en: Record<string, string> = {
  '移除会话': 'Remove conversation', '移除桌面端会话记录及草稿，保留 pi 原始会话文件。': 'Remove this desktop conversation and its draft. The original pi session file is kept.',
  '新聊天': 'New chat', '搜索': 'Search', '扩展': 'Extensions', '项目': 'Projects', '用量': 'Usage', '设置': 'Settings',
  '折叠侧栏': 'Collapse sidebar', '展开侧栏': 'Expand sidebar', '添加项目': 'Add project', '搜索会话': 'Search conversations',
  '继续描述你的想法…': 'Continue with your idea…', '添加附件': 'Attach files', '发送': 'Send', '停止': 'Stop', '上下文': 'Context', '估算': 'Est.',
  '搜索模型名称、提供商或 ID…': 'Search model name, provider, or ID…', '最近使用': 'Recent', '全部模型': 'All models', '没有匹配的模型': 'No matching models',
  '选择模型': 'Choose model', '思考强度': 'Thinking effort', '更多会话操作': 'Conversation actions', '导出会话': 'Export conversation', '重命名会话': 'Rename conversation',
  '重新连接': 'Reconnect', '正在连接 pi…': 'Connecting to pi…', '选择项目，开始聊天': 'Choose a project to start', '打开项目文件夹': 'Open project folder',
  '从一个想法开始': 'Start with an idea', '让 Agent 帮你阅读代码、修改文件或解决问题。': 'Read code, change files, and solve problems with your agent.',
  '没有匹配的会话': 'No matching conversations', '搜索标题或对话内容…': 'Search titles or messages…', '取消': 'Cancel', '保存': 'Save',
  '已读取': 'Read', '正在读取': 'Reading', '已修改': 'Edited', '正在修改': 'Editing', '已执行': 'Executed', '正在执行': 'Executing',
  '已写入': 'Written', '正在写入': 'Writing', '进行中': 'Running', '失败': 'Failed', '已中断': 'Interrupted', '思考过程': 'Thinking',
  '当前会话': 'Current session', '全部会话': 'All sessions', '输入': 'Input', '输出': 'Output', '缓存读取': 'Cache read', '缓存写入': 'Cache write',
  '总 Token': 'Total tokens', '估算费用': 'Estimated cost', '会话': 'Conversation', '模型': 'Model', '费用': 'Cost',
  '命令': 'Commands', '扩展包': 'Packages', '搜索命令或扩展…': 'Search commands or packages…', '暂无扩展命令': 'No extension commands',
  '连接 pi 后读取已安装的扩展与命令。': 'Connect to pi to discover installed extensions and commands.', '运行命令': 'Use command',
  '外观': 'Appearance', '浅色': 'Light', '深色': 'Dark', '跟随系统': 'System', '语言': 'Language', 'pi 可执行文件': 'pi executable',
  '保存并重新连接': 'Save and reconnect', '默认从系统 PATH 查找 pi，也可以填写完整路径。': 'Find pi on your PATH, or enter an absolute path.',
  '复制': 'Copy', '已复制': 'Copied', '关闭': 'Close', '名称': 'Name', '项目名称': 'Project name', '项目路径': 'Project path',
  'Ponytail 已加载': 'Ponytail loaded', 'pi 插件': 'pi extension', '轻量模式': 'Light mode', '完整模式': 'Full mode', '高强度模式': 'Intensive mode', '已关闭': 'Off',
}

export function useT() {
  const language = useWorkspace(state => state.language)
  return (text: string) => language === 'en' ? en[text] || text : text
}
