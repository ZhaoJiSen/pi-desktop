import { ListBox } from '@heroui/react'
import { MessageSquare, Puzzle, Terminal } from 'lucide-react'
import { useT } from '../../lib/i18n'

export function WelcomeStep() {
  const t = useT()
  return (
    <ListBox
      className="onboarding-features"
      aria-label={t('onboarding.title.welcome')}
      selectionMode="none"
    >
      {(
        [
          { icon: MessageSquare, name: 'sessions' },
          { icon: Puzzle, name: 'management' },
          { icon: Terminal, name: 'commands' },
        ] as const
      ).map(({ icon: Icon, name }) => (
        <ListBox.Item
          key={name}
          id={name}
          textValue={`${t(`onboarding.feature.${name}`)} ${t(`onboarding.feature.${name}Help`)}`}
          className="onboarding-feature"
        >
          <Icon />
          <span>
            <span className="onboarding-feature-title">{t(`onboarding.feature.${name}`)}</span>
            <span className="onboarding-feature-help">{t(`onboarding.feature.${name}Help`)}</span>
          </span>
        </ListBox.Item>
      ))}
    </ListBox>
  )
}
