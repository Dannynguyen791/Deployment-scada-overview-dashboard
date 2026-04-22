import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Database,
  Droplets,
  Factory,
  Gauge,
  History,
  Settings2,
  Signal,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from './lib/utils';
import {
  EOH_POLL_INTERVAL_MS,
  describeEohError,
  fetchDashboardSnapshot,
  type DashboardAlert,
  type LiveConfigValue,
  type WorkshopData,
} from './services/eohApi';

type LoadState = 'loading' | 'ready' | 'error';
type Accent = 'emerald' | 'amber' | 'sky';

type MetricView = {
  value: number | null;
  unit: string;
  decimals: number;
  subtitle: string;
  source: 'pson' | 'derived';
};

type WorkshopLayout = {
  panelId: string;
  title: string;
  subtitle: string;
  accent: Accent;
  aliases: string[];
};

const WORKSHOP_LAYOUT: WorkshopLayout[] = [
  {
    panelId: 'PAINT_SHOP_01',
    title: 'XUONG SON',
    subtitle: 'PAINT_SHOP_01',
    accent: 'emerald',
    aliases: ['PAINT_SHOP_01', 'PAINT SHOP', 'XUONG SON', 'P-SON', 'SON'],
  },
  {
    panelId: 'SPACE_SHOP_02',
    title: 'XUONG SPACE',
    subtitle: 'SPACE_SHOP_02',
    accent: 'amber',
    aliases: ['SPACE_SHOP_02', 'SPACE SHOP', 'XUONG SPACE'],
  },
  {
    panelId: 'OFFICE_MAIN_01',
    title: 'VAN PHONG',
    subtitle: 'OFFICE_MAIN_01',
    accent: 'sky',
    aliases: ['OFFICE_MAIN_01', 'OFFICE MAIN', 'VAN PHONG'],
  },
];

const STATUS_STYLE = {
  online: { text: 'text-emerald-300', dot: 'bg-emerald-400' },
  warning: { text: 'text-amber-300', dot: 'bg-amber-400' },
  offline: { text: 'text-rose-300', dot: 'bg-rose-400' },
};

const ACCENT_STYLE: Record<Accent, { color: string; soft: string; text: string }> = {
  emerald: { color: '#10b981', soft: 'rgba(16,185,129,0.18)', text: 'text-emerald-300' },
  amber: { color: '#f59e0b', soft: 'rgba(245,158,11,0.18)', text: 'text-amber-300' },
  sky: { color: '#38bdf8', soft: 'rgba(56,189,248,0.18)', text: 'text-sky-300' },
};

