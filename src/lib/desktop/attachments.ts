import type { Attachment } from '../../types'
import { t } from '../i18n'
import { string } from '../utils'

export async function readAttachments(files: FileList | File[]): Promise<Attachment[]> {
  const results: Attachment[] = []
  for (const file of Array.from(files)) {
    const image = /^image\/(png|jpeg|webp|gif)$/.test(file.type)
    const text =
      file.type.startsWith('text/') ||
      /\.(md|json|csv|log|tsx?|jsx?|rs|py|go|toml|ya?ml|css|html|sh|txt)$/i.test(file.name)
    if (!image && !text) throw new Error(t('errors.unsupportedAttachment', { file: file.name }))
    if (file.size > (image ? 8 * 1024 * 1024 : 512 * 1024))
      throw new Error(t('errors.attachmentTooLarge', { file: file.name }))
    let data: string
    if (image)
      data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(string(reader.result).split(',')[1] || '')
        reader.onerror = () => reject(new Error(t('errors.readAttachment', { file: file.name })))
        reader.readAsDataURL(file)
      })
    else data = await file.text()
    results.push({
      id: crypto.randomUUID(),
      name: file.name,
      data,
      kind: image ? 'image' : 'text',
      mimeType: file.type || 'text/plain',
    })
  }
  return results
}
