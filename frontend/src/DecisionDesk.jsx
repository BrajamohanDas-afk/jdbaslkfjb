import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { agePhrase, chartTipStyle, dateUTC, duration, mw, signed, stampUTC, timeUTC } from './format'
import Icon from './icons'

const FORECAST = '#c4b5fd'
const ACTUAL = '#34d399'
const MUTED = '#a8b3cf'
const GRID = 'rgba(255,255,255,0.07)'

function TipRow({ color, label, value }) {
  return (
    <div className="tip__row">
      <span>
        <i style={{ background: color }} />
        {label}
      </span>
      <b>{value}</b>
    </div>
  )
}

function DeskTip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0]?.payload
  if (!p) return null
  return (
    <div className="tip">
      <div className="tip__label">
        SP {p.settlementPeriod} · {timeUTC(p.startTime)}Z
      </div>
      <TipRow color={FORECAST} label="Forecast" value={`${mw(p.forecast)} MW`} />
      <TipRow color={ACTUAL} label="Actual" value={`${mw(p.actual)} MW`} />
      <TipRow color="#a8b3cf" label="Error" value={`${signed(p.error)} MW`} />
      {typeof p.bandLow === 'number' && (
        <TipRow
          color="#8b5cf6"
          label="P90 band"
          value={`${mw(p.bandLow)} – ${mw(p.bandHigh)} MW`}
        />
      )}
    </div>
  )
}

export default function DecisionDesk({ day, gate, loading }) {
  const periods = day?.periods || []
  const hasBand = periods.some(
    (p) => typeof p.bandLow === 'number' && typeof p.bandHigh === 'number',
  )
  const rows = periods.map((p) => ({
    ...p,
    label: timeUTC(p.startTime),
    bandSpan:
      typeof p.bandLow === 'number' && typeof p.bandHigh === 'number'
        ? p.bandHigh - p.bandLow
        : null,
  }))

  return (
    <>
      <header className="section-head">
        <div>
          <p className="eyebrow">
            <span className="title-icon title-icon--sm">
              <Icon name="compass" />
            </span>
            Decision desk
          </p>
          <h2 className="gradient-text">The forecast you actually had.</h2>
          <p className="section-head__sub">
            {day
              ? `At the ${gate.label} gate — ${gate.cutoff} — the desk saw a ${agePhrase(day.ageMinutes)} forecast, not today's.`
              : 'The freshest forecast that was on the table at gate closure.'}
          </p>
        </div>
        <div className="section-head__chips">
          {day?.date && <span className="chip">{dateUTC(day.date)}</span>}
          {day && (
            <span className="chip chip--live">
              <span className="live-dot" aria-hidden="true" />
              {duration(day.ageMinutes)} old at gate
            </span>
          )}
        </div>
      </header>

      {loading && !day ? (
        <div className="card skeleton" aria-live="polite">
          Loading delivery day…
        </div>
      ) : !day ? (
        <div className="card empty">No delivery day loaded. Check that the API is running.</div>
      ) : (
        <>
          <div className="facts">
            <div className="fact">
              <span className="fact__label">
                <span className="title-icon title-icon--sm">
                  <Icon name="bolt" />
                </span>
                Gate
              </span>
              <b>
                {gate.label} · {day.gate?.cutoff ? `${timeUTC(day.gate.cutoff)}Z` : gate.cutoff}
              </b>
            </div>
            <div className="fact">
              <span className="fact__label">
                <span className="title-icon title-icon--sm">
                  <Icon name="clock" />
                </span>
                Forecast published
              </span>
              <b>{stampUTC(day.publishTime)}</b>
            </div>
            <div className="fact">
              <span className="fact__label">
                <span className="title-icon title-icon--sm">
                  <Icon name="timer" />
                </span>
                Age at gate
              </span>
              <b>{duration(day.ageMinutes)}</b>
            </div>
            <div className="fact">
              <span className="fact__label">
                <span className="title-icon title-icon--sm">
                  <Icon name="grid" />
                </span>
                Settlement periods
              </span>
              <b>{periods.length} × 30 min</b>
            </div>
          </div>

          <section className="card">
            <header className="card__head">
              <div className="card__title">
                <span className="title-icon">
                  <Icon name="bolt" />
                </span>
                <h3>Forecast vs actual</h3>
              </div>
              <p>In-sample P90 error band from January's gate-time misses</p>
            </header>
            <div
              className="chart chart--tall"
              role="img"
              aria-label="Forecast and actual wind by settlement period, with P90 error band"
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="p90BandGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.32} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID} strokeDasharray="3 4" vertical={false} />
                  <XAxis
                    dataKey="label"
                    interval={5}
                    tick={{ fill: MUTED, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(255,255,255,0.11)' }}
                  />
                  <YAxis
                    tick={{ fill: MUTED, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                    tickFormatter={(v) => mw(v)}
                    label={{
                      value: 'MW',
                      angle: -90,
                      position: 'insideLeft',
                      fill: '#7c89a8',
                      fontSize: 11,
                    }}
                  />
                  <Tooltip content={<DeskTip />} cursor={{ stroke: 'rgba(196,181,253,0.38)' }} />
                  {hasBand && (
                    <Area
                      type="monotone"
                      dataKey="bandLow"
                      stackId="band"
                      stroke="none"
                      fill="transparent"
                      fillOpacity={0}
                      isAnimationActive={false}
                      legendType="none"
                      activeDot={false}
                    />
                  )}
                  {hasBand && (
                    <Area
                      type="monotone"
                      dataKey="bandSpan"
                      stackId="band"
                      name="P90 band"
                      stroke="none"
                      fill="url(#p90BandGrad)"
                      fillOpacity={1}
                      isAnimationActive={false}
                      legendType="none"
                      activeDot={false}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    name="Forecast"
                    stroke={FORECAST}
                    strokeWidth={2.2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name="Actual"
                    stroke={ACTUAL}
                    strokeWidth={2.2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: MUTED }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card">
            <header className="card__head">
              <div className="card__title">
                <span className="title-icon">
                  <Icon name="grid" />
                </span>
                <h3>Settlement-period detail</h3>
              </div>
              <p>Forecast minus actual; positive means the forecast ran high</p>
            </header>
            <div className="table-wrap">
              <table>
                <caption className="sr-only">Forecast, actual and error by settlement period</caption>
                <thead>
                  <tr>
                    <th scope="col">SP</th>
                    <th scope="col">Time (UTC)</th>
                    <th scope="col" className="num">
                      Forecast
                    </th>
                    <th scope="col" className="num">
                      Actual
                    </th>
                    <th scope="col" className="num">
                      Error
                    </th>
                    <th scope="col" className="num">
                      P90 band
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => (
                    <tr key={p.settlementPeriod}>
                      <td className="dim">{p.settlementPeriod}</td>
                      <td>{timeUTC(p.startTime)}</td>
                      <td className="num">{mw(p.forecast)}</td>
                      <td className="num">{mw(p.actual)}</td>
                      <td className={`num ${p.error > 0 ? 'over' : p.error < 0 ? 'under' : ''}`}>
                        {signed(p.error)}
                      </td>
                      <td className="num dim">
                        {mw(p.bandLow)} – {mw(p.bandHigh)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  )
}
