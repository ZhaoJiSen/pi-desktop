import { Button, ListBox, NumberField, Select, Switch } from '@heroui/react'
import { useEffect, useMemo, useState } from 'react'
import { useT } from '../../lib/i18n'
import {
  applyFonts,
  codeLeadingScale,
  codeSizeRange,
  defaultFonts,
  fontStacks,
  fontsEqual,
  loadSystemFonts,
  quoteFamily,
  readingLeadingScale,
  readingSizeRange,
  uiSizeRange,
  type FontLeading,
  type FontPreferences,
  type SystemFont,
} from '../../lib/fonts'
import { useWorkspace } from '../../store/workspace'

const leadings: FontLeading[] = ['compact', 'standard', 'loose']
const systemId = '__system__'

const previewCode = `const reply = await ask(session)
// 中文注释保持可读
if (reply !== null) return reply`

export function FontSettings() {
  const committed = useWorkspace((state) => state.fonts)
  const setPreference = useWorkspace((state) => state.setPreference)
  const [draft, setDraft] = useState(committed)
  const [previous, setPrevious] = useState(committed)
  // Discard stale edits before rendering rather than cascading from an effect.
  if (previous !== committed) {
    setPrevious(committed)
    setDraft(committed)
  }
  const [catalog, setCatalog] = useState<SystemFont[]>([])
  const t = useT()
  useEffect(() => {
    let alive = true
    void loadSystemFonts().then((fonts) => {
      if (!alive || !fonts.length) return
      setCatalog(fonts)
      applyFonts(document.documentElement, useWorkspace.getState().fonts)
    })
    return () => {
      alive = false
    }
  }, [])
  function edit(patch: Partial<FontPreferences>) {
    setDraft((current) => ({ ...current, ...patch }))
  }
  function apply() {
    setPreference({ fonts: draft })
    applyFonts(document.documentElement, draft)
  }
  const stacks = fontStacks(draft)
  const proportional = catalog.filter((font) => !font.monospace)
  return (
    <section className="settings-section settings-fonts" aria-labelledby="settings-fonts">
      <h2 id="settings-fonts">{t('settings.fonts')}</h2>
      <div className="settings-rows">
        <div className="settings-row">
          <div className="settings-row-text">
            <span id="settings-font-ui-size">{t('settings.fonts.uiSize')}</span>
            <p className="settings-help">{t('settings.fonts.uiHelp')}</p>
          </div>
          <SizeField
            value={draft.uiSize}
            min={uiSizeRange.min}
            max={uiSizeRange.max}
            label={t('settings.fonts.uiSize')}
            onChange={(uiSize) => edit({ uiSize })}
          />
        </div>
        <div className="settings-row">
          <div className="settings-row-text">
            <span id="settings-font-reading-size">{t('settings.fonts.readingSize')}</span>
            <p className="settings-help">{t('settings.fonts.readingHelp')}</p>
          </div>
          <SizeField
            value={draft.readingSize}
            min={readingSizeRange.min}
            max={readingSizeRange.max}
            label={t('settings.fonts.readingSize')}
            onChange={(readingSize) => edit({ readingSize })}
          />
        </div>
        <div className="settings-row">
          <div className="settings-row-text">
            <span id="settings-font-code-size">{t('settings.fonts.codeSize')}</span>
            <p className="settings-help">{t('settings.fonts.codeSizeHelp')}</p>
          </div>
          <SizeField
            value={draft.codeSize}
            min={codeSizeRange.min}
            max={codeSizeRange.max}
            label={t('settings.fonts.codeSize')}
            onChange={(codeSize) => edit({ codeSize })}
          />
        </div>
        <div className="settings-row">
          <div className="settings-row-text">
            <span id="settings-font-ui">{t('settings.fonts.ui')}</span>
            <p className="settings-help">{t('settings.fonts.uiFamilyHelp')}</p>
            {stacks.missingUi && <p className="settings-help">{t('settings.fonts.missing')}</p>}
          </div>
          <FontSelect
            labelId="settings-font-ui"
            value={draft.uiFamily}
            fonts={proportional}
            systemLabel={t('settings.fonts.system')}
            missing={stacks.missingUi}
            onChange={(uiFamily) => edit({ uiFamily })}
          />
        </div>
        <div className="settings-row settings-font-family-row">
          <div className="settings-row-text">
            <span id="settings-font-code">{t('settings.fonts.code')}</span>
            <p className="settings-help">{t('settings.fonts.codeHelp')}</p>
            {stacks.missingCode && <p className="settings-help">{t('settings.fonts.missing')}</p>}
          </div>
          <FontSelect
            labelId="settings-font-code"
            value={draft.codeFamily}
            fonts={catalog}
            systemLabel={t('settings.fonts.systemMono')}
            missing={stacks.missingCode}
            onChange={(codeFamily) => edit({ codeFamily })}
          />
          <FontPreview fonts={draft} />
        </div>
        <div className="settings-row">
          <div className="settings-row-text">
            <span id="settings-font-reading-leading">{t('settings.fonts.readingLeading')}</span>
            <p className="settings-help">{t('settings.fonts.readingLeadingHelp')}</p>
          </div>
          <LeadingSelect
            value={draft.readingLeading}
            onChange={(readingLeading) => edit({ readingLeading })}
          />
        </div>
        <div className="settings-row">
          <div className="settings-row-text">
            <span id="settings-font-code-leading">{t('settings.fonts.codeLeading')}</span>
            <p className="settings-help">{t('settings.fonts.codeLeadingHelp')}</p>
          </div>
          <LeadingSelect
            value={draft.codeLeading}
            onChange={(codeLeading) => edit({ codeLeading })}
          />
        </div>
        <div className="settings-row">
          <div className="settings-row-text">
            <span id="settings-font-fallback">{t('settings.fonts.fallback')}</span>
            <p className="settings-help">{t('settings.fonts.fallbackHelp')}</p>
            {stacks.missingFallback && (
              <p className="settings-help">{t('settings.fonts.missing')}</p>
            )}
          </div>
          <FontSelect
            labelId="settings-font-fallback"
            value={draft.codeFallback}
            fonts={proportional}
            systemLabel={t('settings.fonts.followUi')}
            missing={stacks.missingFallback}
            onChange={(codeFallback) => edit({ codeFallback })}
          />
        </div>
        <div className="settings-row">
          <div className="settings-row-text">
            <span id="settings-font-ligatures">{t('settings.fonts.ligatures')}</span>
            <p className="settings-help">{t('settings.fonts.ligaturesHelp')}</p>
          </div>
          <Switch
            className="settings-inline-switch"
            aria-labelledby="settings-font-ligatures"
            isSelected={draft.ligatures}
            onChange={(ligatures) => edit({ ligatures })}
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </div>
        <div className="settings-font-footer">
          <Button
            size="sm"
            variant="ghost"
            isDisabled={fontsEqual(draft, defaultFonts)}
            onPress={() => setDraft({ ...defaultFonts })}
          >
            {t('settings.fonts.restore')}
          </Button>
          <Button size="sm" isDisabled={fontsEqual(draft, committed)} onPress={apply}>
            {t('settings.fonts.apply')}
          </Button>
        </div>
      </div>
    </section>
  )
}

