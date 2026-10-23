import { useEffect, useRef, useState } from 'react'
import { getDay, getDays, getMeta, getSummary } from './api'
import DecisionDesk from './DecisionDesk'
import Accuracy from './Accuracy'
import { dateUTC, exclusionText, monthDate } from './format'

const GATES = [
  { id: 'epex', label: 'EPEX', cutoff: '09:20Z' },
  { id: 'n2ex', label: 'N2EX', cutoff: '09:50Z' },
]

const RUNS = ['02:30', '04:30', '07:30', '09:20', '09:30', '09:50', '11:30', '15:30', '18:30', '22:30']
const GATE_RUN = { epex: '07:30', n2ex: '09:30' }
const GATE_TIME = { epex: '09:20', n2ex: '09:50' }

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
  const timelineRef = useRef(null)

  useEffect(() => {
    const box = timelineRef.current
    const active = box?.querySelector('.is-selected')
    if (box && active) box.scrollLeft = active.offsetLeft - box.clientWidth / 2
  }, [gate])

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
      ? `${monthDate(window.delivery_from)} to ${monthDate(window.delivery_to)}`
      : '2 Jan 2026 to 1 Feb 2026'

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

      <header className="masthead">
        <div className="masthead__inner">
          <div>
            <h1 className="masthead__title">Gale Desk</h1>
            <p className="masthead__sub">Day-ahead wind forecast bulletin</p>
          </div>
          <div className="masthead__meta">
            <span>January 2026</span>
            <span>GB national wind</span>
            <span>Elexon FUELHH / WINDFOR</span>
          </div>
        </div>
      </header>

      <section className="timeline" aria-label="Forecast publication runs and auction gates">
        <div className="timeline__inner">
          <div className="timeline__label">Runs published (UTC)</div>
          <div className="timeline__scroll" ref={timelineRef}>
            <ol className="timeline__track">
              {RUNS.map((run) => {
                const isUsed = run === GATE_RUN[gate]
                const isGate = run === '09:20' || run === '09:50'
                const isSelected = run === GATE_TIME[gate]
                return (
                  <li
                    key={run}
                    className={`timeline__tick${isUsed ? ' is-used' : ''}${
                      isSelected ? ' is-selected' : ''
                    }`}
                  >
                    <span className="timeline__time">{run}</span>
                    {isUsed && (
                      <span className="timeline__note timeline__note--used">Run used</span>
                    )}
                    {isGate && (
                      <span className="timeline__note timeline__note--gate">
                        {run === '09:20' ? 'EPEX gate' : 'N2EX gate'}
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      </section>

      <div className="controlbar">
        <div className="controlbar__inner">
          <div className="controls">
            <div className="gate-toggle" role="group" aria-label="Auction gate">
              {GATES.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="gate-toggle__btn"
                  aria-pressed={gate === g.id}
                  onClick={() => {
                    setError('')
                    setGate(g.id)
                  }}
                >
                  {g.label}
                  <span className="gate-toggle__time">{g.cutoff}</span>
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
        </div>
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
          (FUELHH actuals, WINDFOR forecasts).
        </span>
        <span>Window {windowText}. Gates 09:20Z EPEX, 09:50Z N2EX.</span>
        {summary && <span>QA exclusions: {exclusions || 'none'}.</span>}
      </footer>
    </>
  )
}
