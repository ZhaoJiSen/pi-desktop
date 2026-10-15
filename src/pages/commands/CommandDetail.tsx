import { Button, Card, Chip, ScrollShadow } from '@heroui/react'
import { ArrowRight } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ModelSelector } from '../../components/ModelSelector'
import {
  commandCapability,
  commandSource,
  insertCommand,
  type DiscoverableCommand,
} from '../../lib/commands'
import { useT } from '../../lib/i18n'
import { commandKey } from './model'
import { CommandNotice } from './CommandFeedback'
import type { CommandsController } from './useCommandsPage'

const MotionCard = motion.create(Card)

type Props = Pick<
  CommandsController,
  'locked' | 'executing' | 'execute' | 'open' | 'notice' | 'actionError'
> & { item: DiscoverableCommand }

export function CommandDetail({
  item,
  locked,
  executing,
  execute,
  open,
  notice,
  actionError,
}: Props) {
  const t = useT()
  const reducedMotion = useReducedMotion()
  const hint = item
    ? t(
        commandCapability(item) === 'terminal'
          ? 'commands.terminalOnly'
          : commandCapability(item) === 'insert'
            ? 'commands.reviewParameters'
            : commandCapability(item) === 'execute'
              ? 'commands.compactHint'
              : item.name === 'model'
                ? 'commands.modelHint'
                : 'commands.desktopAction',
      )
    : ''
  return (
    <ScrollShadow className="commands-detail" hideScrollBar aria-label={`/${item.name}`}>
      <AnimatePresence initial={false} mode="wait">
        <MotionCard
          key={commandKey(item)}
          variant="transparent"
          className="command-inspector"
          initial={reducedMotion ? false : { opacity: 0, x: 5 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.12 }}
        >
          <Card.Header>
            <div className="command-inspector-heading">
              <Card.Title>/{item.name}</Card.Title>
              <Chip className="command-source" size="sm" variant="soft">
                {t(`commands.source.${item.source}`)}
              </Chip>
            </div>
            <Card.Description className="command-summary">
              {item.description || t('commands.noDescription')}
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <div className="command-usage">
              <h3>{t('commands.usage')}</h3>
              <div className="command-syntax">
                <code>
                  /{item.name}
                  {item.argumentHint ? ` ${item.argumentHint}` : ''}
                </code>
              </div>
            </div>
            {commandSource(item) && (
              <div className="command-origin">
                <h3>{t('commands.origin')}</h3>
                <p>{commandSource(item)}</p>
              </div>
            )}
          </Card.Content>
          <Card.Footer className="command-actions">
            <p className="commands-hint">{hint}</p>
            {commandCapability(item) === 'insert' && (
              <Button isDisabled={locked} onPress={() => insertCommand(item)}>
                <ArrowRight aria-hidden="true" />
                {t('commands.insert')}
              </Button>
            )}
            {commandCapability(item) === 'execute' && (
              <Button isDisabled={locked} isPending={executing} onPress={() => void execute(item)}>
                {t('commands.execute')}
              </Button>
            )}
            {commandCapability(item) === 'navigate' && item.name === 'model' && <ModelSelector />}
            {commandCapability(item) === 'navigate' && item.name !== 'model' && (
              <Button isDisabled={locked} onPress={() => open(item)}>
                <ArrowRight aria-hidden="true" />
                {t(
                  item.name === 'settings'
                    ? 'navigation.settings'
                    : item.name === 'session'
                      ? 'navigation.usage'
                      : 'commands.openComposer',
                )}
              </Button>
            )}
            {notice && <CommandNotice status="success">{notice}</CommandNotice>}
            {actionError && <CommandNotice status="danger">{actionError}</CommandNotice>}
          </Card.Footer>
        </MotionCard>
      </AnimatePresence>
    </ScrollShadow>
  )
}
