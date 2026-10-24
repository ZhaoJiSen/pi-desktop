export interface GraphCommit {
  hash: string
  parents: string[]
}

export interface GraphLink {
  from: number
  to: number
}

export interface GraphRow {
  lane: number
  columns: number
  input: Array<string | null>
  output: Array<string | null>
  links: GraphLink[]
}

// Assign lanes from a newest-first history so a branch/merge graph can be drawn.
export function layoutGraph(commits: GraphCommit[]): GraphRow[] {
  const lanes: Array<string | null> = []
  const rows: GraphRow[] = []
  for (const commit of commits) {
    let lane = lanes.indexOf(commit.hash)
    if (lane === -1) {
      lane = lanes.indexOf(null)
      if (lane === -1) {
        lane = lanes.length
        lanes.push(null)
      }
    }
    const input = lanes.slice()
    const links: GraphLink[] = []
    for (let index = 0; index < lanes.length; index += 1) {
      if (index !== lane && lanes[index] === commit.hash) {
        links.push({ from: index, to: lane })
        lanes[index] = null
      }
    }
    const first = commit.parents[0] ?? null
    if (!first) lanes[lane] = null
    else {
      const existing = lanes.findIndex((item, index) => item === first && index !== lane)
      if (existing === -1) lanes[lane] = first
      else {
        links.push({ from: lane, to: existing })
        lanes[lane] = null
      }
    }
    for (const parent of commit.parents.slice(1)) {
      let target = lanes.indexOf(parent)
      if (target === -1) {
        target = lanes.indexOf(null)
        if (target === -1) {
          target = lanes.length
          lanes.push(parent)
        } else lanes[target] = parent
      }
      if (target !== lane) links.push({ from: lane, to: target })
    }
    while (lanes.length > 0 && lanes[lanes.length - 1] === null) lanes.pop()
    rows.push({
      lane,
      columns: Math.max(input.length, lanes.length, lane + 1),
      input,
      output: lanes.slice(),
      links,
    })
  }
  return rows
}

export function connectVisible<T extends GraphCommit>(commits: T[], visible: Set<string>): T[] {
  const byHash = new Map(commits.map((commit) => [commit.hash, commit]))
  function ancestors(hash: string): string[] {
    const commit = byHash.get(hash)
    if (!commit) return []
    const found: string[] = []
    const seen = new Set([hash])
    const pending = [...commit.parents].reverse()
    // A sparse filter may hide tens of thousands of ancestors. Use an explicit
    // stack so history depth cannot exhaust the JavaScript call stack.
    while (pending.length) {
      const parent = pending.pop()!
      if (seen.has(parent)) continue
      seen.add(parent)
      if (visible.has(parent)) found.push(parent)
      else {
        const hidden = byHash.get(parent)
        if (hidden)
          for (let index = hidden.parents.length - 1; index >= 0; index--)
            pending.push(hidden.parents[index]!)
      }
    }
    return found
  }
  return commits
    .filter((commit) => visible.has(commit.hash))
    .map((commit) => ({
      ...commit,
      parents: [...new Set(ancestors(commit.hash))],
    }))
}
