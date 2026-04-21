import { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  Droplets, 
  Zap, 
  Clock, 
  Settings, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  Factory,
  BarChart3,
  Gauge as GaugeIcon
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// --- Types & Constants ---

interface PowerData {
  voltage: number;
  current: number;
  activePower: number;
  totalEnergy: number;
  frequency: number;
  pf: number; // Power Factor
}

interface WaterData {
  flowRate: number;
  totalVolume: number;
  pressure: number;
}

interface WorkshopData {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'warning';
  power: PowerData;
  water: WaterData;
  history: { time: string; power: number }[];
}

const GENERATION_INTERVAL = 3000;
const MAX_HISTORY_POINTS = 20;

// --- Mock Data Utilities ---

const generateMockData = (prevData?: WorkshopData[]): WorkshopData[] => {
  const workshops = [
    { name: 'Xưởng Sơn', id: 'son', shopCode: 'PAINT_SHOP_01' },
    { name: 'Xưởng Space', id: 'space', shopCode: 'SPACE_SHOP_02' }
  ];
  
  return workshops.map((shop) => {
    const prev = prevData?.find(d => d.id === shop.id);
    const newPower = (prev?.power.activePower || 4500) + (Math.random() * 200 - 100);
    const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    const newHistory = [...(prev?.history || [])];
    newHistory.push({ time: timeLabel, power: newPower });
    if (newHistory.length > MAX_HISTORY_POINTS) newHistory.shift();
    
    return {
      id: shop.id,
      name: shop.name,
      status: Math.random() > 0.98 ? 'warning' : 'online',
      power: {
        voltage: 220 + (Math.random() * 2 - 1),
        current: (prev?.power.current || 20) + (Math.random() * 1 - 0.5),
        activePower: newPower,
        totalEnergy: (prev?.power.totalEnergy || 12500) + Math.random() * 0.1,
        frequency: 50 + (Math.random() * 0.1 - 0.05),
        pf: 0.92 + (Math.random() * 0.05),
      },
      water: {
        flowRate: (prev?.water.flowRate || 5) + (Math.random() * 0.2 - 0.1),
        totalVolume: (prev?.water.totalVolume || 840) + Math.random() * 0.05,
        pressure: 3.5 + (Math.random() * 0.4 - 0.2),
      },
      history: newHistory,
    };
  });
};

// --- Sub-components ---

// --- Main App ---

export default function App() {
  const [data, setData] = useState<WorkshopData[]>([]);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    setData(generateMockData());
    const dataTimer = setInterval(() => {
      setData(prev => generateMockData(prev));
    }, GENERATION_INTERVAL);

    const clockTimer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => {
      clearInterval(dataTimer);
      clearInterval(clockTimer);
    };
  }, []);

  if (data.length === 0) return null;

  const totalPower = data.reduce((acc, current) => acc + current.power.totalEnergy, 0);
  const totalWater = data.reduce((acc, current) => acc + current.water.totalVolume, 0);
  const currentLoad = data.reduce((acc, current) => acc + current.power.activePower, 0) / 1000;

  return (
    <div className="flex flex-col h-screen w-full p-4 gap-4 overflow-hidden bg-[#0f172a]">
      {/* Header */}
      <header className="flex justify-between items-center bg-slate-800/80 p-4 rounded-lg border border-slate-700 shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-emerald-500 rounded text-slate-900">
            <Factory className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight uppercase">Industrial Energy Monitor System</h1>
            <p className="text-xs text-slate-400 mono opacity-70">SCADA_NODE_v2.4 // ENERGY_HUB_01</p>
          </div>
        </div>
        
        <div className="flex gap-8 items-center">
          <div className="text-right">
            <p className="text-xs text-slate-500 uppercase">System Status</p>
            <div className="flex items-center justify-end text-emerald-400 font-bold">
              <span className="status-dot bg-emerald-500 glow-emerald"></span>
              OPERATIONAL
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 uppercase">Last Update</p>
            <p className="mono text-sm">{time.toLocaleTimeString()}</p>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-grow overflow-hidden min-h-0">
        {/* Left Sidebar */}
        <aside className="col-span-1 flex flex-col gap-4 overflow-y-auto pr-1">
          <section className="glass-panel p-4 rounded-xl shrink-0">
            <h3 className="text-xs font-semibold text-slate-400 mb-4 border-b border-slate-700 pb-2 uppercase tracking-wider">Global Metrics</h3>
            <div className="space-y-6">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase font-mono tracking-tighter">Total Power Consumption</span>
                <span className="text-3xl font-bold mono text-emerald-400 tabular-nums">
                  {totalPower.toLocaleString(undefined, { maximumFractionDigits: 1 })} <small className="text-sm">kWh</small>
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase font-mono tracking-tighter">Total Water Usage</span>
                <span className="text-3xl font-bold mono text-sky-400 tabular-nums">
                  {totalWater.toLocaleString(undefined, { maximumFractionDigits: 1 })} <small className="text-sm">m³</small>
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase font-mono tracking-tighter">Current Load</span>
                <span className="text-3xl font-bold mono text-amber-400 tabular-nums">
                  {currentLoad.toFixed(1)} <small className="text-sm">kW</small>
                </span>
                <div className="w-full bg-slate-700 h-1.5 mt-2 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full transition-all duration-500" style={{ width: `${Math.min(100, currentLoad / 0.2)}%` }}></div>
                </div>
              </div>
            </div>
          </section>

          <section className="glass-panel p-4 rounded-xl flex-grow overflow-y-auto">
            <h3 className="text-xs font-semibold text-slate-400 mb-4 border-b border-slate-700 pb-2 uppercase tracking-wider">System Alerts</h3>
            <div className="space-y-2">
              <div className="text-xs p-3 bg-slate-800/50 border-l-2 border-amber-500 rounded backdrop-blur">
                <p className="text-slate-300 font-medium">Phase Unbalance Detected</p>
                <p className="text-[10px] text-slate-500 mt-1 uppercase font-mono">Xưởng Space - Circuit A2</p>
              </div>
              <div className="text-xs p-3 bg-slate-800/50 border-l-2 border-emerald-500 rounded backdrop-blur">
                <p className="text-slate-300 font-medium">Flow rate stabilized</p>
                <p className="text-[10px] text-slate-500 mt-1 uppercase font-mono">Xưởng Sơn - Line 04</p>
              </div>
              <div className="text-xs p-3 bg-slate-800/50 border-l-2 border-slate-600 rounded opacity-60">
                <p className="text-slate-400">Routine Check Completed</p>
                <p className="text-[10px] text-slate-500 mt-1 uppercase font-mono">Energy Hub Gateway</p>
              </div>
            </div>
          </section>
        </aside>

        {/* Content Area */}
        <div className="col-span-1 lg:col-span-3 grid grid-rows-2 gap-4 h-full min-h-0 overflow-y-auto lg:overflow-hidden pr-1 lg:pr-0">
          {data.map((workshop, idx) => (
            <div key={workshop.id} className="glass-panel rounded-xl p-5 lg:p-6 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none">
                <Factory className="w-32 h-32" />
              </div>
              
              <div className="flex justify-between items-start mb-4 lg:mb-6 shrink-0">
                <h2 className="text-xl lg:text-2xl font-black uppercase tracking-widest text-slate-100 flex items-center gap-3">
                  <span className={cn(
                    "w-3 h-10 rounded-sm shrink-0",
                    workshop.id === 'son' ? "bg-emerald-500" : "bg-amber-500"
                  )}></span> 
                  {workshop.name} 
                  <span className={cn(
                    "text-[10px] font-mono font-normal px-2 py-1 rounded tracking-tighter shrink-0",
                    workshop.id === 'son' ? "text-emerald-500 bg-emerald-500/10" : "text-amber-500 bg-amber-500/10"
                  )}>
                    {workshop.id === 'son' ? 'PAINT_SHOP_01' : 'SPACE_SHOP_02'}
                  </span>
                </h2>
                <div className="flex gap-2 lg:gap-4">
                  <div className="px-2 lg:px-3 py-1 bg-slate-800/80 rounded border border-slate-700 text-[10px] mono uppercase text-slate-400">
                    STATUS: {workshop.status.toUpperCase()}
                  </div>
                  <div className="px-2 lg:px-3 py-1 bg-slate-800/80 rounded border border-slate-700 text-[10px] mono uppercase text-slate-400 hidden sm:block">
                    UPTIME: 100%
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 flex-grow">
                {/* Electricity */}
                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-[10px] uppercase text-slate-500 font-mono">Electricity Meter (E-00{4+idx})</p>
                    <Zap className="w-3 h-3 text-emerald-500" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl lg:text-4xl font-bold mono text-emerald-400 tabular-nums">
                      {workshop.power.totalEnergy.toFixed(2)}
                    </span>
                    <span className="text-xs text-slate-400 uppercase font-mono">kWh</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-[9px] mono text-slate-500 border-t border-slate-800 pt-2">
                    <div className="flex justify-between">
                      <span>VOLT:</span>
                      <span className="text-slate-300">{workshop.power.voltage.toFixed(1)}V</span>
                    </div>
                    <div className="flex justify-between">
                      <span>FREQ:</span>
                      <span className="text-slate-300">{workshop.power.frequency.toFixed(2)}Hz</span>
                    </div>
                  </div>
                </div>

                {/* Water */}
                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-[10px] uppercase text-slate-500 font-mono">Water Meter (W-01{2+idx})</p>
                    <Droplets className="w-3 h-3 text-sky-500" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl lg:text-4xl font-bold mono text-sky-400 tabular-nums">
                      {workshop.water.totalVolume.toFixed(1)}
                    </span>
                    <span className="text-xs text-slate-400 uppercase font-mono">m³</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-[9px] mono text-slate-500 border-t border-slate-800 pt-2">
                    <div className="flex justify-between">
                      <span>FLOW:</span>
                      <span className="text-sky-400">{workshop.water.flowRate.toFixed(1)}L/s</span>
                    </div>
                    <div className="flex justify-between">
                      <span>PRES:</span>
                      <span className="text-slate-300">{workshop.water.pressure.toFixed(1)}Bar</span>
                    </div>
                  </div>
                </div>

                {/* History Chart */}
                <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 flex flex-col h-[120px] md:h-full">
                  <p className="text-[10px] uppercase text-slate-500 mb-2 font-mono">Active Load Trend (kW)</p>
                  <div className="flex-grow min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={workshop.history}>
                        <defs>
                          <linearGradient id={`gradient-${workshop.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={workshop.id === 'son' ? "#10b981" : "#f59e0b"} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={workshop.id === 'son' ? "#10b981" : "#f59e0b"} stopOpacity={0}/>
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
                          stroke={workshop.id === 'son' ? "#10b981" : "#f59e0b"} 
                          fillOpacity={1} 
                          fill={`url(#gradient-${workshop.id})`} 
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 p-2 shrink-0 flex justify-between items-center text-[10px] mono text-slate-500 rounded-b-lg">
        <div className="flex gap-6">
          <span>LATENCY: 12ms</span>
          <span>UPTIME: 242d 11h 05m</span>
          <span>NODE ID: GX-008</span>
        </div>
        <div className="flex gap-4">
          <span className="hidden sm:inline">PLC COMMUNICATION: [CONNECTED]</span>
          <span className="hidden sm:inline">DATABASE SYNC: [IDLE]</span>
          <span className="sm:hidden text-emerald-500 font-bold uppercase tracking-widest">[ONLINE]</span>
        </div>
      </footer>
    </div>
  );
}
