import { isPlanCapability, localizeCapability } from '../../lib/capabilities/catalog'
import { Button, Label, TextArea, TextField } from '@heroui/react'
import { ChevronRight, Settings2 } from 'lucide-react'
import { HoverScrollArea } from '../HoverScrollArea'
import { useT } from '../../lib/i18n'
import type { Capability } from '../../lib/capabilities/types'
import { navigateToCapabilities } from '../../router/navigation'

export function CapabilityDetails({
  capability: value,
  onArguments,
  showManage = true,
}: {
  capability: Capability
  onArguments?: (value: string) => void
  showManage?: boolean
}) {
  const t = useT()
  const capability = localizeCapability(value, t)
  return (
    <div className="capability-details">
      <strong>{capability.name}</strong>
      <div className="capability-details-body">
        <p>{capability.description}</p>
        <dl>
          <div>
            <dt>{t('capability.scope')}</dt>
            <dd>{t(capability.scope === 'session' ? 'capability.session' : 'capability.once')}</dd>
          </div>
          <div>
            <dt>{t('capability.source')}</dt>
            <dd>
              {capability.target
                ? `${t(`commands.source.${capability.target.source}`)} · /${capability.target.name}`
                : t(capability.builtin ? 'capability.builtin' : 'capability.user')}
            </dd>
          </div>
        </dl>
        <p>
          {t(
            isPlanCapability(capability)
              ? 'capability.planHelp'
              : capability.scope === 'session'
                ? 'capability.sessionHelp'
                : 'capability.removeAfterSend',
          )}
        </p>
        {capability.target && (
          <>
            <p>{t('capability.pluginHelp')}</p>
            <TextField
              value={capability.arguments || ''}
              onChange={onArguments}
              isReadOnly={!onArguments}
            >
              <Label>{t('capability.arguments')}</Label>
              <TextArea rows={2} />
            </TextField>
            <small className="capability-origin">{capability.target.origin}</small>
          </>
        )}
        {capability.prompt && (
          <div className="capability-instructions">
            <span>{t('capability.prompt')}</span>
            <HoverScrollArea
              className="capability-instructions-scroll"
              shadowSize={12}
              label={t('capability.prompt')}
            >
              <p>{capability.prompt}</p>
            </HoverScrollArea>
          </div>
        )}
      </div>
      {showManage && (
        <div className="capability-details-footer">
          <Button
            size="sm"
            variant="secondary"
            className="capability-details-manage"
            onPress={() => void navigateToCapabilities(capability.id, capability.target)}
          >
            <Settings2 />
            <span>{t('capability.manage')}</span>
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  )
}
