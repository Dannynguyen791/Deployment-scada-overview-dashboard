import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Droplets,
  Factory,
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
  type WorkshopData,
} from './services/eohApi';

type LoadState = 'loading' | 'ready' | 'error';

const STATUS_CLASS = {
  online: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  warning: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  offline: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
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

  const totals = useMemo(() => {
    const totalPower = sumKnown(data.map((workshop) => workshop.power.totalEnergy));
    const totalWater = sumKnown(data.map((workshop) => workshop.water.totalVolume));
    const currentLoad = sumKnown(data.map((workshop) => workshop.power.activePower));
    const configCount = data.reduce((sum, workshop) => sum + workshop.configCount, 0);
    const sensorCount = data.reduce((sum, workshop) => sum + workshop.sensorCount, 0);

    return { totalPower, totalWater, currentLoad, configCount, sensorCount };
  }, [data]);

  const systemStatus = getSystemStatus(loadState, error, data.length);

  return (
    <div className="flex h-screen w-full flex-col gap-4 overflow-hidden bg-[#0f172a] p-4">
      <header className="flex shrink-0 flex-col gap-4 rounded-lg border border-slate-700 bg-slate-800/80 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="rounded bg-emerald-500 p-2 text-slate-900">
            <Factory className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold uppercase tracking-tight">Industrial Energy Monitor System</h1>
            <p className="mono truncate text-xs text-slate-400 opacity-70">EOH_API // SCADA_DASHBOARD</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 md:justify-end">
          <div>
            <p className="text-xs uppercase text-slate-500">System Status</p>
            <div className={cn('flex items-center font-bold', systemStatus.color)}>
              <span className={cn('status-dot', systemStatus.dot)} />
              {systemStatus.label}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Last Update</p>
            <p className="mono text-sm">{lastUpdated ? lastUpdated.toLocaleTimeString() : time.toLocaleTimeString()}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Poll Rate</p>
            <p className="mono text-sm">{Math.round(EOH_POLL_INTERVAL_MS / 1000)}s</p>
          </div>
        </div>
      </header>

      {error ? (
        <div className="flex shrink-0 items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <span>{error}</span>
        </div>
      ) : null}

      {loadState === 'loading' ? (
        <CenteredPanel icon={<Activity className="h-6 w-6 animate-pulse text-emerald-400" />} title="Connecting to EoH API" />
      ) : loadState === 'error' ? (
        <CenteredPanel icon={<AlertTriangle className="h-6 w-6 text-amber-300" />} title="Live data is unavailable" />
      ) : data.length === 0 ? (
        <CenteredPanel icon={<Clock className="h-6 w-6 text-slate-300" />} title="No units returned by EoH API" />
      ) : (
        <main className="grid min-h-0 flex-grow grid-cols-1 gap-4 overflow-hidden lg:grid-cols-4">
          <aside className="col-span-1 flex flex-col gap-4 overflow-y-auto pr-1">
            <section className="glass-panel shrink-0 rounded-xl p-4">
              <h3 className="mb-4 border-b border-slate-700 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Global Metrics</h3>
              <div className="space-y-6">
                <MetricBlock label="Total Power Consumption" value={formatNumber(totals.totalPower, 1)} unit="kWh" tone="text-emerald-400" />
                <MetricBlock label="Total Water Usage" value={formatNumber(totals.totalWater, 1)} unit="m3" tone="text-sky-400" />
                <div className="flex flex-col">
                  <span className="mono text-[10px] uppercase tracking-tighter text-slate-500">Current Load</span>
                  <span className="mono text-3xl font-bold tabular-nums text-amber-400">
                    {formatNumber(totals.currentLoad, 1)} <small className="text-sm">kW</small>
                  </span>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
                    <div
                      className="h-full bg-amber-400 transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, totals.currentLoad ?? 0))}%` }}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="glass-panel flex-grow overflow-y-auto rounded-xl p-4">
              <h3 className="mb-4 border-b border-slate-700 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">System Alerts</h3>
              <div className="space-y-2">
                {alerts.length ? alerts.map((alert) => (
                  <div key={alert.id}>
                    <AlertItem alert={alert} />
                  </div>
                )) : (
                  <div className="rounded border border-slate-700 bg-slate-800/50 p-3 text-xs text-slate-400">
                    <div className="flex items-center gap-2 font-medium text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      No active API alerts
                    </div>
                  </div>
                )}
              </div>
            </section>
          </aside>

          <div className="col-span-1 flex min-h-0 flex-col gap-4 overflow-y-auto pr-1 lg:col-span-3 lg:pr-0">
            {data.map((workshop) => (
              <div key={workshop.id}>
                <WorkshopPanel workshop={workshop} />
              </div>
            ))}
          </div>
        </main>
      )}

      <footer className="mono flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-b-lg border-t border-slate-800 bg-slate-900 p-2 text-[10px] text-slate-500">
        <div className="flex flex-wrap gap-6">
          <span>API LATENCY: {latencyMs == null ? '--' : `${latencyMs}ms`}</span>
          <span>UNITS: {data.length}</span>
          <span>SENSORS: {totals.sensorCount}</span>
          <span>CONFIGS: {totals.configCount}</span>
        </div>
        <div className="flex gap-4">
          <span className="hidden sm:inline">DATA SOURCE: BACKEND.EOH.IO</span>
          <span className="font-bold uppercase tracking-widest text-emerald-500 sm:hidden">EOH API</span>
        </div>
      </footer>
    </div>
  );
}

