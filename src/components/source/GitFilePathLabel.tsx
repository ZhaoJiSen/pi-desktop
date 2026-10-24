import reactIcon from 'material-icon-theme/icons/react.svg?url'
import vueIcon from 'material-icon-theme/icons/vue.svg?url'
import tsIcon from 'material-icon-theme/icons/typescript.svg?url'
import jsIcon from 'material-icon-theme/icons/javascript.svg?url'
import sassIcon from 'material-icon-theme/icons/sass.svg?url'
import cssIcon from 'material-icon-theme/icons/css.svg?url'
import fileIcon from 'material-icon-theme/icons/file.svg?url'
import { OverflowTooltip } from '../OverflowTooltip'
import { SourceFilePath } from './SourceFilePath'

const icons: Record<string, string> = {
  tsx: reactIcon,
  jsx: reactIcon,
  vue: vueIcon,
  ts: tsIcon,
  js: jsIcon,
  scss: sassIcon,
  sass: sassIcon,
  css: cssIcon,
}

export function GitFilePathLabel({ path }: { path: string }) {
  const extension = path.split('.').pop()?.toLowerCase() ?? ''
  return (
    <OverflowTooltip className="git-file-path-label" text={path}>
      <img src={icons[extension] ?? fileIcon} alt="" aria-hidden="true" draggable={false} />
      <span className="git-file-chip-label">
        <SourceFilePath path={path} preserveExtension tooltip={false} />
      </span>
    </OverflowTooltip>
  )
}
