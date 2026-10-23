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

const FORECAST = '#fbbf24'
const ACTUAL = '#2dd4bf'

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
      <TipRow color="#94a3b8" label="Error" value={`${signed(p.error)} MW`} />
      {typeof p.bandLow === 'number' && (
        <TipRow
          color="#7f92ab"
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
          <h2>Decision desk</h2>
          <p>
            {day
              ? `At the ${gate.label} gate (${gate.cutoff}) the desk saw a ${agePhrase(day.ageMinutes)} forecast.`
              : 'The freshest forecast that was on the table at gate closure.'}
          </p>
        </div>
        {day?.date && <span className="chip">{dateUTC(day.date)}</span>}
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
              <span>Gate</span>
              <b>
                {gate.label} · {day.gate?.cutoff ? `${timeUTC(day.gate.cutoff)}Z` : gate.cutoff}
              </b>
            </div>
            <div className="fact">
              <span>Forecast published</span>
              <b>{stampUTC(day.publishTime)}</b>
            </div>
            <div className="fact">
              <span>Age at gate</span>
              <b>{duration(day.ageMinutes)}</b>
            </div>
            <div className="fact">
              <span>Settlement periods</span>
              <b>{periods.length} × 30 min</b>
            </div>
          </div>

          <section className="card">
            <header className="card__head">
              <h3>Forecast vs actual</h3>
              <p>In-sample P90 error band from January's gate-time misses</p>
            </header>
            <div
              className="chart chart--tall"
              role="img"
              aria-label="Forecast and actual wind by settlement period, with P90 error band"
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#1e2c40" strokeDasharray="3 4" vertical={false} />
                  <XAxis
                    dataKey="label"
                    interval={5}
                    tick={{ fill: '#8fa3bc', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#24344b' }}
                  />
                  <YAxis
                    tick={{ fill: '#8fa3bc', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                    tickFormatter={(v) => mw(v)}
                    label={{
                      value: 'MW',
                      angle: -90,
                      position: 'insideLeft',
                      fill: '#7f93ad',
                      fontSize: 11,
                    }}
                  />
                  <Tooltip content={<DeskTip />} cursor={{ stroke: '#3c5573' }} />
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
                      fill={ACTUAL}
                      fillOpacity={0.14}
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
                  <Legend wrapperStyle={{ fontSize: 12, color: '#c6d3e4' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card">
            <header className="card__head">
              <h3>Settlement-period detail</h3>
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
