import { ScrollShadow } from '@heroui/react'
import { memo } from 'react'
import { Streamdown, type Components } from 'streamdown'
import { useT } from '../lib/i18n'

const components: Components = {
  h1: 'h3',
  h2: 'h3',
  h3: 'h3',
  h4: 'h4',
  h5: 'h5',
  h6: 'h6',
  p: 'p',
  ul: 'ul',
  ol: 'ol',
  li: 'li',
  strong: 'strong',
  em: 'em',
  pre: 'pre',
  code: 'code',
  blockquote: 'blockquote',
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
}
const allowedElements = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'pre',
  'code',
  'blockquote',
  'a',
  'br',
]

// Download progress should not cause release notes to be parsed again.
export default memo(function DesktopReleaseNotes({ notes }: { notes: string }) {
  const t = useT()
  return (
    <ScrollShadow
      className="desktop-update-notes"
      size={16}
      tabIndex={0}
      role="region"
      aria-label={t('appUpdate.notes')}
    >
      <Streamdown
        className="desktop-update-markdown"
        mode="static"
        controls={false}
        components={components}
        allowedElements={allowedElements}
      >
        {notes}
      </Streamdown>
    </ScrollShadow>
  )
})
