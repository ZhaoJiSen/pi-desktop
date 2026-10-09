import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { spawn, execFileSync, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import type { SlashCommand } from '../../src/types'

const mocks = vi.hoisted(() => ({
  state: {
    activeSessionId: 'compat',
    connection: 'connected',
    runningSessionId: null,
    sessions: [{ id: 'compat', draft: 'review arguments' }],
    updateSession: vi.fn(),
  },
}))
vi.mock('../../src/router/navigation', () => ({ navigateToPage: vi.fn() }))
vi.mock('../../src/lib/desktop', () => ({ request: vi.fn() }))
vi.mock('../../src/store/workspace', () => ({
  isDesktop: true,
  useWorkspace: { getState: () => mocks.state, setState: vi.fn() },
}))
import { commandCapability, insertCommand } from '../../src/lib/commands'

type RpcMessage = { customType?: string; content?: unknown; stopReason?: string }
type RpcValue = {
  type?: string
  disposition?: string
  isStreaming?: boolean
  commands?: SlashCommand[]
  messages?: RpcMessage[]
  message?: RpcMessage
}
type ModelRequest = { messages: { role: string; content: unknown }[] }
const root = process.env.PI_DESKTOP_PI_V1_ROOT
if (!root && process.env.npm_lifecycle_event === 'verify:pi-v1') {
  throw new Error('Set PI_DESKTOP_PI_V1_ROOT to the isolated Pi CLI 1.0.0 package root')
}

// Explicit integration suite: normal offline verification reports these tests as skipped.
// The fixture uses a loopback model, a temporary HOME and agent directory, and no real credentials.
describe.skipIf(!root)('Pi CLI 1.0.0 command compatibility', () => {
  let dir: string
  let agentDir: string
  let server: Server
  let child: ChildProcessWithoutNullStreams
  let commands: SlashCommand[]
  let cli: string
  let env: NodeJS.ProcessEnv
  let seq = 0
  const pending = new Map<
    string,
    { resolve: (value: RpcValue) => void; reject: (error: Error) => void }
  >()
  const events: RpcValue[] = []
  const modelRequests: ModelRequest[] = []
  const errors: string[] = []

  async function request(command: Record<string, unknown>): Promise<RpcValue> {
    const id = `compat-${++seq}`
    const result = new Promise<RpcValue>((resolve, reject) => pending.set(id, { resolve, reject }))
    child.stdin.write(`${JSON.stringify({ ...command, id })}\n`)
    return result
  }
  async function settled(after: number) {
    await vi.waitFor(
      () => expect(events.slice(after).some((e) => e.type === 'agent_settled')).toBe(true),
      {
        timeout: 10_000,
      },
    )
    expect(
      events
        .slice(after)
        .filter((e) => e.type === 'message_end')
        .some((e) => e.message?.stopReason === 'error'),
    ).toBe(false)
  }

  function startPi() {
    child = spawn(
      process.execPath,
      [
        cli,
        '--mode',
        'rpc',
        '--offline',
        '--no-session',
        '--no-tools',
        '--no-context-files',
        '--provider',
        'compat-local',
        '--model',
        'fixture',
      ],
      {
        cwd: join(dir, 'project'),
        env,
        stdio: 'pipe',
      },
    )
    child.stderr.on('data', (data) => errors.push(String(data)))
    child.on('error', (error) => {
      for (const reply of pending.values()) reply.reject(error)
      pending.clear()
    })
    child.on('exit', (code) => {
      for (const reply of pending.values())
        reply.reject(new Error(`Pi exited (${code}): ${errors.join('')}`))
      pending.clear()
    })
    const lines = createInterface({ input: child.stdout })
    lines.on('line', (line) => {
      try {
        const value = JSON.parse(line)
        if (value.type === 'response') {
          const reply = pending.get(value.id)
          pending.delete(value.id)
          if (value.success) reply?.resolve(value.data ?? {})
          else reply?.reject(new Error(value.error))
        } else events.push(value)
      } catch (error) {
        errors.push(String(error))
      }
    })
  }

  async function stopPi() {
    if (child && child.exitCode === null) {
      const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()))
      child.kill('SIGKILL')
      await exited
    }
  }

  beforeAll(async () => {
    const packageRoot = resolve(root!)
    const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
    expect(manifest.version).toBe('1.0.0')
    cli = join(packageRoot, manifest.bin.pi)
    dir = await mkdtemp(join(tmpdir(), 'pi-desktop-v1-commands-'))
    agentDir = join(dir, 'agent')
    await mkdir(join(agentDir, 'extensions'), { recursive: true })
    await mkdir(join(agentDir, 'prompts'), { recursive: true })
    await mkdir(join(agentDir, 'skills', 'compat-skill'), { recursive: true })
    await mkdir(join(dir, 'home'))
    await mkdir(join(dir, 'project'))
    env = {
      PATH: process.env.PATH,
      HOME: join(dir, 'home'),
      PI_CODING_AGENT_DIR: agentDir,
      PI_OFFLINE: '1',
    }
    expect(
      execFileSync(process.execPath, [cli, '--version'], { env, encoding: 'utf8' }).trim(),
    ).toBe('1.0.0')

    server = createServer(async (req, res) => {
      try {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(Buffer.from(chunk))
        modelRequests.push(JSON.parse(Buffer.concat(chunks).toString()))
        expect(req.url).toBe('/v1/chat/completions')
        res.writeHead(200, { 'Content-Type': 'text/event-stream' })
        const base = {
          id: 'compat-local',
          object: 'chat.completion.chunk',
          created: 0,
          model: 'fixture',
        }
        res.write(
          `data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: { role: 'assistant', content: 'fixture response' }, finish_reason: null }] })}\n\n`,
        )
        res.write(
          `data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 } })}\n\n`,
        )
        res.end('data: [DONE]\n\n')
      } catch (error) {
        errors.push(String(error))
        res.writeHead(500).end()
      }
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Loopback server missing')
    await writeFile(
      join(agentDir, 'models.json'),
      JSON.stringify({
        providers: {
          'compat-local': {
            baseUrl: `http://127.0.0.1:${address.port}/v1`,
            api: 'openai-completions',
            apiKey: 'fixture-only',
            models: [{ id: 'fixture', contextWindow: 100000, maxTokens: 1024 }],
          },
        },
      }),
    )
    await writeFile(
      join(agentDir, 'settings.json'),
      JSON.stringify({
        compaction: { enabled: false },
        retry: { enabled: false },
      }),
    )
    await writeFile(
      join(agentDir, 'extensions', 'compat.ts'),
      `
export default function (pi) {
  pi.registerCommand('compat-echo', {
    description: 'Local command fixture',
    handler: async (args) => {
      pi.sendMessage({ customType: 'compat-echo', content: args, display: true });
    },
  });
}
`,
    )
    await writeFile(
      join(agentDir, 'prompts', 'compat-template.md'),
      '---\ndescription: Local prompt fixture\n---\nTEMPLATE_EXPANDED: $1\n',
    )
    await writeFile(
      join(agentDir, 'skills', 'compat-skill', 'SKILL.md'),
      '---\nname: compat-skill\ndescription: Local skill fixture\n---\nSKILL_BODY_EXPANDED\n',
    )

    startPi()
    commands = (await request({ type: 'get_commands' })).commands!
  }, 30_000)

  afterAll(async () => {
    await stopPi()
    if (server?.listening) await new Promise<void>((resolve) => server.close(() => resolve()))
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('discovers loaded extension commands, prompt templates and skills with actual source paths', () => {
    for (const [name, source, path] of [
      ['compat-echo', 'extension', 'extensions/compat.ts'],
      ['compat-template', 'prompt', 'prompts/compat-template.md'],
      ['skill:compat-skill', 'skill', 'skills/compat-skill/SKILL.md'],
    ] as const) {
      const command = commands.find((c) => c.name === name)
      expect(command?.source).toBe(source)
      expect(command?.sourceInfo?.path).toBe(join(agentDir, path))
      expect(commandCapability(command!)).toBe('insert')
      mocks.state.updateSession.mockClear()
      expect(insertCommand(command!)).toBe(true)
      expect(mocks.state.updateSession).toHaveBeenCalledWith('compat', {
        draft: `/${name} review arguments`,
      })
    }
    expect(commands.some((c) => c.name === 'not-loaded-extension')).toBe(false)
    expect(commands.some((c) => ['model', 'tree', 'compact'].includes(c.name))).toBe(false)
  })

  it('classifies the installed built-in definitions without disguising TUI actions as RPC prompts', async () => {
    const source = await readFile(join(resolve(root!), 'dist/core/slash-commands.js'), 'utf8')
    const names = [...source.matchAll(/name: "([^"]+)"/g)].map((m) => m[1])
    expect(names).toHaveLength(24)
    expect(names).toContain('compact')
    for (const name of names) {
      const builtin = { name, source: 'builtin' as const }
      expect(commandCapability(builtin)).toBe(
        name === 'compact'
          ? 'execute'
          : ['settings', 'model', 'thinking', 'session'].includes(name)
            ? 'navigate'
            : 'terminal',
      )
      expect(insertCommand(builtin)).toBe(false)
    }
  })

  it('dispatches an extension slash command without starting a model run', async () => {
    const calls = modelRequests.length
    const result = await request({ type: 'prompt', message: '/compat-echo echo-argument' })
    expect(result.disposition).toBe('handled')
    expect(modelRequests).toHaveLength(calls)
    const { messages } = await request({ type: 'get_messages' })
    expect(
      messages!.some((m) => m.customType === 'compat-echo' && m.content === 'echo-argument'),
    ).toBe(true)
    expect((await request({ type: 'get_state' })).isStreaming).toBe(false)
  }, 15_000)

  it('expands a prompt template and its argument before model execution, then settles', async () => {
    const after = events.length
    expect(
      (await request({ type: 'prompt', message: '/compat-template template-argument' }))
        .disposition,
    ).toBe('started')
    await settled(after)
    const last = modelRequests
      .at(-1)!
      .messages.filter((m) => m.role === 'user')
      .at(-1)!
    expect(JSON.stringify(last.content)).toContain('TEMPLATE_EXPANDED: template-argument')
    expect(JSON.stringify(last.content)).not.toContain('/compat-template')
    expect((await request({ type: 'get_state' })).isStreaming).toBe(false)
    expect(errors).toEqual([])
  }, 15_000)

  it('expands the skill body and preserves arguments before a separate model execution', async () => {
    const after = events.length
    const calls = modelRequests.length
    expect(
      (await request({ type: 'prompt', message: '/skill:compat-skill skill-argument' }))
        .disposition,
    ).toBe('started')
    await settled(after)
    expect(modelRequests).toHaveLength(calls + 1)
    const last = modelRequests
      .at(-1)!
      .messages.filter((m) => m.role === 'user')
      .at(-1)!
    expect(JSON.stringify(last.content)).toContain('SKILL_BODY_EXPANDED')
    expect(JSON.stringify(last.content)).toContain('skill-argument')
    expect(JSON.stringify(last.content)).not.toContain('/skill:compat-skill')
    expect(errors).toEqual([])
  }, 15_000)

  it('reflects actual loaded commands across removal and process reload', async () => {
    await rm(join(agentDir, 'extensions', 'compat.ts'))
    // Removing an installed file does not change the currently loaded process.
    expect(
      (await request({ type: 'get_commands' })).commands!.some(
        (c: SlashCommand) => c.name === 'compat-echo',
      ),
    ).toBe(true)
    await stopPi()
    startPi()
    const reloaded = (await request({ type: 'get_commands' })).commands!
    expect(reloaded.some((c) => c.name === 'compat-echo')).toBe(false)
    expect(reloaded.some((c) => c.name === 'compat-template' && c.source === 'prompt')).toBe(true)
    expect(reloaded.some((c) => c.name === 'skill:compat-skill' && c.source === 'skill')).toBe(true)
    expect(errors).toEqual([])
  }, 15_000)
})
