import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  ReferenceLine,
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
import Icon from './icons'

const MINT = '#34d399'
const ROSE = '#fb7185'
const MUTED = '#a8b3cf'
const GRID = 'rgba(255,255,255,0.07)'

const axis = {
  tick: { fill: MUTED, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: 'rgba(255,255,255,0.11)' },
}

function BarGradient({ id, from, to }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={from} />
        <stop offset="100%" stopColor={to} />
      </linearGradient>
    </defs>
  )
}

function biasScale(values) {
  const max = Math.max(1000, Math.ceil(Math.max(0, ...values) / 1000) * 1000)
  const min = Math.min(-1000, Math.floor(Math.min(0, ...values) / 1000) * 1000)
  const mid = Math.round(max / 2 / 500) * 500
  return {
    domain: [min, max],
    ticks: [...new Set([min, 0, mid, max])].sort((a, b) => a - b),
  }
}

function ChartCard({ title, note, label, className, icon, children }) {
  return (
    <section className="card">
      <header className="card__head">
        <div className="card__title">
          {icon && (
            <span className="title-icon">
              <Icon name={icon} />
            </span>
          )}
          <h3>{title}</h3>
        </div>
        {note && <p>{note}</p>}
      </header>
      <div className={`chart ${className || ''}`} role="img" aria-label={label}>
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
  const dailyBias = biasScale(daily.map((d) => d.bias))
  const hourlyBias = biasScale(byHour.map((h) => h.bias))

  return (
    <>
      <header className="section-head">
        <div>
          <p className="eyebrow">
            <span className="title-icon title-icon--sm">
              <Icon name="activity" />
            </span>
            Forecast accuracy
          </p>
          <h2 className="gradient-text">How wrong was January?</h2>
          <p className="section-head__sub">
            Every settlement period the desk could have bought — scored against metered wind at
            the {gate.label} gate.
          </p>
        </div>
        <div className="section-head__chips">
          <span className="chip">
            {gate.label} · {gate.cutoff}
          </span>
        </div>
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
              icon="bar-chart"
              note="MAE on top; signed bias below — mint ran high, rose ran low"
              label="Two stacked panels: daily mean absolute error bars and signed bias bars"
              className="daily-split"
            >
              {hasDaily ? (
                <>
                  <div className="daily-split__panel">
                    <span className="daily-split__label">MAE · MW</span>
                    <div className="daily-split__plot">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={daily}
                          syncId="daily"
                          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                        >
                          <BarGradient id="maeDailyGrad" from="#8b5cf6" to="#60a5fa" />
                          <CartesianGrid
                            stroke={GRID}
                            strokeDasharray="3 4"
                            vertical={false}
                          />
                          <XAxis dataKey="label" hide />
                          <YAxis
                            {...axis}
                            axisLine={false}
                            width={52}
                            tickFormatter={(v) => mw(v)}
                          />
                          <Tooltip
                            cursor={false}
                            contentStyle={chartTipStyle}
                            labelStyle={chartTipLabel}
                            itemStyle={chartTipItem}
                            formatter={(value) => `${mw(value, 1)} MW`}
                            labelFormatter={(label, payload) =>
                              payload?.[0]?.payload?.date
                                ? dateUTC(payload[0].payload.date)
                                : label
                            }
                          />
                          <Bar
                            dataKey="mae"
                            name="MAE"
                            fill="url(#maeDailyGrad)"
                            radius={[3, 3, 0, 0]}
                            maxBarSize={14}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="daily-split__panel">
                    <span className="daily-split__label">Bias · MW · positive = ran high</span>
                    <div className="daily-split__plot">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={daily}
                          syncId="daily"
                          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid
                            stroke={GRID}
                            strokeDasharray="3 4"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="label"
                            {...axis}
                            interval="preserveStartEnd"
                            minTickGap={18}
                          />
                          <YAxis
                            {...axis}
                            axisLine={false}
                            width={52}
                            tickFormatter={(v) => mw(v)}
                            domain={dailyBias.domain}
                            ticks={dailyBias.ticks}
                            interval={0}
                          />
                          <Tooltip
                            cursor={false}
                            contentStyle={chartTipStyle}
                            labelStyle={chartTipLabel}
                            itemStyle={chartTipItem}
                            formatter={(value) => `${mw(value, 1)} MW`}
                            labelFormatter={(label, payload) =>
                              payload?.[0]?.payload?.date
                                ? dateUTC(payload[0].payload.date)
                                : label
                            }
                          />
                          <ReferenceLine
                            y={0}
                            stroke="rgba(196,181,253,0.42)"
                            strokeDasharray="3 3"
                          />
                          <Bar dataKey="bias" name="Bias" maxBarSize={14}>
                            {daily.map((d) => (
                              <Cell key={d.date} fill={d.bias >= 0 ? MINT : ROSE} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              ) : (
                <p className="empty">No daily breakdown.</p>
              )}
            </ChartCard>

            <ChartCard
              title="Error distribution"
              icon="histogram"
              note="Count of settlement periods per absolute-error bin"
              label="Distribution of absolute forecast error"
              className="chart--match"
            >
              {histogram.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={histogram} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <BarGradient id="histogramGrad" from="#60a5fa" to="#22d3ee" />
                    <CartesianGrid stroke={GRID} strokeDasharray="3 4" vertical={false} />
                    <XAxis dataKey="bin" {...axis} interval="preserveStartEnd" minTickGap={12} />
                    <YAxis {...axis} axisLine={false} width={40} allowDecimals={false} />
                    <Tooltip
                      cursor={false}
                      contentStyle={chartTipStyle}
                      labelStyle={chartTipLabel}
                      itemStyle={chartTipItem}
                      formatter={(value) => [count(value), 'Settlement periods']}
                      labelFormatter={(label) => `|error| ${label} MW`}
                    />
                    <Bar
                      dataKey="count"
                      name="Periods"
                      fill="url(#histogramGrad)"
                      radius={[3, 3, 0, 0]}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <p className="empty">No error distribution.</p>
              )}
            </ChartCard>

            <ChartCard
              title="By hour of day"
              icon="clock"
              note="MAE on top; signed bias below — UTC hour"
              label="Two stacked panels: mean absolute error and signed bias by hour of day"
              className="daily-split"
            >
              {byHour.length ? (
                <>
                  <div className="daily-split__panel">
                    <span className="daily-split__label">MAE · MW</span>
                    <div className="daily-split__plot">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={byHour}
                          syncId="hourly"
                          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                        >
                          <BarGradient id="maeHourlyGrad" from="#8b5cf6" to="#60a5fa" />
                          <CartesianGrid
                            stroke={GRID}
                            strokeDasharray="3 4"
                            vertical={false}
                          />
                          <XAxis dataKey="label" hide />
                          <YAxis
                            {...axis}
                            axisLine={false}
                            width={52}
                            tickFormatter={(v) => mw(v)}
                          />
                          <Tooltip
                            cursor={false}
                            contentStyle={chartTipStyle}
                            labelStyle={chartTipLabel}
                            itemStyle={chartTipItem}
                            formatter={(value) => `${mw(value, 1)} MW`}
                            labelFormatter={(label) => `${label} UTC`}
                          />
                          <Bar
                            dataKey="mae"
                            name="MAE"
                            fill="url(#maeHourlyGrad)"
                            radius={[3, 3, 0, 0]}
                            maxBarSize={14}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="daily-split__panel">
                    <span className="daily-split__label">Bias · MW · positive = ran high</span>
                    <div className="daily-split__plot">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={byHour}
                          syncId="hourly"
                          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid
                            stroke={GRID}
                            strokeDasharray="3 4"
                            vertical={false}
                          />
                          <XAxis dataKey="label" {...axis} interval={2} />
                          <YAxis
                            {...axis}
                            axisLine={false}
                            width={52}
                            tickFormatter={(v) => mw(v)}
                            domain={hourlyBias.domain}
                            ticks={hourlyBias.ticks}
                            interval={0}
                          />
                          <Tooltip
                            cursor={false}
                            contentStyle={chartTipStyle}
                            labelStyle={chartTipLabel}
                            itemStyle={chartTipItem}
                            formatter={(value) => `${mw(value, 1)} MW`}
                            labelFormatter={(label) => `${label} UTC`}
                          />
                          <ReferenceLine
                            y={0}
                            stroke="rgba(196,181,253,0.42)"
                            strokeDasharray="3 3"
                          />
                          <Bar dataKey="bias" name="Bias" maxBarSize={14}>
                            {byHour.map((h) => (
                              <Cell key={h.hour} fill={h.bias >= 0 ? MINT : ROSE} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              ) : (
                <p className="empty">No hourly breakdown.</p>
              )}
            </ChartCard>

            <ChartCard
              title="By forecast lead time"
              icon="hourglass"
              note="Forecast horizon — hours from publication to delivery"
              label="Mean absolute error by forecast lead time"
              className="chart--match"
            >
              {byLead.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={byLead} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <BarGradient id="leadGrad" from="#a78bfa" to="#60a5fa" />
                    <CartesianGrid stroke={GRID} strokeDasharray="3 4" vertical={false} />
                    <XAxis dataKey="bucket" {...axis} minTickGap={8} />
                    <YAxis {...axis} axisLine={false} width={52} tickFormatter={(v) => mw(v)} />
                    <Tooltip
                      cursor={false}
                      contentStyle={chartTipStyle}
                      labelStyle={chartTipLabel}
                      itemStyle={chartTipItem}
                      formatter={(value) => `${mw(value, 1)} MW`}
                      labelFormatter={(label) => `Lead time ${label}`}
                    />
                    <Bar dataKey="mae" name="MAE" fill="url(#leadGrad)" radius={[3, 3, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <p className="empty">No lead-time breakdown.</p>
              )}
            </ChartCard>
          </div>

          <section className="card">
            <header className="card__head">
              <div className="card__title">
                <span className="title-icon">
                  <Icon name="alert" />
                </span>
                <h3>Worst delivery days</h3>
              </div>
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
              <span className="card__title">
                <span className="title-icon">
                  <Icon name="book" />
                </span>
                <span>Methodology &amp; caveats</span>
              </span>
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
                  Zero or missing actuals are excluded and counted; the footer shows the count for
                  this window.
                </p>
              </div>
              <div>
                <h4>Metrics</h4>
                <p>
                  error = forecast − actual. WAPE = Σ|error| / Σactual. MAPE is deliberately
                  skipped: it is undefined at zero and unstable at low wind. Unit of analysis is
                  the settlement period — the unit the desk buys; WINDFOR is hourly and
                  step-held.
                </p>
              </div>
              <div>
                <h4>Caveats</h4>
                <p>
                  Hour-of-day and lead time are collinear in this window — do not read the two
                  charts as independent effects. Actuals are transmission-metered wind only. The
                  P90 band is in-sample: it describes January's observed misses, not a guarantee.
                  WINDFOR is NGESO's national wind forecast; FUELHH is transmission-metered. Part
                  of the +1.73 GW mean bias may be a scope difference, not forecast skill.
                </p>
              </div>
            </div>
          </details>
        </>
      )}
    </>
  )
}
