import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { expect, it } from 'vitest'
import { Highlight } from '../../src/components/conversation/Highlight'

it('keeps large code output complete without creating a syntax node for every token', () => {
  const text = 'const value = 1;\n'.repeat(10_000)
  const markup = renderToStaticMarkup(createElement(Highlight, { text, language: 'typescript' }))
  expect(markup).toBe(text)
  expect(markup).not.toContain('syntax-token')
})

it('retains highlighting for normal code blocks', () => {
  expect(
    renderToStaticMarkup(
      createElement(Highlight, { text: 'const value = 1', language: 'typescript' }),
    ),
  ).toContain('syntax-token')
})
