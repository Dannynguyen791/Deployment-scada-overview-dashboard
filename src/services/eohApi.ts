const DEFAULT_API_BASE_URL = 'https://backend.eoh.io/api';
const PRODUCTION_PROXY_BASE_URL = '/api/eoh';
const DEFAULT_POLL_INTERVAL_MS = 10000;
const TOPOLOGY_TTL_MS = 5 * 60 * 1000;
const MAX_HISTORY_POINTS = 20;
const PSON_TARGET_KEY = 'pson';
const PCON_TARGET_KEY = 'pcon';
const DEFAULT_PSON_CONFIG_ID = '165693';
const DEFAULT_PCON_CONFIG_ID = '169059';
const DEFAULT_PSON_GATEWAY_ID = '13368';
const DEFAULT_PSON_NAME = 'P-SON';
const DEFAULT_PCON_NAME = 'P-CON';
const DEFAULT_PSON_FUNCTION_CODE = '4';
const DEFAULT_PSON_DATA_ADDRESS = '58';
const DEFAULT_PSON_DATA_LENGTH = '2';
const DEFAULT_PSON_TRANSFORMER = 'Float - Big Endian';
const DEFAULT_PSON_UNIT_KEYS = 'PAINT_SHOP_01,XUONG SON';

type MetricValue = number | null;

export interface LiveConfigValue {
  id: number;
  name: string;
  unit: string;
  value: MetricValue;
  sourceName: string;
  updatedAt: string;
  targetKey?: string;
  gatewayId?: number;
  functionCode?: number;
  dataAddress?: number;
  dataLength?: number;
  transformer?: string;
}

export interface PowerData {
  voltage: MetricValue;
  current: MetricValue;
  activePower: MetricValue;
  totalEnergy: MetricValue;
  frequency: MetricValue;
  pf: MetricValue;
}

export interface WaterData {
  flowRate: MetricValue;
  totalVolume: MetricValue;
  pressure: MetricValue;
}

export interface WorkshopData {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'warning';
  power: PowerData;
  water: WaterData;
  history: { time: string; power: MetricValue }[];
  liveValues: LiveConfigValue[];
  trendLabel: string;
  trendUnit: string;
  configCount: number;
  sensorCount: number;
  chipCount: number;
  sourceUpdatedAt: string;
  matchHints: string[];
}

export interface DashboardAlert {
  id: string;
  title: string;
  location: string;
  createdAt: string;
  tone: 'warning' | 'critical' | 'info';
}

export interface DashboardSnapshot {
  workshops: WorkshopData[];
  alerts: DashboardAlert[];
  latencyMs: number;
  fetchedAt: Date;
}

interface ApiUnit {
  id?: number | string;
  name?: string;
  stations?: ApiStation[];
}

interface ApiSensor {
  id?: number | string;
  name?: string | null;
}

interface ApiConfig {
  id?: number | string;
  name?: string | null;
  unit?: string | null;
  measurement_unit?: string | null;
  measurementUnit?: string | null;
  read_name?: string | null;
  config_read_name?: string | null;
  configReadName?: string | null;
  function?: number | string | null;
  function_code?: number | string | null;
  functionCode?: number | string | null;
  data_address?: number | string | null;
  dataAddress?: number | string | null;
  address?: number | string | null;
  register_address?: number | string | null;
  registerAddress?: number | string | null;
  len?: number | string | null;
  length?: number | string | null;
  data_len?: number | string | null;
  dataLen?: number | string | null;
  register_length?: number | string | null;
  registerLength?: number | string | null;
  transformer?: unknown;
  transform?: unknown;
  data_type?: unknown;
  dataType?: unknown;
  gateway_id?: number | string | null;
  gatewayId?: number | string | null;
  end_device_id?: number | string | null;
  endDeviceId?: number | string | null;
  device_id?: number | string | null;
  deviceId?: number | string | null;
  sensor?: ApiSensor | null;
  device?: ApiSensor | null;
  end_device?: ApiSensor | null;
  source_sensor?: ApiSensor | null;
}

interface ApiStation {
  id?: number | string;
  name?: string | null;
  devices?: ApiSensor[];
  sensors?: ApiSensor[];
}

interface DashboardConfig {
  id: number;
  name: string;
  measurementUnit: string;
  sensorId?: number;
  sensorName?: string;
  targetKey?: string;
  gatewayId?: number;
  functionCode?: number;
  dataAddress?: number;
  dataLength?: number;
  transformer?: string;
}

interface ConfigReading {
  value: unknown;
  updatedAt: string;
  status?: string;
}

interface UnitTopology {
  id: string;
  name: string;
  configs: DashboardConfig[];
  sensorCount: number;
  stationNames: string[];
}

interface PsonTarget {
  configId: number | null;
  gatewayId: number | null;
  name: string;
  functionCode: number | null;
  dataAddress: number | null;
  dataLength: number | null;
  transformer: string;
  unitKeys: string[];
}

