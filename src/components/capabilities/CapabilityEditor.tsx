import {
  Button,
  Input,
  Label,
  Modal,
  TextArea,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@heroui/react'
import { useId, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { isPlanCapability, validateCapability } from '../../lib/capabilities/catalog'
import type { Capability } from '../../lib/capabilities/types'
import { useT } from '../../lib/i18n'
import { CapabilityIconPicker } from './CapabilityIconPicker'
import { SettingsSwitch } from '../../pages/settings/SettingsSwitch'

export function CapabilityEditor({
  initial,
  items,
  onSave,
  onClose,
  onDraftChange,
  inline = false,
  saveError = '',
  reservedAliases = [],
}: {
  initial: Capability
  items: Capability[]
  onSave: (value: Capability) => void | Promise<unknown>
  onClose: () => void
  onDraftChange?: (value: Capability) => void
  inline?: boolean
  saveError?: string
  reservedAliases?: string[]
}) {
  const [value, setValue] = useState(initial)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const t = useT(),
    formId = useId(),
    reduced = useReducedMotion()
  const existing = items.some((item) => item.id === initial.id)
  const title = t(existing ? 'capability.edit' : 'library.create')
  const update = (patch: Partial<Capability>) => {
    const next = { ...value, ...patch }
    setValue(next)
    onDraftChange?.(next)
    setError('')
  }
  const form = (
    <form
      id={formId}
      onSubmit={async (event) => {
        event.preventDefault()
        if (pending) return
        const problem = validateCapability(value, items, reservedAliases)
        if (problem) {
          setError(t(`capability.validation.${problem}`))
          return
        }
        setPending(true)
        try {
          await onSave({ ...value, name: value.name.trim(), prompt: value.prompt.trim() })
        } finally {
          setPending(false)
        }
      }}
    >
      <fieldset disabled={pending} className="capability-editor-fields">
        <TextField value={value.name} onChange={(name) => update({ name })} isRequired>
          <Label>{t('capability.name')}</Label>
          <Input maxLength={80} autoFocus />
        </TextField>
        <TextField value={value.description} onChange={(description) => update({ description })}>
          <Label>{t('capability.description')}</Label>
          <TextArea rows={2} />
        </TextField>
        <TextField value={value.alias} onChange={(alias) => update({ alias })} isRequired>
          <Label>{t('capability.alias')}</Label>
          <Input />
        </TextField>
        <CapabilityIconPicker value={value.icon} onChange={(icon) => update({ icon })} />
        {!value.target && !isPlanCapability(value) && (
          <div className="capability-editor-options">
            <span>{t('capability.scope')}</span>
            <ToggleButtonGroup
              aria-label={t('capability.scope')}
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[value.scope]}
              onSelectionChange={(keys) =>
                update({ scope: keys.has('session') ? 'session' : 'once' })
              }
            >
              <ToggleButton id="once">{t('capability.once')}</ToggleButton>
              <ToggleButton id="session">{t('capability.session')}</ToggleButton>
            </ToggleButtonGroup>
          </div>
        )}
        {value.target && (
          <>
            <div className="library-readonly">
              <strong>/{value.target.name}</strong>
              <p>{t('library.nativeReadOnly')}</p>
              <small className="capability-origin">{value.target.origin}</small>
            </div>
            <TextField
              value={value.arguments || ''}
              onChange={(args) => update({ arguments: args })}
            >
              <Label>{t('capability.arguments')}</Label>
              <Input />
            </TextField>
          </>
        )}
        <TextField
          value={value.prompt}
          onChange={(prompt) => update({ prompt })}
          isRequired={!value.target}
        >
          <Label>{t(value.target ? 'library.extraInstructions' : 'capability.prompt')}</Label>
          <TextArea rows={7} />
        </TextField>
        {isPlanCapability(value) ? (
          <p className="settings-help">{t('capability.planHelp')}</p>
        ) : (
          !value.target && (
            <SettingsSwitch
              label={t('capability.modifies')}
              description={t('library.modifiesHelp')}
              isSelected={value.modifies}
              onChange={(modifies) => update({ modifies })}
            />
          )
        )}
      </fieldset>
      {(error || saveError) && (
        <p className="capability-error" role="alert">
          {error || saveError}
        </p>
      )}
    </form>
  )
  const actions = (
    <>
      <Button variant="ghost" isDisabled={pending} onPress={onClose}>
        {t('common.cancel')}
      </Button>
      <Button type="submit" form={formId} isPending={pending}>
        {t('capability.save')}
      </Button>
    </>
  )
  if (inline)
    return (
      <motion.section
        className="capability-editor library-editor"
        aria-label={title}
        initial={reduced ? false : { opacity: 0, x: 4 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: reduced ? 0 : 0.12 }}
      >
        <header>
          <h2>{title}</h2>
          <p>{initial.name || t('library.newPrompt')}</p>
        </header>
        {form}
        <footer>{actions}</footer>
      </motion.section>
    )
  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      <Modal.Container size="lg">
        <Modal.Dialog className="form-dialog capability-editor">
          <Modal.Header>
            <Modal.Heading>{title}</Modal.Heading>
            <Modal.CloseTrigger aria-label={t('common.close')} isDisabled={pending} />
          </Modal.Header>
          <Modal.Body>{form}</Modal.Body>
          <Modal.Footer>{actions}</Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
