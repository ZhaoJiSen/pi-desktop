// Public desktop API; implementation modules share one runtime state.
export { connectSession } from './desktop/connections'
export { request, syncSession } from './desktop/requests'
export { initializeDesktop, initializeLanguage, syncDesktopLanguage } from './desktop/startup'
export { pickProject, revealProject } from './desktop/projects'
export {
  changeModel,
  changeThinking,
  renameSession,
  removeSession,
  exportSession,
} from './desktop/sessions'
export { sendPrompt, abortPrompt } from './desktop/prompts'
export { readAttachments } from './desktop/attachments'
export {
  onExtensionRequest,
  onRuntimeNotice,
  extensionResponse,
  decodeExtensionRequest,
} from './desktop/events'
export { refreshExtensionPackages } from './desktop/packages'