function WorkshopPanel({ workshop }: { workshop: WorkshopData }) {
  const statusClass = STATUS_CLASS[workshop.status];
  const hasChartData = workshop.history.some((point) => point.power != null);
  const electricPrimary = pickElectricPrimary(workshop);
  const waterPrimary = pickWaterPrimary(workshop);

  return (
    <section className="glass-panel relative flex min-h-[280px] flex-col justify-between overflow-hidden rounded-xl p-5 lg:p-6">
      <div className="pointer-events-none absolute right-0 top-0 p-2 opacity-5">
        <Factory className="h-32 w-32" />
      </div>

      <div className="mb-4 flex shrink-0 flex-col gap-3 lg:mb-6 lg:flex-row lg:items-start lg:justify-between">
        <h2 className="flex min-w-0 items-center gap-3 text-xl font-black uppercase tracking-widest text-slate-100 lg:text-2xl">
          <span className={cn('h-10 w-3 shrink-0 rounded-sm', workshop.status === 'online' ? 'bg-emerald-500' : 'bg-amber-500')} />
          <span className="truncate">{workshop.name}</span>
          <span className="mono shrink-0 rounded bg-slate-800 px-2 py-1 text-[10px] font-normal tracking-tighter text-slate-400">
            UNIT-{workshop.id}
          </span>
        </h2>
        <div className="flex flex-wrap gap-2 lg:gap-4">
          <div className={cn('mono rounded border px-2 py-1 text-[10px] uppercase', statusClass)}>
            STATUS: {workshop.status.toUpperCase()}
          </div>
          <div className="mono rounded border border-slate-700 bg-slate-800/80 px-2 py-1 text-[10px] uppercase text-slate-400">
            SENSORS: {workshop.sensorCount}
          </div>
        </div>
      </div>

      <div className="grid flex-grow grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <MeterCard
          icon={<Zap className="h-3 w-3 text-emerald-500" />}
          title="Electricity"
          value={formatNumber(electricPrimary.value, electricPrimary.decimals)}
          unit={electricPrimary.unit}
          tone="text-emerald-400"
          rows={[
            ['VOLT', `${formatNumber(workshop.power.voltage, 1)}V`],
            ['FREQ', `${formatNumber(workshop.power.frequency, 2)}Hz`],
            ['AMP', `${formatNumber(workshop.power.current, 1)}A`],
            ['PF', formatNumber(workshop.power.pf, 2)],
          ]}
        />

        <MeterCard
          icon={<Droplets className="h-3 w-3 text-sky-500" />}
          title="Water"
          value={formatNumber(waterPrimary.value, waterPrimary.decimals)}
          unit={waterPrimary.unit}
          tone="text-sky-400"
          rows={[
            ['FLOW', `${formatNumber(workshop.water.flowRate, 1)}L/s`],
            ['PRES', `${formatNumber(workshop.water.pressure, 1)}Bar`],
          ]}
        />

        <div className="flex h-[150px] flex-col rounded-lg border border-slate-700 bg-slate-900/50 p-3 md:h-full">
          <p className="mono mb-2 text-[10px] uppercase text-slate-500">
            {workshop.trendLabel} {workshop.trendUnit ? `(${workshop.trendUnit})` : ''}
          </p>
          <div className="min-h-0 flex-grow">
            {hasChartData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={workshop.history}>
                  <defs>
                    <linearGradient id={`gradient-${workshop.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="time" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', fontSize: '10px' }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="power"
                    stroke="#10b981"
                    fillOpacity={1}
                    fill={`url(#gradient-${workshop.id})`}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-500">Waiting for live samples</div>
            )}
          </div>
          {workshop.liveValues.length ? (
            <div className="mono mt-2 grid grid-cols-1 gap-1 border-t border-slate-800 pt-2 text-[10px] text-slate-500">
              {workshop.liveValues.slice(0, 4).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3">
                  <span className="truncate">{item.name}</span>
                  <span className="shrink-0 text-emerald-300">
                    {formatNumber(item.value, 2)} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function MetricBlock({ label, value, unit, tone }: { label: string; value: string; unit: string; tone: string }) {
  return (
    <div className="flex flex-col">
      <span className="mono text-[10px] uppercase tracking-tighter text-slate-500">{label}</span>
      <span className={cn('mono text-3xl font-bold tabular-nums', tone)}>
        {value} <small className="text-sm">{unit}</small>
      </span>
    </div>
  );
}

function MeterCard({
  icon,
  title,
  value,
  unit,
  tone,
  rows,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  unit: string;
  tone: string;
  rows: [string, string][];
}) {
  return (
    <div className="flex flex-col justify-between rounded-lg border border-slate-700 bg-slate-900/50 p-4">
      <div className="mb-2 flex items-start justify-between">
        <p className="mono text-[10px] uppercase text-slate-500">{title}</p>
        {icon}
      </div>
      <div className="flex items-baseline gap-2">
        <span className={cn('mono text-3xl font-bold tabular-nums lg:text-4xl', tone)}>{value}</span>
        <span className="mono text-xs uppercase text-slate-400">{unit}</span>
      </div>
      <div className="mono mt-4 grid grid-cols-2 gap-2 border-t border-slate-800 pt-2 text-[9px] text-slate-500">
        {rows.map(([label, rowValue]) => (
          <div key={label} className="flex justify-between gap-2">
            <span>{label}:</span>
            <span className="text-slate-300">{rowValue}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertItem({ alert }: { alert: DashboardAlert }) {
  return (
    <div className="rounded border-l-2 border-amber-500 bg-slate-800/50 p-3 text-xs backdrop-blur">
      <p className="font-medium text-slate-300">{alert.title}</p>
      <p className="mono mt-1 text-[10px] uppercase text-slate-500">{alert.location}</p>
      {alert.createdAt ? (
        <p className="mono mt-1 text-[10px] text-slate-600">{new Date(alert.createdAt).toLocaleString()}</p>
      ) : null}
    </div>
  );
}

function CenteredPanel({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <main className="glass-panel flex min-h-0 flex-grow items-center justify-center rounded-xl">
      <div className="flex flex-col items-center gap-3 text-slate-300">
        {icon}
        <p className="mono text-sm uppercase tracking-wider">{title}</p>
      </div>
    </main>
  );
}

function getSystemStatus(loadState: LoadState, error: string, dataLength: number) {
  if (loadState === 'loading') {
    return { label: 'SYNCING', color: 'text-amber-400', dot: 'bg-amber-500' };
  }

  if (loadState === 'error' || (error && dataLength === 0)) {
    return { label: 'API ERROR', color: 'text-rose-400', dot: 'bg-rose-500' };
  }

  return {
    label: error ? 'STALE DATA' : 'OPERATIONAL',
    color: error ? 'text-amber-400' : 'text-emerald-400',
    dot: error ? 'bg-amber-500' : 'bg-emerald-500 glow-emerald',
  };
}

function sumKnown(values: (number | null)[]) {
  const knownValues = values.filter((value): value is number => value != null);
  return knownValues.length ? knownValues.reduce((sum, value) => sum + value, 0) : null;
}

function formatNumber(value: number | null, maximumFractionDigits: number) {
  if (value == null) {
    return '--';
  }

  return value.toLocaleString(undefined, { maximumFractionDigits });
}

function pickElectricPrimary(workshop: WorkshopData) {
  return [
    { value: workshop.power.totalEnergy, unit: 'kWh', decimals: 2 },
    { value: workshop.power.activePower, unit: 'kW', decimals: 2 },
    { value: workshop.power.voltage, unit: 'V', decimals: 2 },
    { value: workshop.power.current, unit: 'A', decimals: 2 },
    { value: workshop.power.frequency, unit: 'Hz', decimals: 2 },
  ].find((item) => item.value != null) ?? { value: null, unit: 'kWh', decimals: 2 };
}

function pickWaterPrimary(workshop: WorkshopData) {
  return [
    { value: workshop.water.totalVolume, unit: 'm3', decimals: 1 },
    { value: workshop.water.flowRate, unit: 'L/s', decimals: 2 },
    { value: workshop.water.pressure, unit: 'Bar', decimals: 2 },
  ].find((item) => item.value != null) ?? { value: null, unit: 'm3', decimals: 1 };
}
