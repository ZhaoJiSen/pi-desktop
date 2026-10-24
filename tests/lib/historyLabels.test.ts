import { describe, expect, it } from 'vitest'
import { branchKind, commitLabel, historyReferences } from '../../src/lib/source/historyLabels'

describe('History label types', () => {
  it('distinguishes real tags from similarly named branches', () => {
    expect(
      historyReferences('HEAD -> main, origin/main, tag: v1.0, refs/tags/feat-release').map(
        ({ label, kind, current }) => ({ label, kind, current }),
      ),
    ).toEqual([
      { label: 'main', kind: 'branch', current: true },
      { label: 'origin/main', kind: 'branch', current: false },
      { label: 'v1.0', kind: 'tag', current: false },
      { label: 'feat-release', kind: 'tag', current: false },
    ])
    expect(branchKind('tag/ordinary-branch')).toBe('branch')
  })
  it.each([
    ['feat/login', 'feat'],
    ['origin/feature/login', 'feat'],
    ['fix_error', 'fix'],
    ['origin/hotfix/login', 'fix'],
    ['origin/pr@dev@feat_account', 'feat'],
    ['release/2.0', 'release'],
    ['main', 'branch'],
    ['featureful', 'branch'],
    ['prefix-fix-is-a-word', 'branch'],
  ])('classifies %s as %s without keyword guesses', (name, expected) => {
    expect(branchKind(name)).toBe(expected)
  })
  it('keeps scopes, breaking markers and message text intact', () => {
    expect(commitLabel('feat(auth)!: support passkeys')).toEqual({
      kind: 'feat',
      prefix: 'feat(auth)!: ',
      message: 'support passkeys',
    })
    expect(commitLabel('fix: handle errors').kind).toBe('fix')
    expect(commitLabel('Fix a feature regression')).toEqual({
      kind: 'branch',
      prefix: '',
      message: 'Fix a feature regression',
    })
  })
  it.each([
    ['feat :  Asset import supports account information', 'feat'],
    ['perf：Update the syslog page', 'perf'],
    ['FIX (api) ! ： handle errors', 'fix'],
    ['style: align controls', 'style'],
    ['release: 2.0', 'release'],
    ['feat(auth): scoped', 'feat'],
    ['feature: ordinary prose', 'branch'],
    ['Fix a bug: without a type prefix', 'branch'],
    ['Revert "feat: previous change"', 'branch'],
  ])('recognizes %s without classifying ordinary descriptions', (subject, kind) => {
    const label = commitLabel(subject)
    expect(label.kind).toBe(kind)
    expect(label.prefix + label.message).toBe(subject)
  })
})
