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

const FORECAST = '#D9552A'
const ACTUAL = '#0F6B63'
const BLUE = '#2B5F8A'
const MUTED = '#6B7F8B'
const GRID = '#D5DEE3'
const MONO = "'IBM Plex Mono', monospace"

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
      <TipRow color={MUTED} label="Error" value={`${signed(p.error)} MW`} />
      {typeof p.bandLow === 'number' && (
        <TipRow
          color={BLUE}
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
          <p className="eyebrow">Decision desk</p>
          <h2>The forecast you actually had.</h2>
          <p className="section-head__sub">
            {day
              ? `At the ${gate.label} gate (${gate.cutoff}) the desk saw a ${agePhrase(day.ageMinutes)} forecast. Not today's.`
              : 'The forecast in force at gate closure.'}
          </p>
        </div>
        {day?.date && <div className="section-head__meta">{dateUTC(day.date)}</div>}
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
              <span className="fact__label">Gate</span>
              <b>
                {gate.label} · {day.gate?.cutoff ? `${timeUTC(day.gate.cutoff)}Z` : gate.cutoff}
              </b>
            </div>
            <div className="fact">
              <span className="fact__label">Forecast published</span>
              <b>{stampUTC(day.publishTime)}</b>
            </div>
            <div className="fact">
              <span className="fact__label">Age at gate</span>
              <b>{duration(day.ageMinutes)}</b>
            </div>
            <div className="fact">
              <span className="fact__label">Settlement periods</span>
              <b>{periods.length} × 30 min</b>
            </div>
          </div>

          <section className="card">
            <header className="card__head">
              <div className="card__title">
                <h3>Forecast vs actual</h3>
              </div>
              <p>In-sample P90 error band from January's gate-time misses.</p>
            </header>
            <div
              className="chart chart--tall"
              role="img"
              aria-label="Forecast and actual wind by settlement period, with P90 error band"
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <pattern
                      id="bandHatch"
                      width="6"
                      height="6"
                      patternTransform="rotate(45)"
                      patternUnits="userSpaceOnUse"
                    >
                      <line
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="6"
                        stroke={BLUE}
                        strokeWidth="1"
                        opacity="0.45"
                      />
                    </pattern>
                  </defs>
                  <CartesianGrid stroke={GRID} strokeDasharray="1 4" vertical={false} />
                  <XAxis
                    dataKey="label"
                    interval={5}
                    tick={{ fill: MUTED, fontSize: 10, fontFamily: MONO }}
                    tickLine={false}
                    axisLine={{ stroke: '#B9C6CE' }}
                  />
                  <YAxis
                    tick={{ fill: MUTED, fontSize: 10, fontFamily: MONO }}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                    tickFormatter={(v) => mw(v)}
                    label={{
                      value: 'MW',
                      angle: -90,
                      position: 'insideLeft',
                      fill: MUTED,
                      fontSize: 10,
                      fontFamily: MONO,
                    }}
                  />
                  <Tooltip content={<DeskTip />} cursor={false} />
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
                      fill="url(#bandHatch)"
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
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name="Actual"
                    stroke={ACTUAL}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 10, fontFamily: MONO, color: '#334A58' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card">
            <header className="card__head">
              <div className="card__title">
                <h3>Settlement-period detail</h3>
              </div>
              <p>Forecast minus actual. Positive means the forecast ran high.</p>
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
                    <th scope="col" className="num col-optional">
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
                      <td className="num dim col-optional">
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
