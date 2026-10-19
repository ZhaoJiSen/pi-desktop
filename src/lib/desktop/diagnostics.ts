// Match the actual failure line, never a copy of that string inside a source dump.
export function isStaleExtensionContext(message: string) {
  return /^(?:Error:\s*)?This extension ctx is stale after session replacement(?: or reload)?[.!]/.test(
    message.trim(),
  )
}

export function diagnosticNotice(message: string): string | null {
  const text = message.trim()
  if (!/error|failed|错误/i.test(text)) return null
  // Node can print an entire bundled source line before its stack trace. That
  // line can contain "error" hundreds of times, but is not a user-facing error.
  if (/^(?:at\s|(?:async\s+)?function\b|(?:const|let|var|import|export)\s)/.test(text)) return null
  if (text.length > 1200 && /[{};]/.test(text) && !/^(?:\w*Error|错误)\b/.test(text)) return null
  return text.length > 500 ? `${text.slice(0, 499)}…` : text
}
