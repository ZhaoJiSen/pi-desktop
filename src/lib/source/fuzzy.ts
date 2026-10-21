export function fuzzyScore(query: string, text: string): number | null {
  const needle = query.trim().toLowerCase()
  if (!needle) return 1
  const haystack = text.toLowerCase()
  let queryIndex = 0
  let score = 0
  let streak = 0
  let previous = -2
  for (let index = 0; index < haystack.length && queryIndex < needle.length; index += 1) {
    if (haystack[index] !== needle[queryIndex]) continue
    let gain = 2
    if (index === previous + 1) {
      streak += 1
      gain += streak * 4
    } else streak = 0
    const boundary = index === 0 || /[./_\-\s]/.test(haystack[index - 1] ?? '')
    if (boundary) gain += 6
    score += gain
    previous = index
    queryIndex += 1
  }
  if (queryIndex < needle.length) return null
  return score - text.length * 0.02
}

export function fuzzyFilter(query: string, paths: string[], limit = 40): string[] {
  const ranked: { path: string; score: number }[] = []
  for (const path of paths) {
    const name = path.split('/').at(-1) ?? path
    const pathScore = fuzzyScore(query, path)
    const nameScore = fuzzyScore(query, name)
    const score =
      nameScore == null
        ? pathScore
        : pathScore == null
          ? nameScore + 12
          : Math.max(pathScore, nameScore + 12)
    if (score == null) continue
    ranked.push({ path, score })
  }
  ranked.sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
  return ranked.slice(0, limit).map((item) => item.path)
}