interface TargetConfig extends PsonTarget {
  targetKey: string;
  defaultUnit: string;
}

interface ApiChipHealth {
  id?: number | string;
  name?: string;
  last_healthy?: {
    signal?: number | string | null;
    modbus_fail?: number | string | null;
    modbus_total?: number | string | null;
    created_at?: string | null;
  } | null;
}

interface ApiUnitHealth {
  id?: number | string;
  name?: string;
  chips?: ApiChipHealth[];
}

interface ApiEventAlert {
  id?: number | string;
  sensor_name?: string;
  station_name?: string;
  content_code?: string;
  created_at?: string;
  params?: Record<string, unknown>;
}

class EohApiError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, options: { status?: number; code?: string } = {}) {
    super(message);
    this.name = 'EohApiError';
    this.status = options.status;
    this.code = options.code;
  }
}

let topologyCache: { loadedAt: number; topology: UnitTopology[] } | null = null;

export const EOH_POLL_INTERVAL_MS = readPollInterval();

export function describeEohError(error: unknown): string {
  if (error instanceof EohApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unable to read data from the EoH API.';
}

export async function fetchDashboardSnapshot(
  previous: WorkshopData[],
  signal?: AbortSignal,
): Promise<DashboardSnapshot> {
  const startedAt = Date.now();
  const topology = await getTopology(signal);

  const [healthPayload, alertPayload] = await Promise.all([
    apiGet<unknown>('/property_manager/iot_dashboard/healthy_v2/unit_health/', signal),
    apiGet<unknown>('/property_manager/iot_dashboard/dashboard_v2/list_event_alert/', signal),
  ]);

  const allConfigs = uniqueConfigs(topology.flatMap((unit) => unit.configs));
  const values = allConfigs.length > 0
    ? await fetchConfigValues(allConfigs.map((config) => config.id), signal)
    : new Map<number, ConfigReading>();

  const healthByUnit = indexHealthByUnit(healthPayload);
  const fetchedAt = new Date();
  const previousById = new Map(previous.map((workshop) => [workshop.id, workshop]));

  return {
    workshops: topology.map((unit) => buildWorkshop(unit, values, healthByUnit, previousById.get(unit.id), fetchedAt)),
    alerts: normalizeAlerts(alertPayload),
    latencyMs: Date.now() - startedAt,
    fetchedAt,
  };
}

async function getTopology(signal?: AbortSignal): Promise<UnitTopology[]> {
  const now = Date.now();

  if (topologyCache && now - topologyCache.loadedAt < TOPOLOGY_TTL_MS) {
    return topologyCache.topology;
  }

  const unitsPayload = await apiGet<unknown>('/property_manager/iot_dashboard/units_v2/', signal);
  const units = normalizeArray<ApiUnit>(unitsPayload)
    .map((unit, index) => ({
      id: String(readNumericId(unit.id) ?? index + 1),
      name: safeText(unit.name, `Unit ${index + 1}`),
      rawId: readNumericId(unit.id),
      stations: extractStations(unit),
    }));

  const topology = await Promise.all(units.map(async (unit) => {
    const { configs, sensorCount } = unit.rawId == null
      ? { configs: [] as DashboardConfig[], sensorCount: 0 }
      : await fetchUnitConfigs(unit.rawId, unit.name, unit.stations, signal);

    return {
      id: unit.id,
      name: unit.name,
      configs,
      sensorCount,
      stationNames: Array.from(new Set(
        unit.stations
          .map((station) => safeText(station.name, ''))
          .filter(Boolean),
      )),
    };
  }));

  topologyCache = { loadedAt: now, topology };
  return topology;
}

async function fetchUnitConfigs(unitId: number, unitName: string, stationsFromUnit: ApiStation[], signal?: AbortSignal) {
  const fallbackSensorPayload = stationsFromUnit.length
    ? null
    : await apiGet<unknown>(`/property_manager/iot_dashboard/units_v2/${unitId}/device_sensor/`, signal);

  const stations = stationsFromUnit.length ? stationsFromUnit : extractStations(fallbackSensorPayload);
  const sensors = uniqueSensors(stations.flatMap((station) => [
    ...(Array.isArray(station.devices) ? station.devices : []),
    ...(Array.isArray(station.sensors) ? station.sensors : []),
  ]));

  const configGroups = await Promise.all(stations.map(async (station) => {
    const stationId = readNumericId(station.id);

    if (stationId == null) {
      return [];
    }

    const payload = await apiGet<unknown>(
      '/property_manager/iot_dashboard/configs_v2/',
      signal,
      { end_device__station: String(stationId) },
    );

    return normalizeArray<ApiConfig>(payload)
      .map((config) => normalizeConfig(config, safeText(station.name, 'Station')))
      .filter((config): config is DashboardConfig => config != null);
  }));

  const stationConfigs = uniqueConfigs(configGroups.flat());
  const psonConfigs = await fetchTargetedConfigs(unitName, stations, stationConfigs, signal);

  return {
    configs: uniqueConfigs([...stationConfigs, ...psonConfigs]),
    sensorCount: sensors.length,
  };
}

async function fetchConfigValues(configIds: number[], signal?: AbortSignal) {
  const chunks = chunk(configIds, 150);
  const valueMap = new Map<number, ConfigReading>();

  await Promise.all(chunks.map(async (ids) => {
    const payload = await apiPost<unknown>(
      '/property_manager/iot_dashboard/watch_configs_v2/',
      { configs: ids, is_raw: false },
      signal,
    );

    mergeValuePayload(valueMap, payload, ids);
  }));

  return valueMap;
}

function buildWorkshop(
  unit: UnitTopology,
  values: Map<number, ConfigReading>,
  healthByUnit: Map<string, ApiUnitHealth>,
  previous: WorkshopData | undefined,
  fetchedAt: Date,
): WorkshopData {
  const power: PowerData = {
    voltage: readMetric(unit.configs, values, 'voltage'),
    current: readMetric(unit.configs, values, 'current'),
    activePower: readMetric(unit.configs, values, 'activePower'),
    totalEnergy: readMetric(unit.configs, values, 'totalEnergy'),
    frequency: readMetric(unit.configs, values, 'frequency'),
    pf: readMetric(unit.configs, values, 'pf'),
  };

  const water: WaterData = {
    flowRate: readMetric(unit.configs, values, 'flowRate'),
    totalVolume: readMetric(unit.configs, values, 'totalVolume'),
    pressure: readMetric(unit.configs, values, 'pressure'),
  };
  const liveValues = buildLiveValues(unit.configs, values);
  const trend = pickTrendValue(power, liveValues);
  const matchHints = Array.from(new Set([
    unit.name,
    ...unit.stationNames,
    ...liveValues.map((value) => safeText(value.sourceName, '')),
    ...liveValues.map((value) => safeText(value.name, '')),
  ].filter(Boolean)));

  return {
    id: unit.id,
    name: unit.name,
    status: deriveStatus(healthByUnit.get(unit.id), unit.configs, values),
    power,
    water,
    history: appendHistory(previous?.history ?? [], trend.value, fetchedAt),
    liveValues,
    trendLabel: trend.label,
    trendUnit: trend.unit,
    configCount: unit.configs.length,
    sensorCount: unit.sensorCount,
    chipCount: healthByUnit.get(unit.id)?.chips?.length ?? 0,
    sourceUpdatedAt: fetchedAt.toISOString(),
    matchHints,
  };
}

function buildLiveValues(configs: DashboardConfig[], values: Map<number, ConfigReading>): LiveConfigValue[] {
  return configs
    .map((config) => {
      const reading = values.get(config.id);

      return {
        id: config.id,
        name: config.name,
        unit: config.measurementUnit,
        value: toNumber(reading?.value),
        sourceName: safeText(config.sensorName, ''),
        updatedAt: safeText(reading?.updatedAt, ''),
        targetKey: config.targetKey,
        gatewayId: config.gatewayId,
        functionCode: config.functionCode,
        dataAddress: config.dataAddress,
        dataLength: config.dataLength,
        transformer: config.transformer,
      };
    })
    .filter((item) => item.value != null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function pickTrendValue(power: PowerData, liveValues: LiveConfigValue[]) {
  const pconValue = liveValues.find((item) => item.targetKey === PCON_TARGET_KEY && item.value != null);

  if (pconValue) {
    return {
      label: 'P-CON Trend',
      unit: pconValue.unit || 'kW',
      value: pconValue.value,
    };
  }

  const preferred = [
    { label: 'Active Load Trend', unit: 'kW', value: power.activePower },
    { label: 'Voltage Trend', unit: 'V', value: power.voltage },
    { label: 'Current Trend', unit: 'A', value: power.current },
    { label: 'Energy Trend', unit: 'kWh', value: power.totalEnergy },
    { label: 'Frequency Trend', unit: 'Hz', value: power.frequency },
  ].find((item) => item.value != null);

  if (preferred) {
    return preferred;
  }

  const firstLiveValue = liveValues.find((item) => item.value != null);

  return {
    label: firstLiveValue ? `${firstLiveValue.name} Trend` : 'Live Trend',
    unit: firstLiveValue?.unit ?? '',
    value: firstLiveValue?.value ?? null,
  };
}

async function apiGet<T>(path: string, signal?: AbortSignal, query?: Record<string, string>) {
  return apiFetch<T>(path, { method: 'GET', signal, query });
}

async function apiPost<T>(path: string, body: unknown, signal?: AbortSignal) {
  return apiFetch<T>(path, { method: 'POST', body, signal });
}

async function apiFetch<T>(
  path: string,
  options: { method: string; body?: unknown; signal?: AbortSignal; query?: Record<string, string> },
) {
  const baseUrl = readApiBaseUrl();
  const url = buildApiUrl(path, options.query);
  const headers = new Headers({
    Accept: 'application/json',
  });

  if (shouldUseBrowserToken(baseUrl)) {
    headers.set('Authorization', formatAuthorization(readApiToken()));
  }

  const init: RequestInit = {
    method: options.method,
    headers,
    signal: options.signal,
  };

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, init);

  if (!response.ok) {
    throw new EohApiError(await readErrorMessage(response), {
      status: response.status,
      code: response.status === 401 ? 'unauthorized' : undefined,
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function buildApiUrl(path: string, query?: Record<string, string>) {
  const base = readApiBaseUrl().replace(/\/+$/, '');

  if (shouldUseProxyQueryUrl(base)) {
    const url = new URL(base, window.location.origin);
    url.searchParams.set('path', path.replace(/^\/+/, ''));

    Object.entries(query ?? {}).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value);
      }
    });

    return url.toString();
  }

  const url = new URL(
    `${base}${path.startsWith('/') ? path : `/${path}`}`,
    window.location.origin,
  );

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

function shouldUseProxyQueryUrl(baseUrl: string) {
  return import.meta.env.PROD && baseUrl === PRODUCTION_PROXY_BASE_URL;
}

function readApiBaseUrl() {
  const configuredBaseUrl = trimEnv(import.meta.env.VITE_EOH_API_BASE_URL);

  if (import.meta.env.PROD) {
    return configuredBaseUrl.startsWith('/') ? configuredBaseUrl : PRODUCTION_PROXY_BASE_URL;
  }

  return configuredBaseUrl || DEFAULT_API_BASE_URL;
}

function shouldUseBrowserToken(baseUrl: string) {
  return import.meta.env.DEV && /^https?:\/\//i.test(baseUrl);
}

function readApiToken() {
  const token = import.meta.env.DEV ? trimEnv(import.meta.env.VITE_EOH_API_TOKEN) : '';

  if (!token) {
    throw new EohApiError('EoH API token is not configured. Set VITE_EOH_API_TOKEN before running the dashboard.', {
      code: 'missing_token',
    });
  }

  return token;
}

function readPollInterval() {
  const value = Number(trimEnv(import.meta.env.VITE_EOH_POLL_INTERVAL_MS));
  return Number.isFinite(value) && value >= 3000 ? value : DEFAULT_POLL_INTERVAL_MS;
}

function trimEnv(value: string | undefined) {
  return value?.trim().replace(/^['"]|['"]$/g, '') ?? '';
}

function formatAuthorization(token: string) {
  return /^(token|bearer)\s+/i.test(token) ? token : `Token ${token}`;
}

async function readErrorMessage(response: Response) {
  const fallback = `EoH API request failed with status ${response.status}.`;

  try {
    const payload = await response.json();
    const detail = readFirstString(payload, ['detail', 'message', 'error']);
    return detail || fallback;
  } catch {
    return fallback;
  }
}

function normalizeConfig(config: ApiConfig, fallbackSensorName: string): DashboardConfig | null {
  const id = readNumericId(config.id);

  if (id == null) {
    return null;
  }

  const sourceSensor = config.sensor
    ?? config.device
    ?? config.end_device
    ?? config.source_sensor;
  const record = config as Record<string, unknown>;

  return {
    id,
    name: safeText(readFirstDefined(record, ['name', 'read_name', 'config_read_name', 'configReadName']), `Config ${id}`),
    measurementUnit: safeText(readFirstDefined(record, ['unit', 'measurement_unit', 'measurementUnit']), ''),
    sensorId: readNumericId(sourceSensor?.id) ?? undefined,
    sensorName: safeText(sourceSensor?.name, fallbackSensorName),
    gatewayId: readNumericId(readFirstDefined(record, [
      'gateway_id',
      'gatewayId',
      'end_device_id',
      'endDeviceId',
      'device_id',
      'deviceId',
    ])) ?? readNumericId(sourceSensor?.id) ?? undefined,
    functionCode: readNumericId(readFirstDefined(record, ['function', 'function_code', 'functionCode'])),
    dataAddress: readNumericId(readFirstDefined(record, [
      'data_address',
      'dataAddress',
      'address',
      'register_address',
      'registerAddress',
    ])),
    dataLength: readNumericId(readFirstDefined(record, [
      'len',
      'length',
      'data_len',
      'dataLen',
      'register_length',
      'registerLength',
    ])),
    transformer: readTransformer(record),
  };
}

async function fetchTargetedConfigs(
  unitName: string,
  stations: ApiStation[],
  stationConfigs: DashboardConfig[],
  signal?: AbortSignal,
) {
  const targets = readTargetConfigs();

  if (!targets.some((target) => isTargetCandidateUnit(unitName, stations, target))) {
    return [];
  }

  const chipConfigsByGateway = new Map<number, DashboardConfig[]>();
  const targetedConfigs: DashboardConfig[] = [];

  for (const target of targets) {
    if (!isTargetCandidateUnit(unitName, stations, target)) {
      continue;
    }

    const existingConfig = stationConfigs.find((config) => config.id === target.configId);
    const chipConfigs = target.gatewayId == null
      ? []
      : await getChipConfigs(target.gatewayId, chipConfigsByGateway, signal);
    const chipConfig = !existingConfig
      ? chipConfigs.find((config) => config.id === target.configId)
      : undefined;

    if (target.configId != null) {
      targetedConfigs.push(markTargetConfig(existingConfig ?? chipConfig ?? {
        id: target.configId,
        name: target.name,
        measurementUnit: target.defaultUnit,
        sensorName: target.gatewayId == null ? target.name : `Gateway ${target.gatewayId}`,
        gatewayId: target.gatewayId ?? undefined,
        functionCode: target.functionCode ?? undefined,
        dataAddress: target.dataAddress ?? undefined,
        dataLength: target.dataLength ?? undefined,
        transformer: target.transformer,
      }, target.targetKey));
      continue;
    }

    const exactStationMatches = stationConfigs
      .filter((config) => matchesTargetConfig(config, target))
      .map((config) => markTargetConfig(config, target.targetKey));

    if (exactStationMatches.length) {
      targetedConfigs.push(...exactStationMatches);
      continue;
    }

    targetedConfigs.push(
      ...chipConfigs
        .filter((config) => matchesTargetConfig(config, target))
        .map((config) => markTargetConfig(config, target.targetKey)),
    );
  }

  return targetedConfigs;
}

async function getChipConfigs(
  chipId: number,
  cache: Map<number, DashboardConfig[]>,
  signal?: AbortSignal,
) {
  const cached = cache.get(chipId);

  if (cached) {
    return cached;
  }

  const configs = await fetchChipConfigs(chipId, signal);
  cache.set(chipId, configs);
  return configs;
}

async function fetchChipConfigs(chipId: number, signal?: AbortSignal) {
  try {
    const payload = await apiGet<unknown>('/chip_manager/configs/', signal, { chip: String(chipId) });
    return normalizeArray<ApiConfig>(payload)
      .map((config) => normalizeConfig(config, `Gateway ${chipId}`))
      .filter((config): config is DashboardConfig => config != null)
      .map((config) => ({ ...config, gatewayId: config.gatewayId ?? chipId }));
  } catch (error) {
    if (error instanceof EohApiError && [400, 404, 405].includes(error.status ?? 0)) {
      return [];
    }

    throw error;
  }
}

function matchesTargetConfig(config: DashboardConfig, target: TargetConfig) {
  if (target.configId != null) {
    return config.id === target.configId;
  }

  const nameMatches = normalizeKey(config.name).includes(normalizeKey(target.name));

  if (!nameMatches) {
    return false;
  }

  const gatewayMatches = target.gatewayId == null
    || config.gatewayId == null
    || config.gatewayId === target.gatewayId;
  const functionMatches = target.functionCode == null
    || config.functionCode == null
    || config.functionCode === target.functionCode;
  const addressMatches = target.dataAddress == null
    || config.dataAddress == null
    || config.dataAddress === target.dataAddress;
  const lengthMatches = target.dataLength == null
    || config.dataLength == null
    || config.dataLength === target.dataLength;
  const transformerMatches = !target.transformer
    || !config.transformer
    || normalizeKey(config.transformer).includes(normalizeKey(target.transformer));

  const hasStrongIdentity = config.gatewayId != null
    || config.functionCode != null
    || config.dataAddress != null
    || config.dataLength != null
    || Boolean(config.transformer);

  return hasStrongIdentity
    && gatewayMatches
    && functionMatches
    && addressMatches
    && lengthMatches
    && transformerMatches;
}

function markTargetConfig(config: DashboardConfig, targetKey: string): DashboardConfig {
  return {
    ...config,
    targetKey,
  };
}

function isTargetCandidateUnit(unitName: string, stations: ApiStation[], target: TargetConfig) {
  const gatewayId = target.gatewayId;

  if (gatewayId != null && stations.some((station) => stationHasDevice(station, gatewayId))) {
    return true;
  }

  const locationText = normalizeKey([
    unitName,
    ...stations.map((station) => safeText(station.name, '')),
  ].join(' '));

  return target.unitKeys.some((key) => locationText.includes(normalizeKey(key)));
}

function stationHasDevice(station: ApiStation, deviceId: number) {
  return [
    ...(Array.isArray(station.devices) ? station.devices : []),
    ...(Array.isArray(station.sensors) ? station.sensors : []),
  ].some((device) => readNumericId(device.id) === deviceId);
}

function readTargetConfigs(): TargetConfig[] {
  const unitKeys = (trimEnv(import.meta.env.VITE_EOH_PSON_UNIT_KEYS) || DEFAULT_PSON_UNIT_KEYS)
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);

  return [{
    configId: readNumericId(trimEnv(import.meta.env.VITE_EOH_PSON_CONFIG_ID) || DEFAULT_PSON_CONFIG_ID),
    gatewayId: readNumericId(trimEnv(import.meta.env.VITE_EOH_PSON_GATEWAY_ID) || DEFAULT_PSON_GATEWAY_ID),
    name: trimEnv(import.meta.env.VITE_EOH_PSON_NAME) || DEFAULT_PSON_NAME,
    functionCode: readNumericId(trimEnv(import.meta.env.VITE_EOH_PSON_FUNCTION_CODE) || DEFAULT_PSON_FUNCTION_CODE),
    dataAddress: readNumericId(trimEnv(import.meta.env.VITE_EOH_PSON_DATA_ADDRESS) || DEFAULT_PSON_DATA_ADDRESS),
    dataLength: readNumericId(trimEnv(import.meta.env.VITE_EOH_PSON_DATA_LENGTH) || DEFAULT_PSON_DATA_LENGTH),
    transformer: trimEnv(import.meta.env.VITE_EOH_PSON_TRANSFORMER) || DEFAULT_PSON_TRANSFORMER,
    unitKeys,
    targetKey: PSON_TARGET_KEY,
    defaultUnit: 'kWh',
  }, {
    configId: readNumericId(trimEnv(import.meta.env.VITE_EOH_PCON_CONFIG_ID) || DEFAULT_PCON_CONFIG_ID),
    gatewayId: readNumericId(trimEnv(import.meta.env.VITE_EOH_PCON_GATEWAY_ID) || DEFAULT_PSON_GATEWAY_ID),
    name: trimEnv(import.meta.env.VITE_EOH_PCON_NAME) || DEFAULT_PCON_NAME,
    functionCode: null,
    dataAddress: null,
    dataLength: null,
    transformer: '',
    unitKeys,
    targetKey: PCON_TARGET_KEY,
    defaultUnit: 'kW',
  }];
}

function readTransformer(source: Record<string, unknown>) {
  const rawValue = readFirstDefined(source, ['transformer', 'transform', 'data_type', 'dataType']);

  if (typeof rawValue === 'string') {
    return rawValue.trim() || undefined;
  }

  if (isRecord(rawValue)) {
    return safeText(readFirstDefined(rawValue, ['name', 'label', 'title', 'type']), '') || undefined;
  }

  return undefined;
}

function extractStations(payload: unknown): ApiStation[] {
  const stations: ApiStation[] = [];

  function visit(node: unknown) {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    if (!isRecord(node)) {
      return;
    }

    if (Array.isArray(node.stations)) {
      node.stations.forEach(visit);
      return;
    }

    if (readNumericId(node.id) != null && (Array.isArray(node.devices) || Array.isArray(node.sensors))) {
      stations.push(node as ApiStation);
    }
  }

  visit(payload);
  return stations;
}

function extractSensors(payload: unknown): ApiSensor[] {
  const sensors: ApiSensor[] = [];

  function visit(node: unknown) {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    if (!isRecord(node)) {
      return;
    }

    if (Array.isArray(node.devices)) {
      node.devices.forEach(visit);
      return;
    }

    if (readNumericId(node.id) != null && ('icon' in node || 'icon_kit' in node || 'name' in node)) {
      sensors.push(node as ApiSensor);
      return;
    }

    ['results', 'sensors', 'children'].forEach((key) => visit(node[key]));
  }

  visit(payload);
  return sensors;
}

function uniqueSensors(sensors: ApiSensor[]) {
  const seen = new Set<number>();
  const output: ApiSensor[] = [];

  sensors.forEach((sensor) => {
    const id = readNumericId(sensor.id);

    if (id == null || seen.has(id)) {
      return;
    }

    seen.add(id);
    output.push(sensor);
  });

  return output;
}

function uniqueConfigs(configs: DashboardConfig[]) {
  const seen = new Set<number>();
  const output: DashboardConfig[] = [];

  configs.forEach((config) => {
    if (seen.has(config.id)) {
      return;
    }

    seen.add(config.id);
    output.push(config);
  });

  return output;
}

function normalizeArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (isRecord(payload) && Array.isArray(payload.results)) {
    return payload.results as T[];
  }

  return [];
}

function indexHealthByUnit(payload: unknown) {
  const healthMap = new Map<string, ApiUnitHealth>();

  normalizeArray<ApiUnitHealth>(payload).forEach((unitHealth, index) => {
    const id = readNumericId(unitHealth.id);
    healthMap.set(String(id ?? index + 1), unitHealth);
  });

  return healthMap;
}

function normalizeAlerts(payload: unknown): DashboardAlert[] {
  return normalizeArray<ApiEventAlert>(payload).slice(0, 5).map((alert, index) => {
    const params = alert.params && Object.keys(alert.params).length > 0
      ? ` ${JSON.stringify(alert.params)}`
      : '';

    return {
      id: String(alert.id ?? index),
      title: humanizeCode(alert.content_code) + params,
      location: [alert.station_name, alert.sensor_name].filter(Boolean).join(' - ') || 'EoH API',
      createdAt: safeText(alert.created_at, ''),
      tone: 'warning',
    };
  });
}

function mergeValuePayload(target: Map<number, ConfigReading>, payload: unknown, fallbackIds: number[]) {
  if (Array.isArray(payload)) {
    payload.forEach((item, index) => mergeValueItem(target, item, fallbackIds[index]));
    return;
  }

  if (!isRecord(payload)) {
    if (fallbackIds.length === 1) {
      target.set(fallbackIds[0], readConfigReading(payload));
    }

    return;
  }

  const arrayPayload = ['results', 'configs', 'data', 'values']
    .map((key) => payload[key])
    .find(Array.isArray);

  if (Array.isArray(arrayPayload)) {
    arrayPayload.forEach((item, index) => mergeValueItem(target, item, fallbackIds[index]));
    return;
  }

  const objectPayload = ['data', 'values']
    .map((key) => payload[key])
    .find((value) => isRecord(value));

  if (isRecord(objectPayload)) {
    mergeValuePayload(target, objectPayload, fallbackIds);
    return;
  }

  Object.entries(payload).forEach(([key, value]) => {
    const idFromKey = readNumericId(key);

    if (idFromKey != null) {
      target.set(idFromKey, readConfigReading(value));
      return;
    }

    mergeValueItem(target, value);
  });
}

function mergeValueItem(target: Map<number, ConfigReading>, item: unknown, fallbackId?: number) {
  if (!isRecord(item)) {
    if (fallbackId != null) {
      target.set(fallbackId, readConfigReading(item));
    }

    return;
  }

  const id = readNumericId(item.id)
    ?? readNumericId(item.config)
    ?? readNumericId(item.config_id)
    ?? readNumericId(item.configId)
    ?? (isRecord(item.config) ? readNumericId(item.config.id) : null)
    ?? fallbackId;

  if (id == null) {
    return;
  }

  target.set(id, readConfigReading(item));
}

function readConfigReading(value: unknown): ConfigReading {
  if (!isRecord(value)) {
    return { value, updatedAt: '' };
  }

  return {
    value: readRawValue(value),
    updatedAt: safeText(
      readFirstDefined(value, ['last_updated', 'lastUpdated', 'updated_at', 'updatedAt', 'created_at']),
      '',
    ),
    status: safeText(readFirstDefined(value, ['status', 'status_of_value']), ''),
  };
}

function readRawValue(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const directValue = readFirstDefined(value, [
    'value',
    'current_value',
    'currentValue',
    'current_value_only',
    'last_value',
    'raw_value',
  ]);

  if (directValue !== undefined) {
    return directValue;
  }

  const numericEntry = Object.values(value).find((entry) => toNumber(entry) != null);
  return numericEntry ?? value;
}

type MetricKey = keyof PowerData | keyof WaterData;

const METRIC_RULES: Record<MetricKey, { labels: string[]; units: string[]; negative?: string[] }> = {
  voltage: {
    labels: ['voltage', 'volt', 'dien ap', 'u pha'],
    units: ['v', 'volt', 'kv'],
  },
  current: {
    labels: ['current', 'amp', 'dong dien', 'i pha'],
    units: ['a', 'amp', 'ma'],
  },
  activePower: {
    labels: ['active power', 'power', 'cong suat', 'kw', 'watt'],
    units: ['kw', 'w', 'mw'],
    negative: ['energy', 'kwh', 'wh', 'pf', 'power factor'],
  },
  totalEnergy: {
    labels: ['energy', 'dien nang', 'kwh', 'consumption', 'electricity'],
    units: ['kwh', 'wh', 'mwh'],
    negative: ['power factor', 'pf'],
  },
  frequency: {
    labels: ['frequency', 'freq', 'tan so'],
    units: ['hz'],
  },
  pf: {
    labels: ['power factor', 'pf', 'cos'],
    units: ['pf'],
  },
  flowRate: {
    labels: ['flow', 'flow rate', 'luu luong'],
    units: ['l/s', 'lpm', 'm3/h', 'm3h'],
    negative: ['pressure'],
  },
  totalVolume: {
    labels: ['volume', 'water', 'nuoc', 'totalizer', 'total volume'],
    units: ['m3', 'm3/h'],
    negative: ['flow', 'pressure', 'kwh', 'kw'],
  },
  pressure: {
    labels: ['pressure', 'ap suat'],
    units: ['bar', 'kpa', 'mpa'],
  },
};

function readMetric(configs: DashboardConfig[], values: Map<number, ConfigReading>, metric: MetricKey) {
  const matches = configs
    .map((config) => ({
      config,
      score: scoreConfig(config, metric),
      value: toNumber(values.get(config.id)?.value),
    }))
    .filter((candidate) => candidate.score > 0 && candidate.value != null)
    .sort((a, b) => b.score - a.score);

  const bestMatch = matches[0];

  if (!bestMatch || bestMatch.value == null) {
    return null;
  }

  return normalizeMetricValue(metric, bestMatch.value, bestMatch.config.measurementUnit);
}

function scoreConfig(config: DashboardConfig, metric: MetricKey) {
  const rule = METRIC_RULES[metric];
  const text = normalizeText(`${config.name} ${config.sensorName ?? ''} ${config.measurementUnit}`);
  const unit = normalizeUnit(config.measurementUnit);
  let score = 0;

  if (rule.units.some((candidate) => unit === normalizeUnit(candidate))) {
    score += 10;
  }

  rule.labels.forEach((label) => {
    if (text.includes(normalizeText(label))) {
      score += 4;
    }
  });

  rule.negative?.forEach((label) => {
    if (text.includes(normalizeText(label))) {
      score -= 5;
    }
  });

  return score;
}

function normalizeMetricValue(metric: MetricKey, value: number, rawUnit: string) {
  const unit = normalizeUnit(rawUnit);

  if (metric === 'activePower') {
    if (unit === 'w') return value / 1000;
    if (unit === 'mw') return value * 1000;
    if (!unit && Math.abs(value) > 1000) return value / 1000;
  }

  if (metric === 'totalEnergy') {
    if (unit === 'wh') return value / 1000;
    if (unit === 'mwh') return value * 1000;
  }

  if (metric === 'flowRate') {
    if (unit === 'm3/h' || unit === 'm3h') return value / 3.6;
    if (unit === 'lpm') return value / 60;
  }

  if (metric === 'pressure') {
    if (unit === 'kpa') return value / 100;
    if (unit === 'mpa') return value * 10;
  }

  if (metric === 'voltage' && unit === 'kv') {
    return value * 1000;
  }

  if (metric === 'current' && unit === 'ma') {
    return value / 1000;
  }

  return value;
}

function deriveStatus(unitHealth: ApiUnitHealth | undefined, configs: DashboardConfig[], values: Map<number, ConfigReading>) {
  const hasLiveValue = configs.some((config) => toNumber(values.get(config.id)?.value) != null);
  const chips = unitHealth?.chips ?? [];

  if (!chips.length) {
    return hasLiveValue ? 'online' : 'warning';
  }

  const newestHealthy = chips
    .map((chip) => Date.parse(safeText(chip.last_healthy?.created_at, '')))
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];

  if (!newestHealthy) {
    return hasLiveValue ? 'warning' : 'offline';
  }

  const minutesSinceHealthy = (Date.now() - newestHealthy) / 60000;

  if (minutesSinceHealthy > 30) {
    return 'offline';
  }

  const hasWeakSignal = chips.some((chip) => {
    const signal = toNumber(chip.last_healthy?.signal);
    return signal != null && signal <= 0;
  });

  const hasHighModbusFailRate = chips.some((chip) => {
    const fail = toNumber(chip.last_healthy?.modbus_fail);
    const total = toNumber(chip.last_healthy?.modbus_total);
    return fail != null && total != null && total > 0 && fail / total > 0.2;
  });

  return hasWeakSignal || hasHighModbusFailRate ? 'warning' : 'online';
}

function appendHistory(previous: { time: string; power: MetricValue }[], activePower: MetricValue, fetchedAt: Date) {
  const nextHistory = [...previous];

  if (activePower != null) {
    nextHistory.push({
      time: fetchedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      power: activePower,
    });
  }

  return nextHistory.slice(-MAX_HISTORY_POINTS);
}

function chunk<T>(items: T[], size: number) {
  const output: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }

  return output;
}

function readNumericId(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const normalized = /^\d+,\d+$/.test(trimmed)
      ? trimmed.replace(',', '.')
      : trimmed.replace(/,/g, '');
    const match = normalized.match(/-?\d+(?:\.\d+)?/);

    if (!match) {
      return null;
    }

    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function safeText(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function humanizeCode(value: unknown) {
  const text = safeText(value, 'Event alert');
  return text
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00b3/g, '3')
    .toLowerCase();
}

function normalizeKey(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '');
}

function normalizeUnit(value: string) {
  return normalizeText(value).replace(/\s+/g, '').replace('litre', 'l').replace('liter', 'l');
}

function readFirstDefined(source: Record<string, unknown>, keys: string[]) {
  return keys.map((key) => source[key]).find((value) => value !== undefined && value !== null);
}

function readFirstString(source: unknown, keys: string[]) {
  if (!isRecord(source)) {
    return '';
  }

  const value = readFirstDefined(source, keys);
  return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
