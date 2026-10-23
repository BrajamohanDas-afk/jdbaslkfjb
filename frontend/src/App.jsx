import { useEffect, useState } from 'react'
import { getDay, getDays, getMeta, getSummary } from './api'
import DecisionDesk from './DecisionDesk'
import Accuracy from './Accuracy'
import { dateUTC, exclusionText, monthDate } from './format'

const GATES = [
  { id: 'epex', label: 'EPEX', cutoff: '09:20Z' },
  { id: 'n2ex', label: 'N2EX', cutoff: '09:50Z' },
]

export default function App() {
  const [meta, setMeta] = useState(null)
  const [days, setDays] = useState([])
  const [date, setDate] = useState('')
  const [gate, setGate] = useState('n2ex')
  const [tab, setTab] = useState('desk')
  const [day, setDay] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loadingDay, setLoadingDay] = useState(true)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let dead = false
    Promise.all([getMeta().catch(() => null), getDays()])
      .then(([metaData, dayData]) => {
        if (dead) return
        setMeta(metaData)
        const list = Array.isArray(dayData?.days) ? dayData.days : []
        setDays(list)
        setDate((current) => current || list.at(-1) || '')
      })
      .catch((err) => !dead && setError(err.message))
    return () => {
      dead = true
    }
  }, [reload])

  useEffect(() => {
    if (!date) {
      setLoadingDay(false)
      return
    }
    let dead = false
    setLoadingDay(true)
    getDay(date, gate)
      .then((data) => {
        if (dead) return
        setDay(data)
      })
      .catch((err) => !dead && setError(err.message))
      .finally(() => !dead && setLoadingDay(false))
    return () => {
      dead = true
    }
  }, [date, gate, reload])

  useEffect(() => {
    let dead = false
    setLoadingSummary(true)
    getSummary(gate)
      .then((data) => {
        if (dead) return
        setSummary(data)
      })
      .catch((err) => !dead && setError(err.message))
      .finally(() => !dead && setLoadingSummary(false))
    return () => {
      dead = true
    }
  }, [gate, reload])

  const activeGate = GATES.find((g) => g.id === gate) || GATES[1]
  const exclusions = exclusionText(
    meta?.exclusions ??
      meta?.counts?.exclusions ??
      meta?.checks?.exclusions ??
      summary?.methodology?.exclusions,
  )
  const window = meta?.window
  const windowText =
    window?.delivery_from && window?.delivery_to
      ? `${monthDate(window.delivery_from)} → ${monthDate(window.delivery_to)}`
      : '2 Jan → 1 Feb 2026'

  const pickDay = (nextDate) => {
    setError('')
    setDate(nextDate)
    setTab('desk')
  }

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>

      <header className="topbar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="28" height="28">
              <path
                d="M4 11h15a4 4 0 1 0-4-4M4 17h21a4 4 0 1 1-4 4M4 23h10"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <div>
            <div className="brand__name">Gale Desk</div>
            <div className="brand__sub">NGESO wind · Jan 2026 replay</div>
          </div>
        </div>

        <div className="controls">
          <div className="seg" role="group" aria-label="Auction gate">
            {GATES.map((g) => (
              <button
                key={g.id}
                type="button"
                className="seg__btn"
                aria-pressed={gate === g.id}
                onClick={() => {
                  setError('')
                  setGate(g.id)
                }}
              >
                {g.label}
                <span>{g.cutoff}</span>
              </button>
            ))}
          </div>

          <label className="date-pick">
            <span>Delivery day</span>
            <select
              value={date}
              onChange={(e) => {
                setError('')
                setDate(e.target.value)
              }}
              disabled={!days.length}
            >
              {days.length ? (
                days.map((d) => (
                  <option key={d} value={d}>
                    {dateUTC(d)}
                  </option>
                ))
              ) : (
                <option value="">No days loaded</option>
              )}
            </select>
          </label>
        </div>
      </header>

      <div className="tabbar">
        <nav className="tabs" role="tablist" aria-label="Views">
          <button
            type="button"
            role="tab"
            id="tab-desk"
            aria-selected={tab === 'desk'}
            aria-controls="panel-desk"
            className="tabs__btn"
            onClick={() => setTab('desk')}
          >
            Decision desk
          </button>
          <button
            type="button"
            role="tab"
            id="tab-accuracy"
            aria-selected={tab === 'accuracy'}
            aria-controls="panel-accuracy"
            className="tabs__btn"
            onClick={() => setTab('accuracy')}
          >
            Forecast accuracy
          </button>
        </nav>
        <p className="tabbar__note">We present NGESO's forecast and measure it. We do not generate one.</p>
      </div>

      {error && (
        <div className="banner" role="alert">
          <span>
            <strong>API not reachable.</strong> {error}
          </span>
          <button
            type="button"
            onClick={() => {
              setError('')
              setReload((n) => n + 1)
            }}
          >
            Retry
          </button>
        </div>
      )}

      <main id="main">
        {tab === 'desk' ? (
          <section id="panel-desk" role="tabpanel" aria-labelledby="tab-desk">
            <DecisionDesk day={day} gate={activeGate} loading={loadingDay} />
          </section>
        ) : (
          <section id="panel-accuracy" role="tabpanel" aria-labelledby="tab-accuracy">
            <Accuracy
              summary={summary}
              gate={activeGate}
              loading={loadingSummary}
              onPickDay={pickDay}
            />
          </section>
        )}
      </main>

      <footer className="footer">
        <span>
          Source:{' '}
          <a href="https://bmrs.elexon.co.uk/" target="_blank" rel="noreferrer">
            Elexon BMRS
          </a>{' '}
          FUELHH actuals + WINDFOR forecasts
        </span>
        <span>
          Window {windowText} · gates 09:20Z EPEX / 09:50Z N2EX
        </span>
        {summary && <span>QA exclusions — {exclusions || 'none'}</span>}
      </footer>
    </>
  )
}
