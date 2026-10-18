import { Button } from '@heroui/react'
import { Check } from 'lucide-react'
import { useT } from '../../lib/i18n'
import type { CapabilityPreferencesController } from '../../pages/settings/useCapabilityPreferences'

export function CapabilityPreferencesControls({
  controller,
}: {
  controller: CapabilityPreferencesController
}) {
  const { storageError, saved, dirty, saving, save } = controller
  const t = useT()
  return (
    <div className="capability-autosave-status">
      <span role={storageError ? 'alert' : 'status'}>
        {storageError ||
          (saving ? (
            t('library.saving')
          ) : dirty ? (
            t('library.savePending')
          ) : saved ? (
            <>
              <Check />
              {t('library.autoSaved')}
            </>
          ) : (
            t('library.autoSaveHelp')
          ))}
      </span>
      {storageError && dirty && (
        <Button variant="secondary" size="sm" onPress={() => void save()}>
          {t('library.retrySave')}
        </Button>
      )}
    </div>
  )
}
