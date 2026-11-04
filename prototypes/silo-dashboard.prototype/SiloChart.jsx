import { useMemo } from 'react'

export default function SiloChart({ data, unit }) {
  const points = Array.isArray(data) ? data : []
  const geometry = useMemo(() => {
    if (points.length === 0) return { line: '', area: '', min: 0, max: 1, coordinates: [] }
    const values = points.map((point) => Number(point?.v) || 0)
    const low = Math.min(...values)
    const high = Math.max(...values)
    const span = high - low || Math.max(Math.abs(high) * 0.1, 1)
    const min = low - span * 0.12
    const max = high + span * 0.12
    const coordinates = points.map((point, index) => ({
      x: 36 + (index / Math.max(points.length - 1, 1)) * 588,
      y: 18 + ((max - (Number(point?.v) || 0)) / (max - min)) * 176,
      label: point?.t ?? '',
      value: Number(point?.v) || 0,
    }))
    const line = coordinates.map((point) => `${point.x},${point.y}`).join(' ')
    return { line, area: `36,194 ${line} 624,194`, min, max, coordinates }
  }, [points])

  const format = (value) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })

  return (
    <div className="h-64 w-full" role="img" aria-label={`${unit ?? 'Metric'} over time chart`}>
      <svg className="h-full w-full overflow-visible" viewBox="0 0 660 224" preserveAspectRatio="none">
        {[0, 1, 2, 3].map((step) => {
          const y = 18 + step * (176 / 3)
          const value = geometry.max - step * ((geometry.max - geometry.min) / 3)
          return (
            <g key={step}>
              <line x1="36" x2="624" y1={y} y2={y} stroke="#372f1f" strokeWidth="1" />
              <text x="30" y={y + 3} textAnchor="end" fill="#80796b" fontSize="9">{format(value)}</text>
            </g>
          )
        })}
        {geometry.area && <polygon points={geometry.area} fill="rgba(211,161,52,0.18)" />}
        {geometry.line && <polyline points={geometry.line} fill="none" stroke="#d3a134" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
        {geometry.coordinates.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            <circle cx={point.x} cy={point.y} r="3" fill="#d3a134">
              <title>{`${point.label}: ${format(point.value)} ${unit ?? ''}`.trim()}</title>
            </circle>
            {(index === 0 || index === geometry.coordinates.length - 1 || index === Math.floor(geometry.coordinates.length / 2)) && (
              <text x={point.x} y="214" textAnchor={index === 0 ? 'start' : index === geometry.coordinates.length - 1 ? 'end' : 'middle'} fill="#80796b" fontSize="9">{point.label}</text>
            )}
          </g>
        ))}
        {points.length === 0 && <text x="330" y="110" textAnchor="middle" fill="#80796b" fontSize="12">No data</text>}
      </svg>
    </div>
  )
}
