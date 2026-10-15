import { Radio, RadioGroup } from '@heroui/react'
import { FolderOpen, MessageSquare } from 'lucide-react'
import { useT } from '../../lib/i18n'
import type { OnboardingController } from './useOnboarding'

export function ProjectStep({
  project,
  setProject,
  busy,
  chooseProject,
  defaultPath,
  environment,
}: Pick<
  OnboardingController,
  'project' | 'setProject' | 'busy' | 'chooseProject' | 'defaultPath' | 'environment'
>) {
  const t = useT()
  return (
    <>
      <RadioGroup
        aria-label={t('onboarding.title.project')}
        className="onboarding-project-options"
        value={project ? 'folder' : 'default'}
        isDisabled={busy}
        onChange={(value) => {
          if (value === 'default') setProject(null)
        }}
      >
        <Radio
          value="folder"
          className="onboarding-project-option"
          onPointerUp={(event) => {
            if (busy || event.button !== 0) return
            void chooseProject()
          }}
          onKeyDown={(event) => {
            if (busy || (event.key !== 'Enter' && event.key !== ' ')) return
            event.preventDefault()
            void chooseProject()
          }}
        >
          <Radio.Content className="onboarding-project-option-content">
            <FolderOpen />
            <span className="onboarding-project-option-copy">
              <strong>{t('onboarding.chooseProject')}</strong>
              <small>{project?.path || t('onboarding.chooseProjectHelp')}</small>
            </span>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
          </Radio.Content>
        </Radio>
        <Radio value="default" className="onboarding-project-option">
          <Radio.Content className="onboarding-project-option-content">
            <MessageSquare />
            <span className="onboarding-project-option-copy">
              <strong>{t('onboarding.defaultWorkspace')}</strong>
              <small>{defaultPath || t('onboarding.defaultWorkspaceHelp')}</small>
            </span>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
          </Radio.Content>
        </Radio>
      </RadioGroup>
      <p className="onboarding-path-help">{t('onboarding.projectHelp')}</p>
      {!environment && <p className="onboarding-offline">{t('onboarding.offline')}</p>}
    </>
  )
}
