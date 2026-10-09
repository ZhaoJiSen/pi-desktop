import type { CommandTag, DraftNode } from '../../types'
import { normalizeDraft } from '../../lib/draft'

export interface EditorSelection {
  start: number
  end: number
}
export function readEditor(root: Node, tags: CommandTag[]): DraftNode[] {
  const nodes: DraftNode[] = []
  function visit(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      nodes.push({ type: 'text', text: node.textContent || '' })
      return
    }
    if (!(node instanceof Element) && !(node instanceof DocumentFragment)) return
    if (node instanceof Element) {
      const id = node.getAttribute('data-command-id')
      if (id) {
        const tag = tags.find((t) => t.id === id)
        if (tag) nodes.push(tag)
        return
      }
      if (node.tagName === 'BR') {
        nodes.push({ type: 'text', text: '\n' })
        return
      }
      if (['DIV', 'P'].includes(node.tagName) && nodes.length) {
        const last = nodes.at(-1)
        if (last?.type !== 'text' || !last.text.endsWith('\n'))
          nodes.push({ type: 'text', text: '\n' })
      }
    }
    for (const child of node.childNodes) visit(child)
  }
  for (const child of root.childNodes) visit(child)
  return normalizeDraft(nodes)
}
function length(node: Node): number {
  if (node instanceof Element && node.hasAttribute('data-command-id')) return 1
  if (node.nodeType === Node.TEXT_NODE) return node.textContent?.length || 0
  if (node instanceof Element && node.tagName === 'BR') return 1
  return Array.from(node.childNodes).reduce((sum, child) => sum + length(child), 0)
}
export function editorSelection(root: HTMLElement): EditorSelection | null {
  const selection = window.getSelection()
  if (!selection?.rangeCount) return null
  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null
  const offset = (container: Node, position: number) => {
    const prefix = document.createRange()
    prefix.selectNodeContents(root)
    prefix.setEnd(container, position)
    return length(prefix.cloneContents())
  }
  return {
    start: offset(range.startContainer, range.startOffset),
    end: offset(range.endContainer, range.endOffset),
  }
}
export function selectEditor(root: HTMLElement, selection: EditorSelection) {
  function point(offset: number): [Node, number] {
    let remaining = offset
    for (let i = 0; i < root.childNodes.length; i++) {
      const node = root.childNodes[i]!
      const size = length(node)
      if (node.nodeType === Node.TEXT_NODE && remaining <= size) return [node, remaining]
      if (remaining === 0) return [root, i]
      if (remaining < size) return [root, i + 1]
      remaining -= size
    }
    return [root, root.childNodes.length]
  }
  const range = document.createRange()
  range.setStart(...point(selection.start))
  range.setEnd(...point(selection.end))
  const current = window.getSelection()
  current?.removeAllRanges()
  current?.addRange(range)
}
export function renderEditor(
  root: HTMLElement,
  nodes: DraftNode[],
  label: (tag: CommandTag) => string,
  unavailable: (tag: CommandTag) => boolean,
) {
  const fragment = document.createDocumentFragment()
  for (const node of nodes) {
    if (node.type === 'text') {
      fragment.append(document.createTextNode(node.text))
      continue
    }
    const tag = document.createElement('span')
    tag.contentEditable = 'false'
    tag.className = `command-tag${unavailable(node) ? ' unavailable' : ''}`
    tag.dataset.commandId = node.id
    tag.title = `${label(node)}${node.origin ? ` · ${node.origin}` : ''}${node.arguments ? ` · ${node.arguments}` : ''}`
    const name = document.createElement('span')
    name.className = 'command-tag-name'
    name.textContent = `/${node.name}${node.arguments ? ` ${node.arguments}` : ''}`
    const source = document.createElement('span')
    source.className = 'command-tag-source'
    source.textContent = label(node)
    tag.append(name, source)
    fragment.append(tag)
  }
  // A trailing text node gives WebKit a caret position after the final atom.
  if (nodes.at(-1)?.type === 'command') fragment.append(document.createTextNode(''))
  root.replaceChildren(fragment)
}
