import { list, record, string } from './utils'

export function contentText(content: unknown): string {
  if (typeof content === 'string') return content
  return list(content)
    .map((item) => string(record(item).text))
    .filter(Boolean)
    .join('\n')
}
