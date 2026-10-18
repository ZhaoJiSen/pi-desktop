import { Button, Description, Label, ListBox, Modal } from '@heroui/react'
import { useState } from 'react'
import { CapabilitySearch } from '../../components/capabilities/CapabilitySearch'
import { capabilitySource, matchesCapability } from '../../lib/capabilities/display'
import { useT } from '../../lib/i18n'
import type { Capability } from '../../lib/capabilities/types'
export function CapabilitySourcePicker({
  items,
  onChoose,
  onClose,
}: {
  items: Capability[]
  onChoose: (item: Capability) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState(''),
    t = useT()
  const filtered = items.filter((item) => matchesCapability(item, query))
  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Modal.Container size="md">
        <Modal.Dialog className="form-dialog library-source-picker">
          <Modal.Header>
            <Modal.Heading>{t('library.newShortcut')}</Modal.Heading>
            <Modal.CloseTrigger aria-label={t('common.close')} />
          </Modal.Header>
          <Modal.Body>
            <CapabilitySearch value={query} onChange={setQuery} />
            <ListBox
              aria-label={t('library.chooseSource')}
              onAction={(id) => {
                const item = items.find((item) => item.id === id)
                if (item) onChoose(item)
              }}
            >
              {filtered.map((item) => (
                <ListBox.Item key={item.id} id={item.id} textValue={`${item.name} ${item.alias}`}>
                  <div>
                    <Label>{item.name}</Label>
                    <Description>
                      {capabilitySource(item, t)} · /{item.alias}
                    </Description>
                  </div>
                </ListBox.Item>
              ))}
            </ListBox>
            {!filtered.length && <p className="capability-empty">{t('capability.empty')}</p>}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" onPress={onClose}>
              {t('common.cancel')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
