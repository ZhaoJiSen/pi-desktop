export function findLineHits(lines: string[], query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  const hits: number[] = []
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index]?.toLowerCase().includes(needle)) hits.push(index)
  }
  return hits
}
