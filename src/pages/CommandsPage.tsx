import { Button, Modal, ScrollShadow } from '@heroui/react'
import { useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { isDesktop, useWorkspace } from '../store/workspace'
import { buildLibrary, matchesLibrary, type LibraryEntry } from '../lib/capabilities/library'
import { defaultCapabilities } from '../lib/capabilities/catalog'
import { capabilityError, setCapabilityMode } from '../lib/capabilities/bridge'
import { desktopCommandId } from '../lib/commands'
import { navigateToPage } from '../router/navigation'
import { useCapabilityPreferences } from './settings/useCapabilityPreferences'
import { useComposerCapabilities } from '../components/composer/useComposerCapabilities'
import { CapabilityEditor } from '../components/capabilities/CapabilityEditor'
import { SidebarLayout } from '../layouts/SidebarLayout'
import { useT } from '../lib/i18n'
import { LibraryBrowser, type LibraryFilters } from './commands/LibraryBrowser'
import { LibraryDetail } from './commands/LibraryDetail'
import { CommandEmpty } from './commands/CommandFeedback'
import { CapabilitySourcePicker } from './commands/CapabilitySourcePicker'
import { useCommandsPage, type CommandServices } from './commands/useCommandsPage'

export function CommandsPage({ services }: { services?: CommandServices }) {
  const t = useT(),
    reduced = useReducedMotion()
  const native = useCommandsPage(services),
    preferences = useCapabilityPreferences()
  const requested = useWorkspace((s) => s.commandCapabilityId)
  const bridge = useWorkspace((s) => s.capabilityBridge)
  const [filters, setFilters] = useState<LibraryFilters>({
    query: '',
    source: 'all',
    kind: 'all',
    status: 'all',
  })
  const [detailOpen, setDetailOpen] = useState(() =>
      Boolean(useWorkspace.getState().commandCapabilityId),
    ),
    [picker, setPicker] = useState(false)
  const [deleting, setDeleting] = useState<LibraryEntry | null>(null)
  const [actionError, setActionError] = useState(''),
    [acting, setActing] = useState(false)
  const detail = useRef<HTMLDivElement>(null)
  const commands = native.connected
    ? native.all
    : preferences.commands.filter((command) => command.source === 'builtin')
  const composer = useComposerCapabilities(commands)
  const extraDrafts = Object.values(preferences.edits).filter(
    (item) => !preferences.draft.items.some((saved) => saved.id === item.id),
  )
  const catalogItems = preferences.draft.items.filter(
    (item) =>
      !item.id.startsWith('runtime:') ||
      preferences.preferences.items.some((saved) => saved.id === item.id) ||
      preferences.edits[item.id] ||
      commands.some(
        (command) =>
          command.name === item.target?.name &&
          command.source === item.target.source &&
          desktopCommandId(command) ===
            `${item.target.source}:${item.target.name}:${item.target.origin}`,
      ),
  )
  const all = buildLibrary(
    commands,
    [
      ...catalogItems,
      ...extraDrafts.map((item) => ({ ...item, name: item.name || t('library.newPrompt') })),
    ],
    preferences.draft.disabledCommandIds || [],
    t,
    native.connected && !native.loading,
    Boolean(bridge) || !isDesktop,
    bridge?.unavailableTargets,
  )
  const filtered = all.filter(
    (entry) =>
      matchesLibrary(entry, filters.query, t) &&
      (filters.source === 'all' || entry.source === filters.source) &&
      (filters.kind === 'all' || entry.kind === filters.kind) &&
      (filters.status === 'all' ||
        (filters.status === 'pinned' && entry.capability?.pinned) ||
        (filters.status === 'disabled' && !entry.enabled) ||
        (filters.status === 'unavailable' && entry.unavailable)),
  )
  const selected =
    filtered.find(
      (entry) =>
        entry.id === requested || (entry.command && desktopCommandId(entry.command) === requested),
    ) || filtered[0]
  const editing = preferences.editing
  function choose(entry: LibraryEntry, open = true) {
    useWorkspace.setState({ commandCapabilityId: entry.id })
    setActionError('')
    preferences.setSaved(false)
    if (open) setDetailOpen(true)
  }
  function newItem(item?: LibraryEntry['capability']) {
    const created = preferences.copy(item)
    setFilters({ query: '', source: 'all', kind: 'all', status: 'all' })
    useWorkspace.setState({ commandCapabilityId: created.id })
    setDetailOpen(true)
  }
  async function enable(entry: LibraryEntry, enabled: boolean) {
    setActing(true)
    setActionError('')
    try {
      if (entry.capability) {
        if (!enabled && composer.selection.mode?.id === entry.id) {
          if (native.locked) throw new Error(t('library.modeBusy'))
          await setCapabilityMode(undefined)
        }
        await preferences.saveItem({ ...entry.capability, enabled })
      } else await preferences.toggleCommand(entry.id, enabled)
    } catch (error) {
      setActionError(capabilityError(error))
    } finally {
      setActing(false)
    }
  }
  async function removeEntry() {
    if (!deleting || acting || preferences.saving) return
    setActing(true)
    try {
      if (composer.selection.mode?.id === deleting.id) {
        if (native.locked) throw new Error(t('library.modeBusy'))
        await setCapabilityMode(undefined)
      }
      if (
        await preferences.commitItems((items) => items.filter((item) => item.id !== deleting.id))
      ) {
        preferences.setEditing(null)
        setDeleting(null)
        useWorkspace.setState({ commandCapabilityId: null })
      }
    } catch (error) {
      setActionError(capabilityError(error))
    } finally {
      setActing(false)
    }
  }
  return (
    <motion.div
      className="utility-view commands-view library-view"
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.2 }}
    >
      <SidebarLayout
        className={`commands-workspace library-workspace ${detailOpen ? 'is-detail-open' : ''} ${filtered.length ? '' : 'is-empty'}`}
        collapseAt={780}
        label={t('layout.resizeCommands')}
        sidebar={
          <LibraryBrowser
            all={all}
            entries={filtered}
            selected={selected?.id || null}
            filters={filters}
            onFilter={(patch) => {
              setFilters((old) => ({ ...old, ...patch }))
              setDetailOpen(false)
            }}
            onChoose={choose}
            onNew={(kind) => (kind === 'shortcut' ? setPicker(true) : newItem())}
            refresh={() => void native.refresh()}
            loading={native.loading}
            error={native.error}
            hasDraft={(id) => Boolean(preferences.edits[id])}
          />
        }
      >
        <ScrollShadow
          ref={detail}
          className="commands-detail library-detail"
          hideScrollBar
          aria-label={t('capability.details')}
        >
          {selected ? (
            <LibraryDetail
              entry={selected}
              saving={preferences.saving || acting || composer.pending}
              locked={native.locked}
              activeMode={composer.selection.mode?.id === selected.id}
              status={preferences.saved ? t('capability.saved') : ''}
              error={actionError || preferences.storageError || composer.error}
              onBack={() => setDetailOpen(false)}
              onEnable={(enabled) => void enable(selected, enabled)}
              onPin={() => {
                if (selected.capability)
                  void preferences.saveItem({
                    ...selected.capability,
                    pinned: !selected.capability.pinned,
                  })
              }}
              onEdit={() => {
                preferences.setSaved(false)
                if (selected.capability) preferences.setEditing(selected.capability)
              }}
              onCopy={() => newItem(selected.capability)}
              onRestore={() => {
                const original = defaultCapabilities(t).find(
                  (item) => item.builtin === selected.capability?.builtin,
                )
                if (original) void preferences.saveItem(original)
              }}
              onDelete={() => setDeleting(selected)}
              onUse={() => {
                if (selected.capability)
                  void (
                    composer.selection.task?.id === selected.id
                      ? Promise.resolve(true)
                      : composer.select(selected.capability)
                  ).then((ok) => {
                    if (ok) void navigateToPage('chat')
                  })
              }}
              native={native}
            />
          ) : (
            <div className="library-detail-empty">
              <CommandEmpty
                title={t('capability.empty')}
                detail={filters.query ? t('commands.searchHint') : ''}
              />
            </div>
          )}
        </ScrollShadow>
      </SidebarLayout>
      {editing && (
        <CapabilityEditor
          key={editing.id}
          initial={editing}
          items={preferences.draft.items}
          reservedAliases={commands
            .filter((command) => command.source === 'builtin')
            .map((command) => command.name)}
          onDraftChange={preferences.updateEditing}
          saveError={preferences.storageError || ''}
          onClose={() => preferences.setEditing(null)}
          onSave={async (value) => {
            if (await preferences.saveItem(value)) {
              preferences.setEditing(null)
              useWorkspace.setState({ commandCapabilityId: value.id })
            }
          }}
        />
      )}
      {picker && (
        <CapabilitySourcePicker
          items={preferences.draft.items}
          onClose={() => setPicker(false)}
          onChoose={(item) => {
            setPicker(false)
            newItem(item)
          }}
        />
      )}
      {deleting && (
        <Modal.Backdrop
          isOpen
          onOpenChange={(open) => {
            if (!open && !preferences.saving) setDeleting(null)
          }}
        >
          <Modal.Container size="sm">
            <Modal.Dialog className="form-dialog">
              <Modal.Header>
                <Modal.Heading>{t('library.deleteTitle', { name: deleting.name })}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p>{t('library.deleteHelp')}</p>
                {(preferences.storageError || actionError) && (
                  <p role="alert">{preferences.storageError || actionError}</p>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="ghost"
                  isDisabled={preferences.saving}
                  onPress={() => setDeleting(null)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="danger"
                  isPending={preferences.saving || acting}
                  onPress={() => void removeEntry()}
                >
                  {t('capability.delete')}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      )}
    </motion.div>
  )
}
