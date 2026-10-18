import { Button } from '@heroui/react'
import { Paperclip, X } from 'lucide-react'
import type { Attachment } from '../../types'
import { useT } from '../../lib/i18n'
export function ComposerAttachments({
  files,
  disabled,
  onRemove,
}: {
  files: Attachment[]
  disabled: boolean
  onRemove: (id: string) => void
}) {
  const t = useT()
  if (!files.length) return null
  return (
    <div className="attachments">
      {files.map((file) => (
        <div key={file.id} className="attachment">
          <Paperclip />
          <span title={file.name}>{file.name}</span>
          <Button
            isIconOnly
            variant="ghost"
            className="attachment-remove"
            aria-label={t('attachments.remove', { file: file.name })}
            isDisabled={disabled}
            onPress={() => onRemove(file.id)}
          >
            <X />
          </Button>
        </div>
      ))}
    </div>
  )
}