function FontPreview({ fonts }: { fonts: FontPreferences }) {
  const stacks = fontStacks(fonts)
  const t = useT()
  return (
    <div className="font-preview" aria-hidden="true">
      <p
        className="font-preview-ui"
        style={{ fontFamily: stacks.ui, fontSize: `${fonts.uiSize}px` }}
      >
        {t('settings.fonts.previewUi')}
      </p>
      <p
        className="font-preview-reading"
        style={{
          fontFamily: stacks.ui,
          fontSize: `${fonts.readingSize}px`,
          lineHeight: readingLeadingScale[fonts.readingLeading],
        }}
      >
        {t('settings.fonts.previewReading')}
      </p>
      <pre
        className="font-preview-code"
        style={{
          fontFamily: stacks.code,
          fontSize: `${fonts.codeSize}px`,
          lineHeight: codeLeadingScale[fonts.codeLeading],
          fontVariantLigatures: fonts.ligatures ? 'common-ligatures contextual' : 'none',
          fontFeatureSettings: fonts.ligatures ? '"liga" 1, "calt" 1' : 'normal',
        }}
      >
        {previewCode}
      </pre>
    </div>
  )
}

function SizeField({
  value,
  min,
  max,
  label,
  onChange,
}: {
  value: number
  min: number
  max: number
  label: string
  onChange: (value: number) => void
}) {
  const t = useT()
  return (
    <NumberField
      className="settings-font-number"
      variant="secondary"
      aria-label={label}
      value={value}
      minValue={min}
      maxValue={max}
      step={1}
      onChange={(next) => {
        if (typeof next === 'number' && Number.isFinite(next)) onChange(Math.round(next))
      }}
    >
      <NumberField.Group>
        <NumberField.DecrementButton aria-label={t('settings.fonts.decrease')} />
        <NumberField.Input />
        <NumberField.IncrementButton aria-label={t('settings.fonts.increase')} />
      </NumberField.Group>
    </NumberField>
  )
}

