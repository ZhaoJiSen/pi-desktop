import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from '/Users/zhaojisen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const out = new URL('.', import.meta.url).pathname
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const message = {
  en: 'Could not open the project directory: No such file or directory (os error 2)',
  zh: '无法打开项目目录: No such file or directory (os error 2)',
}

async function prepare(page, { theme, language, sidebar = true }) {
  await page.goto('http://127.0.0.1:1420/#/', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.onboarding-screen, .chat-page, .startup-screen')
  // Persist rehydration can land after the first paint and put the fixture session back.
  await page.waitForTimeout(400)
  await page.evaluate(
    async ({ theme, language, sidebar }) => {
      const src = (path) =>
        performance
          .getEntriesByType('resource')
          .find((entry) => new URL(entry.name).pathname === path)?.name
      const workspace = await import(src('/src/store/workspace.ts'))
      const notices = await import(src('/src/lib/notices.ts'))
      const store = workspace.useWorkspace.getState()
      store.completeOnboarding()
      store.setPreference({ theme, language })
      const projectId = store.projects[0]?.id || store.addProject('/Users/zhaojisen/pi-desktop')
      const empty = workspace.useWorkspace
        .getState()
        .sessions.find(
          (session) => session.projectId === projectId && session.messages.length === 0,
        )
      if (empty) store.selectSession(empty.id)
      else store.createSession(projectId)
      store.setState?.({ connectionError: null, storageError: null, connection: 'disconnected' })
      workspace.useWorkspace.setState({
        connectionError: null,
        storageError: null,
        connection: 'disconnected',
        sidebarOpen: sidebar,
      })
      window.__reportActionNotice = notices.reportActionNotice
    },
    { theme, language, sidebar },
  )
  await page.waitForTimeout(800)
  const ready = await page.evaluate(() => {
    const form = document.querySelector('.chat-page.is-empty .composer')
    const any = document.querySelector('.composer')
    const style = form ? getComputedStyle(form) : null
    const box = form?.getBoundingClientRect()
    return {
      page: document.querySelector('.chat-page')?.className || null,
      shell: document.querySelector('.app-shell')?.className || null,
      opacity: style?.opacity || null,
      visibility: style?.visibility || null,
      width: box?.width || 0,
      height: box?.height || 0,
      hasAny: Boolean(any),
      text: document.body.innerText.slice(0, 160),
      innerWidth,
      match600: matchMedia('(max-width: 600px)').matches,
    }
  })
  if (
    ready.opacity !== '1' ||
    ready.visibility !== 'visible' ||
    ready.width <= 0 ||
    ready.height <= 0
  ) {
    throw new Error(`empty composer not ready: ${JSON.stringify(ready)}`)
  }
  await page.waitForFunction((theme) => document.documentElement.dataset.theme === theme, theme)
}

function overlaps(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

async function show(page, text) {
  await page.evaluate((text) => window.__reportActionNotice(new Error(text)), text)
  await page.waitForSelector('.runtime-notice.is-warning')
  await page.waitForFunction(() => {
    const toast = document.querySelector('.runtime-notice.is-warning')
    if (!toast || toast.getAttribute('data-entering') === 'true') return false
    const style = getComputedStyle(toast)
    return style.opacity === '1' && style.translate === 'none'
  })
}

async function measure(page) {
  return page.evaluate(() => {
    const box = (selector) => {
      const el = document.querySelector(selector)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return {
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        left: r.left,
        width: r.width,
        height: r.height,
      }
    }
    const toast = document.querySelector('.runtime-notice.is-warning')
    const title = toast?.querySelector('.runtime-notice-title')
    const detail = toast?.querySelector('.runtime-notice-detail')
    const titleStyle = title ? getComputedStyle(title) : null
    const detailStyle = detail ? getComputedStyle(detail) : null
    return {
      toast: box('.runtime-notice.is-warning'),
      composer: box('.composer'),
      send: box('.send'),
      header: box('.main-header'),
      rail: box('.activity-rail'),
      logo: box('.pi-logo'),
      banner: box('.connection-notice'),
      title: title?.textContent,
      detail: detail?.textContent,
      titleColor: titleStyle?.color,
      detailColor: detailStyle?.color,
      titleSize: titleStyle?.fontSize,
      detailSize: detailStyle?.fontSize,
      background: toast ? getComputedStyle(toast).backgroundColor : null,
      viewport: { width: innerWidth, height: innerHeight },
    }
  })
}

const results = []
try {
  const shots = [
    { name: 'dark-en', theme: 'dark', language: 'en', width: 1280, height: 800, scale: 1 },
    { name: 'dark-en-2x', theme: 'dark', language: 'en', width: 1280, height: 800, scale: 2 },
    { name: 'light-zh', theme: 'light', language: 'zh', width: 1280, height: 800, scale: 1 },
    {
      name: 'dark-zh-390',
      theme: 'dark',
      language: 'zh',
      width: 390,
      height: 844,
      scale: 1,
      sidebar: false,
    },
  ]
  for (const shot of shots) {
    const context = await browser.newContext({
      viewport: { width: shot.width, height: shot.height },
      deviceScaleFactor: shot.scale,
      reducedMotion: 'reduce',
    })
    const page = await context.newPage()

    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await prepare(page, shot)
    await show(page, message[shot.language])
    const metric = await measure(page)
    await page.screenshot({ path: `${out}${shot.name}.png` })
    assert(metric.toast, 'toast missing')
    assert(
      !metric.banner,
      'connection banner should stay hidden for a finished open-folder failure',
    )
    assert(
      !overlaps(metric.toast, metric.composer),
      `toast overlaps composer ${JSON.stringify(metric)}`,
    )
    assert(!overlaps(metric.toast, metric.send), `toast overlaps send ${JSON.stringify(metric)}`)
    assert(
      !overlaps(metric.toast, metric.header),
      `toast overlaps header ${JSON.stringify(metric)}`,
    )
    assert(
      !metric.rail || !overlaps(metric.toast, metric.rail),
      `toast overlaps rail ${JSON.stringify(metric)}`,
    )
    assert(!overlaps(metric.toast, metric.logo), `toast overlaps logo ${JSON.stringify(metric)}`)
    assert(metric.toast.right <= shot.width - 8, `toast clipped ${JSON.stringify(metric.toast)}`)
    assert(metric.toast.left >= 8, `toast off-screen ${JSON.stringify(metric.toast)}`)
    assert(metric.titleSize === '13px', metric.titleSize)
    assert(Number.parseFloat(metric.detailSize) >= 12, metric.detailSize)
    const title =
      shot.language === 'zh' ? '无法打开项目目录' : 'Could not open the project directory'
    assert.equal(metric.title, title)
    assert.equal(metric.detail, 'No such file or directory (os error 2)')
    const close = page.locator(
      '.runtime-notice.is-warning [aria-label="Close"], .runtime-notice.is-warning [aria-label="关闭"]',
    )
    await close.click()
    await page.waitForFunction(() => !document.querySelector('.runtime-notice.is-warning'))
    assert.equal(errors.length, 0, errors.join('\n'))
    results.push({ name: shot.name, metric, errors })
    await context.close()
  }

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  await prepare(page, { theme: 'dark', language: 'en' })
  await page.evaluate(() => {
    const src = (path) =>
      performance
        .getEntriesByType('resource')
        .find((entry) => new URL(entry.name).pathname === path)?.name
    return import(src('/src/store/workspace.ts')).then(({ useWorkspace }) => {
      useWorkspace.setState({
        connection: 'error',
        connectionError: 'The pi process has exited. Please reconnect',
      })
    })
  })
  await page.waitForSelector('.connection-notice')
  const banner = await page.locator('.connection-notice').innerText()
  assert(banner.includes('The pi process has exited'))
  assert.equal(await page.locator('.connection-notice').count(), 1)
  assert.equal(await page.locator('.runtime-notice.is-warning').count(), 0)
  await page.screenshot({ path: `${out}connection-banner-kept.png` })
  results.push({ name: 'connection-banner-kept', banner })
  await context.close()
  await mkdir(out, { recursive: true })
  const { writeFile } = await import('node:fs/promises')
  await writeFile(`${out}results.json`, JSON.stringify(results, null, 2))
  console.log(
    JSON.stringify(
      results.map(({ name, metric }) => ({ name, metric })),
      null,
      2,
    ),
  )
} finally {
  await browser.close()
}
