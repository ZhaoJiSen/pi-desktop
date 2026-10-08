import { Button, Popover, ScrollShadow } from '@heroui/react'
import { useDebounce } from 'ahooks'
import { Check, ChevronDown, Search } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { useWorkspace } from '../store/workspace'
import { changeModel } from '../lib/desktop'
import { useT } from '../lib/i18n'
import { errorText, modelKey, tokens } from '../lib/utils'
import type { Model } from '../types'

export function ModelSelector() {
  const models = useWorkspace(state => state.models)
  const recent = useWorkspace(state => state.recentModels)
  const session = useWorkspace(state => state.sessions.find(item => item.id === state.activeSessionId))
  const busy = useWorkspace(state => Boolean(state.runningSessionId) || state.connection === 'connecting')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [changing, setChanging] = useState(false)
  const search = useDebounce(query.trim().toLowerCase(), { wait: 100 })
  const t = useT()
  const selected = models.find(model => modelKey(model) === session?.modelKey)
  const filtered = models.filter(model => `${model.name} ${model.provider} ${model.id}`.toLowerCase().includes(search))
  const recentModels = !search ? recent.map(key => filtered.find(model => modelKey(model) === key)).filter((model): model is Model => Boolean(model)) : []
  const remaining = filtered.filter(model => !recentModels.includes(model))
  const groups = new Map<string, Model[]>()
  for (const model of remaining) {
    const group = groups.get(model.provider)
    if (group) group.push(model)
    else groups.set(model.provider, [model])
  }
  async function choose(model: Model) {
    if (changing) return
    setChanging(true)
    try { await changeModel(model); setOpen(false) } catch (error) { useWorkspace.setState({ connectionError: errorText(error) }) } finally { setChanging(false) }
  }
  const row = (model: Model, showProvider = false) => <Button key={modelKey(model)} variant="ghost" className="model-row" isDisabled={changing} onPress={() => void choose(model)} aria-label={`${model.name}, ${model.provider}`}>
    <span className="model-row-copy"><span>{model.name}</span><span className="model-description">{showProvider ? `${model.provider} · ` : ''}{tokens(model.contextWindow)} context</span></span>
    {modelKey(model) === session?.modelKey && <motion.span layoutId="model-check"><Check /></motion.span>}
  </Button>
  return <Popover isOpen={open} onOpenChange={value => { setOpen(value); if (!value) setQuery('') }}>
    <Button variant="ghost" className="composer-select model-trigger" isDisabled={busy || changing} aria-label={t('选择模型')}><span>{selected?.name || t('选择模型')}</span><ChevronDown className="chevron" /></Button>
    <Popover.Content placement="top start" className="model-popover" offset={12}>
      <Popover.Dialog aria-label={t('选择模型')}>
        <AnimatePresence><motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .2 }}>
          <label className="popover-search"><Search /><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder={t('搜索模型名称、提供商或 ID…')} aria-label={t('搜索')} /></label>
          <ScrollShadow className="model-options" orientation="vertical" size={12}>
            {recentModels.length > 0 && <div className="model-group" role="group" aria-label={t('最近使用')}><div className="option-label model-group-label">{t('最近使用')}</div>{recentModels.map(model => row(model, true))}</div>}
            {Array.from(groups, ([provider, items]) => <div key={provider} className="model-group" role="group" aria-label={provider}>
              <div className="option-label model-group-label">{provider}</div>
              {items.map(model => row(model))}
            </div>)}
            {!filtered.length && <div className="popover-empty">{t('没有匹配的模型')}</div>}
          </ScrollShadow>
        </motion.div></AnimatePresence>
      </Popover.Dialog>
    </Popover.Content>
  </Popover>
}
