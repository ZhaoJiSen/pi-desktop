import { ListBox, Select, Tabs, ToggleButton, ToggleButtonGroup } from '@heroui/react'
import { Clock3, Flame } from 'lucide-react'
import { useT } from '../../../lib/i18n'
import { PackageSortLabel } from './PackageSortLabel'
import type { PackageLibraryProps } from './types'

const categories = ['', 'extension', 'skill', 'prompt', 'theme'] as const

export function PackageFilters({
  sort,
  category,
  changeSort,
  changeCategory,
}: Pick<PackageLibraryProps, 'sort' | 'category' | 'changeSort' | 'changeCategory'>) {
  const t = useT()
  function categoryLabel(kind: PackageLibraryProps['category']) {
    return kind === ''
      ? t('packages.categoryAll')
      : t(
          `packages.resource.${{ extension: 'extensions', skill: 'skills', prompt: 'prompts', theme: 'themes' }[kind] as 'extensions' | 'skills' | 'prompts' | 'themes'}`,
        )
  }
  return (
    <>
      <Tabs
        selectedKey={sort}
        className="package-sort"
        onSelectionChange={(key) => changeSort(key as typeof sort)}
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label={t('packages.discover')}>
            <Tabs.Tab id="downloads" aria-label={t('packages.popular')}>
              <PackageSortLabel label={t('packages.popular')} icon={<Flame aria-hidden="true" />} />
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="recent" aria-label={t('packages.recent')}>
              <PackageSortLabel label={t('packages.recent')} icon={<Clock3 aria-hidden="true" />} />
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
      <ToggleButtonGroup
        className="package-categories"
        aria-label={t('packages.categories')}
        selectionMode="single"
        disallowEmptySelection
        isDetached
        size="sm"
        selectedKeys={[category || 'all']}
        onSelectionChange={(keys) => {
          const key = [...keys][0]
          if (key != null) changeCategory(key === 'all' ? '' : (key as typeof category))
        }}
      >
        {categories.map((kind) => (
          <ToggleButton key={kind} id={kind || 'all'} variant="ghost">
            {categoryLabel(kind)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Select
        className="package-category-select"
        aria-label={t('packages.categories')}
        value={category || 'all'}
        onChange={(value) => {
          if (value != null) changeCategory(value === 'all' ? '' : (value as typeof category))
        }}
      >
        <Select.Trigger>
          <span className="package-category-label">{t('packages.categories')}</span>
          <Select.Value>{categoryLabel(category)}</Select.Value>
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox aria-label={t('packages.categories')}>
            {categories.map((kind) => (
              <ListBox.Item key={kind || 'all'} id={kind || 'all'} textValue={categoryLabel(kind)}>
                {categoryLabel(kind)}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </>
  )
}
