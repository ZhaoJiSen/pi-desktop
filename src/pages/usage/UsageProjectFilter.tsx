import { ListBox, Select } from '@heroui/react'
import { useT } from '../../lib/i18n'
import type { UsageController } from './useUsagePage'

export function UsageProjectFilter({
  activeProject,
  project,
  setProject,
  availableProjects,
}: Pick<UsageController, 'activeProject' | 'project' | 'setProject' | 'availableProjects'>) {
  const t = useT()
  return (
    <Select
      className="usage-project-select"
      aria-label={t('usage.projectFilter')}
      value={activeProject ? project : 'all'}
      onChange={(value) => {
        if (value != null) setProject(String(value))
      }}
    >
      <Select.Trigger>
        <Select.Value>{activeProject?.name || t('usage.allProjects')}</Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox aria-label={t('usage.projectFilter')}>
          <ListBox.Item id="all" textValue={t('usage.allProjects')}>
            {t('usage.allProjects')}
            <ListBox.ItemIndicator />
          </ListBox.Item>
          {availableProjects.map((item) => (
            <ListBox.Item key={item.id} id={item.id} textValue={item.name}>
              {item.name}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}
