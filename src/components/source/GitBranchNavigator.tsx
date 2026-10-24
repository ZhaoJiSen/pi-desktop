import { Button, SearchField, Tooltip } from '@heroui/react'
import { ChevronDown, GitBranch, Search, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useId, useRef, useState } from 'react'
import { useT } from '../../lib/i18n'
import { branchReference } from '../../lib/source/branches'
import type { GitBranch as Branch } from '../../lib/source/types'
import { HoverScrollArea } from '../HoverScrollArea'
import { GitBranchActions } from './GitBranchActions'
import { SourceNotice } from './SourceNotice'

export function GitBranchNavigator({
  branches,
  loading,
  error,
  selected,
  projectPath,
  tick,
  onSelect,
  onChanged,
}: {
  branches: Branch[]
  loading?: boolean
  error?: string
  selected: string | null
  projectPath: string
  tick: number
  onSelect: (reference: string) => void
  onChanged?: () => void
}) {
  const t = useT()
  const reduced = useReducedMotion()
  const id = useId()
  const toggle = useRef<HTMLButtonElement>(null)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [searchCollapsed, setSearchCollapsed] = useState<Record<string, boolean>>({})
  const searching = Boolean(query.trim())
  function changeQuery(value: string) {
    setQuery(value)
    setSearchCollapsed({})
  }
  function closeSearch() {
    changeQuery('')
    setSearchOpen(false)
    toggle.current?.focus()
  }
  return (
    <section className="git-branch-navigator" aria-labelledby={`${id}-heading`}>
      <div className="git-branch-navigator-toolbar">
        <h2 id={`${id}-heading`}>
          <GitBranch />
          {t('source.branches')}
        </h2>
        <Tooltip delay={450}>
          <Button
            ref={toggle}
            isIconOnly
            size="sm"
            variant="ghost"
            className="source-action git-branch-search-toggle"
            aria-label={searchOpen ? t('source.closeBranchSearch') : t('source.searchBranches')}
            aria-expanded={searchOpen}
            aria-controls={`${id}-search`}
            onPress={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
          >
            {searchOpen ? <X /> : <Search />}
          </Button>
          <Tooltip.Content placement="bottom">
            {searchOpen ? t('source.closeBranchSearch') : t('source.searchBranches')}
          </Tooltip.Content>
        </Tooltip>
      </div>
      <AnimatePresence initial={false}>
        {searchOpen && (
          <motion.div
            id={`${id}-search`}
            className="git-branch-search-reveal"
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.16 }}
          >
            <SearchField
              className="git-search"
              variant="secondary"
              aria-label={t('source.searchBranches')}
              value={query}
              onChange={changeQuery}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  closeSearch()
                }
              }}
            >
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input autoFocus placeholder={t('source.searchBranches')} />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
          </motion.div>
        )}
      </AnimatePresence>
      <HoverScrollArea
        className="git-branches-scroll"
        viewportClassName="git-branches-viewport"
        label={t('source.branches')}
        shadowSize={18}
      >
        {loading && <SourceNotice kind="loading" text={t('source.loading')} />}
        {error && <SourceNotice kind="error" text={error} />}
        {[false, true].map((remote) => {
          const group = String(remote)
          const items = branches.filter(
            (item) =>
              item.remote === remote &&
              item.name.toLowerCase().includes(query.trim().toLowerCase()),
          )
          const expanded = !(searching ? searchCollapsed[group] : collapsed[group])
          return items.length ? (
            <section key={group}>
              <Button
                variant="ghost"
                className="git-branch-section"
                aria-expanded={expanded}
                aria-controls={`${id}-${group}`}
                onPress={() =>
                  (searching ? setSearchCollapsed : setCollapsed)((value) => ({
                    ...value,
                    [group]: !value[group],
                  }))
                }
              >
                <ChevronDown />
                <span>{t(remote ? 'source.remoteBranches' : 'source.localBranches')}</span>
                <small>{items.length}</small>
              </Button>
              <div id={`${id}-${group}`} hidden={!expanded}>
                {expanded &&
                  items.map((item) => (
                    <div className="git-branch-entry" key={branchReference(item)}>
                      <Button
                        variant="ghost"
                        className="git-branch-row"
                        aria-pressed={selected === branchReference(item)}
                        onPress={() => onSelect(branchReference(item))}
                      >
                        <GitBranch />
                        <span>{item.name}</span>
                        {item.current && (
                          <span
                            className="git-current-dot"
                            aria-label={t('source.currentBranch')}
                          />
                        )}
                      </Button>
                      <GitBranchActions
                        projectPath={projectPath}
                        branch={item}
                        tick={tick}
                        onChanged={() => onChanged?.()}
                      />
                    </div>
                  ))}
              </div>
            </section>
          ) : null
        })}
        {searching &&
          !branches.some((item) =>
            item.name.toLowerCase().includes(query.trim().toLowerCase()),
          ) && <p className="source-note">{t('source.emptyBranches')}</p>}
      </HoverScrollArea>
    </section>
  )
}
