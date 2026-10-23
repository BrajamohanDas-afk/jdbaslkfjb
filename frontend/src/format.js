const num = (min, max) =>
  new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  })

export const mw = (value, digits = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? num(digits, digits).format(value) : '-'

export const signed = (value, digits = 0) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  const body = num(digits, digits).format(Math.abs(value))
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${body}`
}

/** wape arrives already scaled to percent (18.4), per the API. */
export const percent = (value, digits = 1) =>
  typeof value === 'number' && Number.isFinite(value)
    ? `${num(digits, digits).format(value)}%`
    : '-'

export const timeUTC = (iso) => {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
}

export const dateUTC = (iso) => {
  if (!iso) return '-'
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export const shortDate = (iso) => {
  if (!iso) return '-'
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export const monthDate = (iso) => {
  if (!iso) return '-'
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export const stampUTC = (iso) => {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return `${d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })}, ${timeUTC(iso)}Z`
}

export const duration = (minutes) => {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return '-'
  if (minutes < 60) return `${Math.round(minutes)} min`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m ? `${h} h ${m} m` : `${h} h`
}

export const agePhrase = (minutes) => {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return 'unknown-age'
  return minutes < 60 ? `${Math.round(minutes)}-minute-old` : `${duration(minutes)} old`
}

export const count = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? num(0, 0).format(value) : '-'

/** meta.exclusions is not pinned by the contract; render common shapes, ignore the rest. */
export const exclusionText = (value) => {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([, v]) => v != null && v !== 0 && v !== '')
      .map(
        ([k, v]) =>
          `${k
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replaceAll('_', ' ')
            .toLowerCase()}: ${v}`,
      )
      .join(' · ')
  }
  return ''
}

export const chartTipStyle = {
  background: '#F4F6F7',
  border: '1px solid #7E949F',
  borderRadius: 2,
  padding: '7px 9px',
  color: '#10222E',
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 11,
  boxShadow: 'none',
}

export const chartTipLabel = { color: '#6B7F8B', marginBottom: 3 }
export const chartTipItem = { color: '#10222E' }
