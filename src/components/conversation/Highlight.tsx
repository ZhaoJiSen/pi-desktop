import { memo } from 'react'
import Prism from 'prismjs'
import 'prismjs/components/prism-markup'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-toml'

function PrismToken({ token }: { token: string | Prism.Token }) {
  if (typeof token === 'string') return token
  const content = Array.isArray(token.content) ? token.content : [token.content]
  return (
    <span className={`syntax-token syntax-${token.type}`}>
      {content.map((child, i) => (
        <PrismToken key={i} token={child} />
      ))}
    </span>
  )
}

const prismAlias: Record<string, string> = {
  ts: 'typescript',
  typescript: 'typescript',
  js: 'javascript',
  javascript: 'javascript',
  jsx: 'jsx',
  tsx: 'tsx',
  py: 'python',
  python: 'python',
  sh: 'bash',
  shell: 'bash',
  bash: 'bash',
  zsh: 'bash',
  console: 'bash',
  yml: 'yaml',
  yaml: 'yaml',
  md: 'markdown',
  markdown: 'markdown',
  markup: 'markup',
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  css: 'css',
  json: 'json',
  rust: 'rust',
  rs: 'rust',
  go: 'go',
  sql: 'sql',
  toml: 'toml',
}
function prismGrammar(language: string) {
  const name = prismAlias[language.toLowerCase()]
  return name ? Prism.languages[name] : undefined
}
export const Highlight = memo(function Highlight({
  text,
  language = 'tsx',
}: {
  text: string
  language?: string
}) {
  // Large files remain complete and copyable without building hundreds of
  // thousands of syntax-token nodes or running a large regex grammar.
  const grammar = text.length <= 50_000 ? prismGrammar(language) : undefined
  const tokens = grammar ? Prism.tokenize(text, grammar) : [text]
  return (
    <>
      {tokens.map((token, index) => (
        <PrismToken key={index} token={token} />
      ))}
    </>
  )
})

// Resolve only known source files. Shell command output remains plain text.
export function fileLanguage(path: string): string {
  const name = path.split(/[\\/]/).at(-1)?.toLowerCase() || ''
  const extension = name.split('.').at(-1) || ''
  return prismAlias[extension] || ''
}