export default function App() {
  const [data, setData] = useState<WorkshopData[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [time, setTime] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const dataRef = useRef<WorkshopData[]>([]);

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let controller: AbortController | null = null;

    const load = async () => {
      if (inFlight) {
        return;
      }

      inFlight = true;
      controller = new AbortController();

      try {
        const snapshot = await fetchDashboardSnapshot(dataRef.current, controller.signal);

        if (disposed) {
          return;
        }

        dataRef.current = snapshot.workshops;
        setData(snapshot.workshops);
        setAlerts(snapshot.alerts);
        setLatencyMs(snapshot.latencyMs);
        setLastUpdated(snapshot.fetchedAt);
        setError('');
        setLoadState('ready');
      } catch (caughtError) {
        if (disposed || (caughtError instanceof DOMException && caughtError.name === 'AbortError')) {
          return;
        }

        setError(describeEohError(caughtError));
        setLoadState(dataRef.current.length ? 'ready' : 'error');
      } finally {
        inFlight = false;
      }
    };

    load();

    const dataTimer = window.setInterval(load, EOH_POLL_INTERVAL_MS);
    const clockTimer = window.setInterval(() => setTime(new Date()), 1000);

    return () => {
      disposed = true;
      controller?.abort();
      window.clearInterval(dataTimer);
      window.clearInterval(clockTimer);
    };
  }, []);

  const arrangedWorkshops = useMemo(
    () => WORKSHOP_LAYOUT.map((layout) => ({ layout, workshop: resolveWorkshop(layout, data) })),
    [data],
  );

  const firstPson = useMemo(() => findFirstPson(data), [data]);

  const totals = useMemo(() => {
    const totalPower = sumKnown(
      arrangedWorkshops.map(({ layout, workshop }) => {
        const psonOverride = layout.panelId === 'PAINT_SHOP_01' ? firstPson : null;
        return pickElectricPrimary(workshop, psonOverride, layout.panelId === 'PAINT_SHOP_01').value;
      }),
    );

    const totalWater = sumKnown(arrangedWorkshops.map(({ workshop }) => workshop.water.totalVolume));
    const currentLoad = sumKnown(arrangedWorkshops.map(({ workshop }) => workshop.power.activePower));

    return { totalPower, totalWater, currentLoad };
  }, [arrangedWorkshops, firstPson]);

  const systemStatus = getSystemStatus(loadState, error, data.length);

  return (
    <div className="scada-app relative flex h-screen w-full flex-col gap-4 overflow-hidden p-4 text-slate-100">
      <div className="scada-grid-overlay pointer-events-none absolute inset-0" aria-hidden="true" />

      <header className="glass-panel relative z-10 flex shrink-0 flex-col gap-4 rounded-2xl border border-slate-700/70 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 p-3 text-emerald-300 shadow-[0_0_28px_rgba(16,185,129,0.22)]">
            <Factory className="h-6 w-6" />
          </div>

          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold uppercase tracking-[0.08em] text-slate-100">Plant Performance SCADA</h1>
            <p className="mono truncate text-xs uppercase tracking-[0.24em] text-slate-400/80">
              REALTIME_TELEMETRY // HIERARCHY_MONITORING // ERA LIVE P-SON
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 lg:justify-end">
          <div>
            <p className="mono text-[10px] uppercase tracking-[0.2em] text-slate-500">Plant Status</p>
            <div className={cn('flex items-center gap-2 text-lg font-bold', systemStatus.textClass)}>
              <span className={cn('status-dot', systemStatus.dotClass)} />
              {systemStatus.label}
            </div>
          </div>

          <div>
            <p className="mono text-[10px] uppercase tracking-[0.2em] text-slate-500">System Time</p>
            <p className="mono text-2xl font-bold tabular-nums text-slate-100">{formatClock(time)}</p>
          </div>

          <div>
            <p className="mono text-[10px] uppercase tracking-[0.2em] text-slate-500">Last Sync</p>
            <p className="mono text-xs text-slate-300">{lastUpdated ? formatDateTime(lastUpdated) : '--'}</p>
          </div>
        </div>
      </header>

      {error ? (
        <div className="relative z-10 flex shrink-0 items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <span>{error}</span>
        </div>
      ) : null}

      {loadState === 'loading' ? (
        <CenteredPanel
          icon={<Activity className="h-6 w-6 animate-pulse text-emerald-300" />}
          title="Connecting to e-ra"
          subtitle="Streaming telemetry from EOH API"
        />
      ) : loadState === 'error' ? (
        <CenteredPanel
          icon={<AlertTriangle className="h-6 w-6 text-amber-300" />}
          title="Live data unavailable"
          subtitle="Please verify EOH token and network access"
        />
      ) : data.length === 0 ? (
        <CenteredPanel
          icon={<Clock3 className="h-6 w-6 text-slate-300" />}
          title="No workshop data"
          subtitle="EOH returned an empty unit list"
        />
      ) : (
        <main className="relative z-10 grid min-h-0 flex-grow grid-cols-1 gap-4 overflow-hidden xl:grid-cols-[320px_minmax(0,1fr)_360px]">
          <aside className="col-span-1 flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
            <section className="glass-panel rounded-2xl p-5">
              <h3 className="mono mb-5 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-400">
                <span>Global Telemetry</span>
                <Signal className="h-4 w-4 text-slate-500" />
              </h3>

              <div className="space-y-6">
                <MetricBlock
                  label="Total Power Consumption"
                  value={formatNumber(totals.totalPower, 1)}
                  unit="kWh"
                  tone="text-emerald-300"
                />

                <MetricBlock
                  label="Total Water Usage"
                  value={formatNumber(totals.totalWater, 1)}
                  unit="m3"
                  tone="text-sky-300"
                />

                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <p className="mono text-[10px] uppercase tracking-[0.16em] text-emerald-200/90">P-SON Realtime from e-ra</p>
                  <p className="mono mt-1 text-2xl font-bold tabular-nums text-emerald-300">
                    {formatNumber(firstPson?.value ?? null, 2)}{' '}
                    <small className="text-xs uppercase text-emerald-100/80">{firstPson?.unit || 'kWh'}</small>
                  </p>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="mono text-[10px] uppercase tracking-[0.16em] text-slate-500">Instantaneous Load</span>
                    <span className="mono text-sm font-bold text-amber-300">{formatNumber(totals.currentLoad, 1)} kW</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-amber-400 transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, totals.currentLoad ?? 0))}%` }}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="glass-panel rounded-2xl p-5">
              <h3 className="mono mb-4 text-xs uppercase tracking-[0.18em] text-slate-400">Operations Menu</h3>

              <div className="space-y-2">
                <button className="group flex w-full items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-left text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20">
                  <span className="flex items-center gap-2">
                    <ArrowUpRight className="h-4 w-4" />
                    PLANT OVERVIEW
                  </span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                </button>

                <button className="group flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-2 text-left text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:bg-slate-800/60">
                  <span className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    HISTORY ENGINE
                  </span>
                </button>

                <button className="group flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-2 text-left text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:bg-slate-800/60">
                  <span className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    SCADA CONFIG
                  </span>
                </button>
              </div>
            </section>
          </aside>

          <section className="col-span-1 flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
            {arrangedWorkshops.map(({ layout, workshop }) => (
              <div key={layout.panelId}>
                <WorkshopPanel
                  layout={layout}
                  workshop={workshop}
                  psonOverride={layout.panelId === 'PAINT_SHOP_01' ? firstPson : null}
                />
              </div>
            ))}
          </section>

          <aside className="col-span-1 flex min-h-0 flex-col gap-4 overflow-y-auto pl-1">
            <section className="glass-panel shrink-0 rounded-2xl p-5">
              <h3 className="mono mb-4 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-400">
                <span>Active Alerts</span>
                <AlertTriangle className="h-4 w-4 text-amber-300" />
              </h3>

              <div className="space-y-2">
                {alerts.length ? (
                  alerts.map((alert) => (
                    <div key={alert.id}>
                      <AlertItem alert={alert} />
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3 text-xs text-slate-400">
                    <div className="flex items-center gap-2 font-medium text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      No active alerts
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="glass-panel shrink-0 rounded-2xl border-l-4 border-l-slate-500 p-5">
              <h3 className="mono mb-2 text-xs uppercase tracking-[0.18em] text-slate-400">Diagnostic Mode</h3>
              <div className="space-y-1 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className={cn('h-2 w-2 rounded-full', error ? 'bg-amber-400' : 'bg-emerald-400')} />
                  {error ? 'DEGRADED' : 'ONLINE'}
                </div>
                <div className="mono text-[11px] text-slate-500">
                  ERA CORE sync: {lastUpdated ? formatDateTime(lastUpdated) : '--'}
                </div>
                <div className="mono text-[11px] text-slate-500">
                  P-SON stream: {firstPson ? 'LIVE' : 'NOT FOUND'}
                </div>
              </div>
            </section>

            <section className="glass-panel min-h-[250px] flex-grow overflow-y-auto rounded-2xl p-5">
              <h3 className="mono mb-4 text-xs uppercase tracking-[0.18em] text-slate-400">Activity Audit</h3>
              <div className="space-y-2">
                {createActivityItems(arrangedWorkshops.map((item) => item.workshop), firstPson).map((item, index) => (
                  <div key={`${item.time}-${index}`} className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-3">
                    <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500">{item.time}</div>
                    <p className="mt-1 text-sm font-medium text-slate-200">{item.message}</p>
                    {item.meta ? <p className="mono mt-1 text-[11px] text-slate-500">{item.meta}</p> : null}
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </main>
      )}

      <footer className="glass-panel relative z-10 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700/80 px-4 py-2 text-[11px] text-slate-400">
        <div className="mono flex flex-wrap items-center gap-4 uppercase tracking-[0.14em]">
          <span className="flex items-center gap-1 text-emerald-300">
            <Database className="h-3.5 w-3.5" />
            ERA CORE CONNECTED
          </span>
          <span>PING: {latencyMs == null ? '--' : `${latencyMs}ms`}</span>
          <span>DATA SOURCE: ERA_API/v1.0</span>
        </div>

        <div className="mono flex items-center gap-2 uppercase tracking-[0.14em]">
          <span className="rounded border border-slate-600 bg-slate-800/70 px-2 py-1">NODE: GX_808</span>
          <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-300">
            P-SON LIVE
          </span>
        </div>
      </footer>
    </div>
  );
}

function WorkshopPanel({
  layout,
  workshop,
  psonOverride,
}: {
  layout: WorkshopLayout;
  workshop: WorkshopData;
  psonOverride: LiveConfigValue | null;
}) {
  const accent = ACCENT_STYLE[layout.accent];
  const statusStyle = STATUS_STYLE[workshop.status];
  const electricPrimary = pickElectricPrimary(workshop, psonOverride, layout.panelId === 'PAINT_SHOP_01');
  const waterPrimary = pickWaterPrimary(workshop);
  const hasChartData = workshop.history.some((point) => point.power != null);

  return (
    <section
      className="glass-panel relative overflow-hidden rounded-2xl p-5"
      style={{ borderLeft: `4px solid ${accent.color}` }}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 text-slate-700/30">
        <Factory className="h-24 w-24" />
      </div>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl font-extrabold uppercase tracking-[0.05em] text-slate-100">{layout.title}</h2>
          <p className="mono text-xs uppercase tracking-[0.14em] text-slate-400">{layout.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <div className={cn('mono rounded-lg border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]', statusStyle.text)} style={{ borderColor: accent.soft, backgroundColor: accent.soft }}>
            <span className={cn('mr-2 inline-block h-2 w-2 rounded-full', statusStyle.dot)} />
            {workshop.status}
          </div>
          <div className="mono rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
            <Gauge className="mr-1 inline h-3 w-3" />
            {workshop.sensorCount} sensors
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <MeterCard
          icon={<Zap className="h-3.5 w-3.5 text-emerald-300" />}
          title="Electricity"
          value={formatNumber(electricPrimary.value, electricPrimary.decimals)}
          unit={electricPrimary.unit || 'kWh'}
          tone="text-emerald-300"
          subtitle={electricPrimary.subtitle}
          source={electricPrimary.source}
        />

        <MeterCard
          icon={<Droplets className="h-3.5 w-3.5 text-sky-300" />}
          title="Hydraulic"
          value={formatNumber(waterPrimary.value, waterPrimary.decimals)}
          unit={waterPrimary.unit}
          tone="text-sky-300"
          subtitle="TOTAL USAGE"
          source="derived"
        />
      </div>

      <div className="mt-4 rounded-xl border border-slate-700/80 bg-slate-900/35 p-3">
        <p className="mono mb-3 text-[11px] uppercase tracking-[0.18em] text-slate-400">
          {workshop.trendLabel} {workshop.trendUnit ? `(${workshop.trendUnit})` : ''}
        </p>
        <div className="h-[130px] w-full">
          {hasChartData ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={workshop.history}>
                <defs>
                  <linearGradient id={`trace-${layout.panelId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={accent.color} stopOpacity={0.38} />
                    <stop offset="95%" stopColor={accent.color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#223049" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#101a30',
                    border: '1px solid #243451',
                    borderRadius: '10px',
                    fontSize: '11px',
                  }}
                  labelStyle={{ color: '#9fb2cc' }}
                />
                <Area
                  type="stepAfter"
                  dataKey="power"
                  stroke={accent.color}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill={`url(#trace-${layout.panelId})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-500">Waiting for live samples</div>
          )}
        </div>
      </div>
    </section>
  );
}

function MeterCard({
  icon,
  title,
  value,
  unit,
  tone,
  subtitle,
  source,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  unit: string;
  tone: string;
  subtitle: string;
  source: 'pson' | 'derived';
}) {
  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/45 p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="mono text-[11px] uppercase tracking-[0.16em] text-slate-500">{title}</p>
          <p className="mono mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-600">{subtitle}</p>
        </div>
        {icon}
      </div>

      <div className="flex items-end gap-2">
        <span className={cn('mono text-4xl font-bold tabular-nums leading-none', tone)}>{value}</span>
        <span className="mono mb-1 text-xs uppercase text-slate-400">{unit}</span>
      </div>

      {source === 'pson' ? (
        <p className="mono mt-2 text-[10px] uppercase tracking-[0.14em] text-emerald-300">
          {value === '--' ? 'Waiting for P-SON from e-ra' : 'Direct source: P-SON from e-ra'}
        </p>
      ) : null}
    </div>
  );
}

function MetricBlock({ label, value, unit, tone }: { label: string; value: string; unit: string; tone: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="mono text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <span className={cn('mono text-5xl font-bold leading-none tabular-nums', tone)}>
        {value} <small className="text-lg uppercase text-slate-400">{unit}</small>
      </span>
    </div>
  );
}

function AlertItem({ alert }: { alert: DashboardAlert }) {
  const isCritical = normalizeKey(alert.title).includes('CRITICAL') || normalizeKey(alert.title).includes('PEAK');

  return (
    <div className={cn(
      'rounded-xl border p-3 text-xs',
      isCritical ? 'border-rose-500/40 bg-rose-500/10' : 'border-amber-500/30 bg-amber-500/10',
    )}>
      <p className={cn('text-sm font-semibold uppercase tracking-[0.04em]', isCritical ? 'text-rose-200' : 'text-amber-100')}>
        {isCritical ? 'CRITICAL' : 'WARNING'}: {alert.title}
      </p>
      <p className="mt-1 text-sm text-slate-200">{alert.location}</p>
      {alert.createdAt ? <p className="mono mt-2 text-[11px] text-slate-500">{formatDateTime(new Date(alert.createdAt))}</p> : null}
    </div>
  );
}

function CenteredPanel({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <main className="glass-panel relative z-10 flex min-h-0 flex-grow items-center justify-center rounded-2xl">
      <div className="flex flex-col items-center gap-2 text-slate-300">
        {icon}
        <p className="mono text-base uppercase tracking-[0.18em]">{title}</p>
        <p className="mono text-xs uppercase tracking-[0.12em] text-slate-500">{subtitle}</p>
      </div>
    </main>
  );
}

function resolveWorkshop(layout: WorkshopLayout, workshops: WorkshopData[]) {
  const matched = workshops.find((workshop) => {
    const target = normalizeKey([
      workshop.id,
      workshop.name,
      ...(workshop.matchHints ?? []),
    ].join(' '));
    return layout.aliases.some((alias) => target.includes(normalizeKey(alias)));
  });

  return matched ?? createPlaceholderWorkshop(layout.panelId);
}

function createPlaceholderWorkshop(id: string): WorkshopData {
  const now = new Date().toISOString();

  return {
    id,
    name: id,
    status: 'offline',
    power: {
      voltage: null,
      current: null,
      activePower: null,
      totalEnergy: null,
      frequency: null,
      pf: null,
    },
    water: {
      flowRate: null,
      totalVolume: null,
      pressure: null,
    },
    history: [],
    liveValues: [],
    trendLabel: 'No Data',
    trendUnit: '',
    configCount: 0,
    sensorCount: 0,
    chipCount: 0,
    sourceUpdatedAt: now,
    matchHints: [],
  };
}

function pickElectricPrimary(
  workshop: WorkshopData,
  psonOverride: LiveConfigValue | null,
  requirePson = false,
): MetricView {
  const directPson = findPsonInWorkshop(workshop) ?? psonOverride;

  if (directPson?.value != null) {
    return {
      value: directPson.value,
      unit: directPson.unit || 'kWh',
      decimals: 2,
      subtitle: 'P-SON TOTAL CUMULATIVE',
      source: 'pson',
    };
  }

  if (requirePson) {
    return {
      value: null,
      unit: 'kWh',
      decimals: 2,
      subtitle: 'P-SON WAITING',
      source: 'pson',
    };
  }

  const fallback = [
    { value: workshop.power.totalEnergy, unit: 'kWh', decimals: 2, subtitle: 'TOTAL ENERGY' },
    { value: workshop.power.activePower, unit: 'kW', decimals: 2, subtitle: 'ACTIVE POWER' },
    { value: workshop.power.voltage, unit: 'V', decimals: 1, subtitle: 'VOLTAGE' },
    { value: workshop.power.current, unit: 'A', decimals: 1, subtitle: 'CURRENT' },
  ].find((item) => item.value != null);

  if (!fallback) {
    return {
      value: null,
      unit: 'kWh',
      decimals: 2,
      subtitle: 'NO ELECTRIC DATA',
      source: 'derived',
    };
  }

  return { ...fallback, source: 'derived' };
}

function pickWaterPrimary(workshop: WorkshopData) {
  return [
    { value: workshop.water.totalVolume, unit: 'm3', decimals: 1 },
    { value: workshop.water.flowRate, unit: 'L/s', decimals: 2 },
    { value: workshop.water.pressure, unit: 'Bar', decimals: 2 },
  ].find((item) => item.value != null) ?? { value: null, unit: 'm3', decimals: 1 };
}

function findPsonInWorkshop(workshop: WorkshopData) {
  return workshop.liveValues.find((metric) => metric.targetKey === 'pson') ?? null;
}

function findFirstPson(workshops: WorkshopData[]) {
  for (const workshop of workshops) {
    const pson = findPsonInWorkshop(workshop);

    if (pson?.value != null) {
      return pson;
    }
  }

  return null;
}

function createActivityItems(workshops: WorkshopData[], pson: LiveConfigValue | null) {
  const entries = workshops.map((workshop) => {
    const timestamp = workshop.sourceUpdatedAt ? new Date(workshop.sourceUpdatedAt) : new Date();
    return {
      time: formatClock(timestamp),
      message: `Data packet received from ${workshop.name || workshop.id}`,
      meta: workshop.status === 'online' ? 'SECURE CHANNEL' : 'PENDING / DEGRADED',
    };
  });

  if (pson?.value != null) {
    entries.unshift({
      time: formatClock(new Date(pson.updatedAt || Date.now())),
      message: `P-SON realtime value: ${formatNumber(pson.value, 2)} ${pson.unit || ''}`.trim(),
      meta: 'DIRECT FROM E-RA',
    });
  }

  return entries.slice(0, 8);
}

function getSystemStatus(loadState: LoadState, error: string, dataLength: number) {
  if (loadState === 'loading') {
    return { label: 'SYNCING', textClass: 'text-amber-300', dotClass: 'bg-amber-400' };
  }

  if (loadState === 'error' || (error && dataLength === 0)) {
    return { label: 'API ERROR', textClass: 'text-rose-300', dotClass: 'bg-rose-400' };
  }

  if (error) {
    return { label: 'STALE DATA', textClass: 'text-amber-300', dotClass: 'bg-amber-400' };
  }

  return { label: 'ALL SYSTEMS NORMAL', textClass: 'text-emerald-300', dotClass: 'bg-emerald-400' };
}

function sumKnown(values: (number | null)[]) {
  const known = values.filter((value): value is number => value != null);
  return known.length ? known.reduce((sum, value) => sum + value, 0) : null;
}

function formatNumber(value: number | null, maximumFractionDigits: number) {
  if (value == null) {
    return '--';
  }

  return value.toLocaleString(undefined, { maximumFractionDigits });
}

function formatClock(date: Date) {
  return date.toLocaleTimeString(undefined, {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDateTime(date: Date) {
  return date.toLocaleString(undefined, {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function normalizeKey(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
}