function LeadingSelect({
  value,
  onChange,
}: {
  value: FontLeading
  onChange: (value: FontLeading) => void
}) {
  const t = useT()
  return (
    <Select
      className="settings-font-leading"
      variant="secondary"
      aria-label={t('settings.fonts.leading')}
      value={value}
      onChange={(next) => {
        if (leadings.includes(next as FontLeading)) onChange(next as FontLeading)
      }}
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover placement="bottom end">
        <ListBox>
          {leadings.map((item) => (
            <ListBox.Item key={item} id={item} textValue={t(`settings.fonts.leading.${item}`)}>
              {t(`settings.fonts.leading.${item}`)}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}

function FontSelect({
  labelId,
  value,
  fonts,
  systemLabel,
  missing,
  onChange,
}: {
  labelId: string
  value: string | null
  fonts: SystemFont[]
  systemLabel: string
  missing: boolean
  onChange: (family: string | null) => void
}) {
  const t = useT()
  const [query, setQuery] = useState('')
  const names = useMemo(() => {
    const installed = fonts.map((font) => font.family)
    const listed = value && !installed.includes(value) ? [value, ...installed] : installed
    const needle = query.trim().toLowerCase()
    return listed.filter((family) => family.toLowerCase().includes(needle))
  }, [fonts, query, value])
  const showSystem = !query.trim() || systemLabel.toLowerCase().includes(query.trim().toLowerCase())
  return (
    <Select
      className="settings-font-select"
      variant="secondary"
      aria-labelledby={labelId}
      value={value ?? systemId}
      onChange={(next) => {
        if (next == null) return
        onChange(String(next) === systemId ? null : String(next))
      }}
      onOpenChange={(open) => {
        if (!open) setQuery('')
      }}
    >
      <Select.Trigger>
        <Select.Value>
          <span style={value && !missing ? { fontFamily: quoteFamily(value) } : undefined}>
            {value ?? systemLabel}
          </span>
        </Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="settings-font-popover" placement="bottom end">
        <input
          className="settings-font-search"
          aria-label={t('settings.fonts.search')}
          placeholder={t('settings.fonts.search')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
        />
        <ListBox className="settings-font-options" aria-label={t('settings.fonts.choose')}>
          {showSystem && (
            <ListBox.Item id={systemId} textValue={systemLabel}>
              {systemLabel}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          )}
          {names.map((family) => (
            <ListBox.Item key={family} id={family} textValue={family}>
              <span style={{ fontFamily: quoteFamily(family) }}>{family}</span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
        {!showSystem && !names.length && (
          <p className="settings-font-empty">{t('settings.fonts.empty')}</p>
        )}
      </Select.Popover>
    </Select>
  )
}
