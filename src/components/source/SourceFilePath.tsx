import { OverflowTooltip } from '../OverflowTooltip'
import { fileNameOf } from '../../lib/source/paths'

export function SourceFilePath({
  path,
  preserveExtension = false,
  tooltip = true,
}: {
  path: string
  preserveExtension?: boolean
  tooltip?: boolean
}) {
  const name = fileNameOf(path)
  const suffix = preserveExtension ? name.match(/(?:\.(?:test|spec|d))?\.[^.]+$/)?.[0] : null
  const splitName = suffix && suffix.length < name.length
  const directory = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
  const content = (
    <>
      <span className="source-file-basename" data-preserve-extension={splitName || undefined}>
        {splitName ? (
          <>
            <span className="source-file-stem">{name.slice(0, -suffix.length)}</span>
            <span className="source-file-extension">{suffix}</span>
          </>
        ) : (
          name
        )}
      </span>
      {directory && (
        <span className="source-file-directory">
          <bdi>{directory}</bdi>
        </span>
      )}
    </>
  )
  return tooltip ? (
    <OverflowTooltip className="source-detail-path source-file-title" text={path}>
      {content}
    </OverflowTooltip>
  ) : (
    <span className="source-detail-path source-file-title">{content}</span>
  )
}
