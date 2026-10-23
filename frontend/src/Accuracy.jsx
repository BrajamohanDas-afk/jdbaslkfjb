import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  chartTipItem,
  chartTipLabel,
  chartTipStyle,
  count,
  dateUTC,
  mw,
  percent,
  shortDate,
  signed,
} from './format'

const FORECAST = '#fbbf24'
const ACTUAL = '#2dd4bf'
const MUTED = '#8fa3bc'

const axis = {
  tick: { fill: MUTED, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: '#24344b' },
}

function ChartCard({ title, note, label, children }) {
  return (
    <section className="card">
      <header className="card__head">
        <h3>{title}</h3>
        {note && <p>{note}</p>}
      </header>
      <div className="chart" role="img" aria-label={label}>
        {children}
      </div>
    </section>
  )
}

function Kpi({ label, value, unit, note, tone }) {
  return (
    <div className="kpi">
      <span className="kpi__label">{label}</span>
      <span className={`kpi__value ${tone || ''}`}>
        {value}
        {unit && <small>{unit}</small>}
      </span>
      <span className="kpi__note">{note}</span>
    </div>
  )
}

export default function Accuracy({ summary, gate, loading, onPickDay }) {
  const kpis = summary?.kpis || {}
  const daily = (summary?.daily || []).map((d) => ({ ...d, label: shortDate(d.date) }))
  const histogram = summary?.histogram || []
  const byHour = (summary?.byHour || []).map((h) => ({
    ...h,
    label: `${String(h.hour).padStart(2, '0')}:00`,
  }))
  const byLead = summary?.byLead || []
  const worstDays = summary?.worstDays || []
  const hasDaily = daily.length > 0

  return (
    <>
      <header className="section-head">
        <div>
          <h2>Forecast accuracy</h2>
          <p>
            Every settlement period we actually saw at the {gate.label} gate, scored against
            metered wind.
          </p>
        </div>
        <span className="chip">
          {gate.label} · {gate.cutoff}
        </span>
      </header>

      {loading && !summary ? (
        <div className="card skeleton" aria-live="polite">
          Loading accuracy summary…
        </div>
      ) : !summary ? (
        <div className="card empty">No accuracy summary loaded. Check that the API is running.</div>
      ) : (
        <>
          <div className="kpis">
            <Kpi label="MAE" value={mw(kpis.mae, 1)} unit="MW" note="mean absolute error" />
            <Kpi label="RMSE" value={mw(kpis.rmse, 1)} unit="MW" note="large misses penalised" />
            <Kpi
              label="Bias"
              value={signed(kpis.bias, 1)}
              unit="MW"
              note="positive = ran high"
              tone={kpis.bias > 0 ? 'over' : kpis.bias < 0 ? 'under' : ''}
            />
            <Kpi label="P90" value={mw(kpis.p90, 1)} unit="MW" note="9 of 10 misses smaller" />
            <Kpi label="WAPE" value={percent(kpis.wape)} note="of actual" />
            <Kpi label="Sample" value={count(kpis.n)} note="settlement periods" />
          </div>

          <div className="grid">
            <ChartCard
              title="Daily error"
              note="MAE bars, bias line — click a day in the table below to inspect it"
              label="Daily mean absolute error bars with bias line"
            >
              {hasDaily ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={daily} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#1e2c40" strokeDasharray="3 4" vertical={false} />
                    <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={18} />
                    <YAxis
                      {...axis}
                      axisLine={false}
                      width={52}
                      tickFormatter={(v) => mw(v)}
                    />
                    <Tooltip
                      contentStyle={chartTipStyle}
                      labelStyle={chartTipLabel}
                      itemStyle={chartTipItem}
                      formatter={(value) => `${mw(value, 1)} MW`}
                      labelFormatter={(label, payload) =>
                        payload?.[0]?.payload?.date ? dateUTC(payload[0].payload.date) : label
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#c6d3e4' }} />
                    <Bar
                      dataKey="mae"
                      name="MAE"
                      fill={FORECAST}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={22}
                    />
                    <Line
                      type="monotone"
                      dataKey="bias"
                      name="Bias"
                      stroke={ACTUAL}
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <p className="empty">No daily breakdown.</p>
              )}
            </ChartCard>

            <ChartCard
              title="Error distribution"
              note="Count of settlement periods per absolute-error bin"
              label="Distribution of absolute forecast error"
            >
              {histogram.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={histogram} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#1e2c40" strokeDasharray="3 4" vertical={false} />
                    <XAxis dataKey="bin" {...axis} interval="preserveStartEnd" minTickGap={12} />
                    <YAxis {...axis} axisLine={false} width={40} allowDecimals={false} />
                    <Tooltip
                      contentStyle={chartTipStyle}
                      labelStyle={chartTipLabel}
                      itemStyle={chartTipItem}
                      formatter={(value) => [count(value), 'Settlement periods']}
                      labelFormatter={(label) => `|error| ${label} MW`}
                    />
                    <Bar dataKey="count" name="Periods" fill={ACTUAL} radius={[3, 3, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <p className="empty">No error distribution.</p>
              )}
            </ChartCard>

            <ChartCard
              title="By hour of day"
              note="UTC hour — MAE bars, bias line"
              label="Mean absolute error and bias by hour of day"
            >
              {byHour.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={byHour} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#1e2c40" strokeDasharray="3 4" vertical={false} />
                    <XAxis dataKey="label" {...axis} interval={3} />
                    <YAxis {...axis} axisLine={false} width={52} tickFormatter={(v) => mw(v)} />
                    <Tooltip
                      contentStyle={chartTipStyle}
                      labelStyle={chartTipLabel}
                      itemStyle={chartTipItem}
                      formatter={(value) => `${mw(value, 1)} MW`}
                      labelFormatter={(label) => `${label} UTC`}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#c6d3e4' }} />
                    <Bar dataKey="mae" name="MAE" fill={FORECAST} radius={[3, 3, 0, 0]} />
                    <Line
                      type="monotone"
                      dataKey="bias"
                      name="Bias"
                      stroke={ACTUAL}
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <p className="empty">No hourly breakdown.</p>
              )}
            </ChartCard>

            <ChartCard
              title="By forecast lead time"
              note="How old the forecast was when the gate closed"
              label="Mean absolute error by forecast lead time"
            >
              {byLead.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={byLead} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#1e2c40" strokeDasharray="3 4" vertical={false} />
                    <XAxis dataKey="bucket" {...axis} minTickGap={8} />
                    <YAxis {...axis} axisLine={false} width={52} tickFormatter={(v) => mw(v)} />
                    <Tooltip
                      contentStyle={chartTipStyle}
                      labelStyle={chartTipLabel}
                      itemStyle={chartTipItem}
                      formatter={(value) => `${mw(value, 1)} MW`}
                      labelFormatter={(label) => `Lead time ${label}`}
                    />
                    <Bar dataKey="mae" name="MAE" fill={ACTUAL} radius={[3, 3, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <p className="empty">No lead-time breakdown.</p>
              )}
            </ChartCard>
          </div>

          <section className="card">
            <header className="card__head">
              <h3>Worst delivery days</h3>
              <p>Ranked by mean absolute error — open one on the decision desk</p>
            </header>
            {worstDays.length ? (
              <div className="table-wrap table-wrap--short">
                <table>
                  <caption className="sr-only">Worst delivery days by mean absolute error</caption>
                  <thead>
                    <tr>
                      <th scope="col">Delivery day</th>
                      <th scope="col" className="num">
                        MAE
                      </th>
                      <th scope="col" className="num col-optional">
                        Max abs error
                      </th>
                      <th scope="col">
                        <span className="sr-only">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {worstDays.map((row) => (
                      <tr key={row.date}>
                        <td>{dateUTC(row.date)}</td>
                        <td className="num">{mw(row.mae, 1)}</td>
                        <td className="num col-optional">{mw(row.maxAbsError, 1)}</td>
                        <td className="num">
                          <button
                            type="button"
                            className="linkbtn"
                            onClick={() => onPickDay(row.date)}
                            aria-label={`Open the decision desk for ${dateUTC(row.date)}`}
                          >
                            Open →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty">No worst-day table.</p>
            )}
          </section>

          <details className="card method">
            <summary>
              <span>Methodology &amp; caveats</span>
              <span className="method__hint">vintage rule · QA · metrics</span>
            </summary>
            <div className="method__body">
              <div>
                <h4>Vintage rule</h4>
                <p>
                  For delivery day D and gate G, take the latest WINDFOR run published at or before
                  (D − 1) at G. Never borrow a later run. A run older than 24 hours is excluded.
                </p>
              </div>
              <div>
                <h4>Step-hold</h4>
                <p>
                  WINDFOR is hourly and FUELHH is half-hourly, so each forecast hour is held across
                  both settlement periods. The join is on (publishTime, startTime), never startTime
                  alone.
                </p>
              </div>
              <div>
                <h4>QA exclusions</h4>
                <p>
                  Half-hours where every fuel is zero are outages, not lulls. Missing actuals,
                  missing forecast hours and over-age vintages are dropped and counted.
                </p>
              </div>
              <div>
                <h4>Metrics</h4>
                <p>
                  error = forecast − actual. WAPE = Σ|error| / Σactual. MAPE is deliberately
                  skipped: it is undefined at zero and unstable at low wind. The hourly
                  sensitivity view is not shown as a separate score.
                </p>
              </div>
              <div>
                <h4>Caveats</h4>
                <p>
                  Hour-of-day and lead time are collinear in this window — do not read the two
                  charts as independent effects. Actuals are transmission-metered wind only. The
                  P90 band is in-sample: it describes January's observed misses, not a guarantee.
                </p>
              </div>
            </div>
          </details>
        </>
      )}
    </>
  )
}
