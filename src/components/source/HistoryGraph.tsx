import type { GraphRow } from '../../lib/source/graph'

const colors = ['var(--muted)', 'var(--accent)', 'var(--mint)']

function laneX(lane: number) {
  return 8 + lane * 14
}

export function HistoryGraph({ row, height = 28 }: { row: GraphRow; height?: number }) {
  const mid = height / 2
  const width = Math.max(row.columns, 1) * 14 + 4
  const continuing = row.input.map((hash, index) => Boolean(hash) && row.output[index] === hash)
  return (
    <svg
      className="history-graph"
      width={width}
      height={height}
      style={{ width, height }}
      aria-hidden="true"
    >
      {row.input.map((hash, index) =>
        hash ? (
          <line
            key={`in-${index}`}
            x1={laneX(index)}
            y1={0}
            x2={laneX(index)}
            y2={continuing[index] ? height : mid}
            stroke={colors[index % colors.length]}
          />
        ) : null,
      )}
      {row.output.map((hash, index) =>
        hash && !continuing[index] ? (
          <line
            key={`out-${index}`}
            x1={laneX(index)}
            y1={mid}
            x2={laneX(index)}
            y2={height}
            stroke={colors[index % colors.length]}
          />
        ) : null,
      )}
      {row.links.map((link, index) => (
        <path
          key={`link-${index}`}
          d={`M ${laneX(link.from)} ${mid} C ${laneX(link.from)} ${height}, ${laneX(link.to)} ${mid}, ${laneX(link.to)} ${height}`}
          stroke={colors[link.to % colors.length]}
        />
      ))}
      <circle cx={laneX(row.lane)} cy={mid} r={3.5} fill={colors[row.lane % colors.length]} />
    </svg>
  )
}
