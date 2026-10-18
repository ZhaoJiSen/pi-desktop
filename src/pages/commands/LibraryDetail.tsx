import { Button, Card, Chip, Label, Switch } from '@heroui/react'
import { ArrowLeft, ArrowRight, Copy, Pencil, Pin, PinOff, RotateCcw, Trash2 } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { ModelSelector } from '../../components/ModelSelector'
import { CapabilityIcon } from '../../components/capabilities/CapabilityIcon'
import { commandCapability } from '../../lib/commands'
import type { LibraryEntry } from '../../lib/capabilities/library'
import { isPlanCapability } from '../../lib/capabilities/catalog'
import { useT } from '../../lib/i18n'
import { useWorkspace } from '../../store/workspace'
import { resourcePackage } from '../../lib/capabilities/resourcePackage'
import { packageName } from '../../lib/packages'
import { navigateToExtensionSource } from '../../router/navigation'
import type { CommandsController } from './useCommandsPage'

export function LibraryDetail({
  entry,
  saving,
  locked,
  activeMode,
  status,
  error,
  onBack,
  onEnable,
  onPin,
  onEdit,
  onCopy,
  onRestore,
  onDelete,
  onUse,
  native,
}: {
  entry: LibraryEntry
  saving: boolean
  locked: boolean
  activeMode: boolean
  status: string
  error: string
  onBack: () => void
  onEnable: (enabled: boolean) => void
  onPin: () => void
  onEdit: () => void
  onCopy: () => void
  onRestore: () => void
  onDelete: () => void
  onUse: () => void
  native: Pick<CommandsController, 'execute' | 'open' | 'executing' | 'notice' | 'actionError'>
}) {
  const t = useT(),
    reduced = useReducedMotion(),
    capability = entry.capability,
    command = entry.command
  const packages = useWorkspace((state) => state.packages)
  const owner = resourcePackage(command, packages)
  const action = command && commandCapability(command)
  return (
    <motion.div
      key={entry.id}
      initial={reduced ? false : { opacity: 0, x: 4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: reduced ? 0 : 0.12 }}
    >
      <Card variant="transparent" className="command-inspector library-inspector">
        <Card.Header>
          <Button className="library-back" variant="ghost" onPress={onBack}>
            <ArrowLeft />
            {t('capability.library')}
          </Button>
          <div className="command-inspector-heading">
            <Card.Title>
              {capability && <CapabilityIcon name={capability.icon} />}
              {entry.name}
            </Card.Title>
            <Chip size="sm" variant="soft">
              {t(`library.kind.${entry.kind}`)}
            </Chip>
          </div>
          <Card.Description className="command-summary">
            {entry.description || t('commands.noDescription')}
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <div className="library-entry-options">
            <Switch
              isSelected={entry.enabled}
              isDisabled={saving || (locked && activeMode)}
              onChange={onEnable}
            >
              <Switch.Content>
                <Label>{t('library.desktopEnabled')}</Label>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
            {capability && (
              <Button
                variant="secondary"
                aria-pressed={capability.pinned}
                isDisabled={saving}
                onPress={onPin}
              >
                {capability.pinned ? <PinOff /> : <Pin />}
                {t(capability.pinned ? 'capability.unpin' : 'capability.pinned')}
              </Button>
            )}
            {capability && (
              <Button variant="secondary" isDisabled={saving} onPress={onEdit}>
                <Pencil />
                {t('capability.edit')}
              </Button>
            )}
          </div>
          <dl className="library-metadata">
            <div>
              <dt>{t('capability.source')}</dt>
              <dd>
                {t(`library.source.${entry.source}`)}
                {entry.source === 'plugin' || entry.source === 'local' || capability?.target
                  ? ` · ${entry.origin}`
                  : ''}
              </dd>
            </div>
            {!capability && (
              <div>
                <dt>{t('library.invocation')}</dt>
                <dd>
                  {t(
                    action === 'execute'
                      ? 'library.invoke.execute'
                      : action === 'navigate'
                        ? 'library.invoke.navigate'
                        : 'library.invoke.terminal',
                  )}
                </dd>
              </div>
            )}
            <div>
              <dt>{t('capability.aliasLabel')}</dt>
              <dd>
                <Chip size="sm" variant="soft" className="capability-alias">
                  /{entry.alias}
                </Chip>
              </dd>
            </div>
            {capability && (
              <div>
                <dt>{t('capability.scope')}</dt>
                <dd>
                  {t(capability.scope === 'session' ? 'capability.session' : 'capability.once')}
                </dd>
              </div>
            )}
          </dl>
          {!entry.enabled && (
            <p className="library-status" role="status">
              {t('library.disabledHelp')}
            </p>
          )}
          {entry.unavailable && (
            <p className="library-status" role="status">
              {capability
                ? entry.unavailableReason
                : t(action === 'terminal' ? 'commands.terminalOnly' : 'commands.disconnected')}
            </p>
          )}
          {capability && (
            <>
              {isPlanCapability(capability) && (
                <p className="library-status">{t('capability.planHelp')}</p>
              )}
              {capability.target && (
                <div className="library-readonly">
                  <h3>{t('library.original')}</h3>
                  <code>
                    /{capability.target.name}
                    {capability.arguments ? ` ${capability.arguments}` : ''}
                  </code>
                  <p>{t('library.nativeReadOnly')}</p>
                  <small className="capability-origin">{capability.target.origin}</small>
                  {entry.kind === 'skill' && <h3>{t('library.skillManagement')}</h3>}
                  {(owner || entry.kind === 'skill') && (
                    <p>
                      {owner
                        ? t('library.packageSkillHelp', { name: packageName(owner.source) })
                        : t('library.localSkillHelp')}
                    </p>
                  )}
                  <Button variant="secondary" onPress={() => void navigateToExtensionSource(owner)}>
                    {t(owner ? 'library.manageSource' : 'library.openSkills')}
                    <ArrowRight />
                  </Button>
                </div>
              )}
              {capability.prompt && (
                <div className="library-instructions">
                  <h3>
                    {t(capability.target ? 'library.extraInstructions' : 'capability.prompt')}
                  </h3>
                  <p>{capability.prompt}</p>
                </div>
              )}
            </>
          )}
          {!capability && command && (
            <div className="command-usage">
              <h3>{t('commands.usage')}</h3>
              <div className="command-syntax">
                <code>
                  /{command.name}
                  {command.argumentHint ? ` ${command.argumentHint}` : ''}
                </code>
              </div>
              <p className="library-status">{t('library.systemReadOnly')}</p>
            </div>
          )}
        </Card.Content>
        <Card.Footer className="library-actions">
          {capability ? (
            <Button
              className="library-primary"
              isDisabled={saving || locked || entry.unavailable || !entry.enabled}
              onPress={onUse}
            >
              <ArrowRight />
              {t(
                capability.scope === 'session'
                  ? activeMode
                    ? 'library.closeMode'
                    : 'library.useMode'
                  : 'library.use',
              )}
            </Button>
          ) : command && action === 'execute' ? (
            <Button
              className="library-primary"
              isDisabled={locked || saving || !entry.enabled}
              isPending={native.executing}
              onPress={() => void native.execute(command)}
            >
              {t('commands.execute')}
            </Button>
          ) : command && action === 'navigate' && command.name === 'model' ? (
            entry.enabled && !locked && <ModelSelector />
          ) : command && action === 'navigate' ? (
            <Button
              className="library-primary"
              isDisabled={locked || saving || !entry.enabled}
              onPress={() => native.open(command)}
            >
              <ArrowRight />
              {t(
                command.name === 'settings'
                  ? 'navigation.settings'
                  : command.name === 'session'
                    ? 'navigation.usage'
                    : 'commands.openComposer',
              )}
            </Button>
          ) : null}
          {capability && (
            <Button variant="ghost" isDisabled={saving} onPress={onCopy}>
              <Copy />
              {t('library.duplicate')}
            </Button>
          )}
          {capability?.builtin && (
            <Button variant="ghost" isDisabled={saving} onPress={onRestore}>
              <RotateCcw />
              {t('capability.restore')}
            </Button>
          )}
          {capability && !capability.builtin && !capability.id.startsWith('runtime:') && (
            <Button
              variant="ghost"
              className="library-delete"
              isDisabled={saving}
              onPress={onDelete}
            >
              <Trash2 />
              {t('capability.delete')}
            </Button>
          )}
        </Card.Footer>
        {(status || error || native.notice || native.actionError) && (
          <p
            className={`library-feedback ${error || native.actionError ? 'is-error' : ''}`}
            role={error || native.actionError ? 'alert' : 'status'}
          >
            {error || native.actionError || status || native.notice}
          </p>
        )}
      </Card>
    </motion.div>
  )
}
