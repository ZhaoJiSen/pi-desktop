import { fileNameOf } from '../../lib/source/paths'

export function SourceFilePath({ path }: { path: string }) {
  const name = fileNameOf(path)
  const directory = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
  return (
    <span className="source-detail-path source-file-title" title={path}>
      <span className="source-file-basename">{name}</span>
      {directory && (
        <span className="source-file-directory">
          <bdi>{directory}</bdi>
        </span>
      )}
    </span>
  )
}
