const read = async (url) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`)
  return res.json()
}

export const getMeta = () => read('/api/meta')
export const getDays = () => read('/api/days')
export const getDay = (date, gate) =>
  read(`/api/day/${encodeURIComponent(date)}?gate=${encodeURIComponent(gate)}`)
export const getSummary = (gate) => read(`/api/summary?gate=${encodeURIComponent(gate)}`)
