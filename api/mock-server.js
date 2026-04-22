/**
 * Mock EoH API Server for local development
 * Simulates PAINT_SHOP_01, SPACE_SHOP_02, OFFICE_MAIN_01 with live-like data
 */
import express from 'express';

const app = express();
const PORT = 3002;

// Simulate live values that update each call
function generateWorkshopData(id, name, baseLoad) {
  const variation = Math.sin(Date.now() / 5000) * 10 + Math.random() * 5;
  return {
    id,
    name,
    status: 'online',
    power: {
      voltage: 380 + Math.random() * 2,
      current: 50 + variation,
      activePower: baseLoad + variation,
      totalEnergy: 12450.5 + Math.random() * 100,
      frequency: 50 + Math.random() * 0.1,
      pf: 0.95 + Math.random() * 0.04,
    },
    water: {
      flowRate: 15 + Math.random() * 5,
      totalVolume: 850.3 + Math.random() * 50,
      pressure: 2.5 + Math.random() * 0.3,
    },
    configCount: 8,
    sensorCount: 12,
    chipCount: 2,
  };
}

// Mock endpoints
app.get('/property_manager/iot_dashboard/units_v2/', (req, res) => {
  res.json({
    results: [
      {
        id: 1,
        name: 'PAINT_SHOP_01',
        stations: [{ id: 101, name: 'Paint Station 1', devices: [] }],
      },
      {
        id: 2,
        name: 'SPACE_SHOP_02',
        stations: [{ id: 202, name: 'Space Station 1', devices: [] }],
      },
      {
        id: 3,
        name: 'OFFICE_MAIN_01',
        stations: [{ id: 303, name: 'Office Station 1', devices: [] }],
      },
    ],
  });
});

app.get('/property_manager/iot_dashboard/units_v2/:unitId/device_sensor/', (req, res) => {
  res.json({
    results: [
      { id: 1001, name: 'Meter 1', icon: 'bolt' },
      { id: 1002, name: 'Meter 2', icon: 'droplet' },
    ],
  });
});

app.get('/property_manager/iot_dashboard/configs_v2/', (req, res) => {
  res.json({
    results: [
      { id: 10001, name: 'Voltage', unit: 'V' },
      { id: 10002, name: 'Current', unit: 'A' },
      { id: 10003, name: 'Active Power', unit: 'kW' },
      { id: 10004, name: 'Total Energy', unit: 'kWh' },
      { id: 10005, name: 'Frequency', unit: 'Hz' },
      { id: 10006, name: 'Power Factor', unit: 'pf' },
      { id: 10007, name: 'Flow Rate', unit: 'L/s' },
      { id: 10008, name: 'Total Volume', unit: 'm3' },
      { id: 10009, name: 'Pressure', unit: 'Bar' },
{ id: 10010, name: 'P-SON Total cumulative', unit: 'kWh', sensorName: 'P-SON' },
      { id: 169059, name: 'P-CON', unit: 'kW', sensorName: 'P-CON Gateway' },
    ],
  });
});

app.post('/property_manager/iot_dashboard/watch_configs_v2/', (req, res) => {
  // Mock config readings
  const readings = {
    10001: { value: 380 + Math.random() * 2, updatedAt: new Date().toISOString() },
    10002: { value: 50 + Math.random() * 10, updatedAt: new Date().toISOString() },
    10003: { value: 120 + Math.random() * 30, updatedAt: new Date().toISOString() },
    10004: { value: 12450.5 + Math.random() * 100, updatedAt: new Date().toISOString() },
    10005: { value: 50 + Math.random() * 0.1, updatedAt: new Date().toISOString() },
    10006: { value: 0.95 + Math.random() * 0.04, updatedAt: new Date().toISOString() },
    10007: { value: 15 + Math.random() * 5, updatedAt: new Date().toISOString() },
    10008: { value: 850.3 + Math.random() * 50, updatedAt: new Date().toISOString() },
    10009: { value: 2.5 + Math.random() * 0.3, updatedAt: new Date().toISOString() },
    10010: { value: 2450.75, updatedAt: new Date().toISOString() }, // P-SON cumulative
    169059: { value: 125 + Math.sin(Date.now() / 3000) * 15 + Math.random() * 5, updatedAt: new Date().toISOString() }, // P-CON realtime
  };

  res.json(readings);
});

app.get('/property_manager/iot_dashboard/healthy_v2/unit_health/', (req, res) => {
  res.json({
    results: [
      {
        id: 1,
        name: 'PAINT_SHOP_01',
        chips: [{ id: 100, name: 'Chip 1', last_healthy: { signal: 85, modbus_fail: 2, modbus_total: 100, created_at: new Date().toISOString() } }],
      },
      {
        id: 2,
        name: 'SPACE_SHOP_02',
        chips: [{ id: 200, name: 'Chip 1', last_healthy: { signal: 80, modbus_fail: 3, modbus_total: 100, created_at: new Date().toISOString() } }],
      },
      {
        id: 3,
        name: 'OFFICE_MAIN_01',
        chips: [{ id: 300, name: 'Chip 1', last_healthy: { signal: 90, modbus_fail: 1, modbus_total: 100, created_at: new Date().toISOString() } }],
      },
    ],
  });
});

app.get('/property_manager/iot_dashboard/dashboard_v2/list_event_alert/', (req, res) => {
  res.json({
    results: [
      {
        id: 'A1',
        sensor_name: 'Meter 1',
        station_name: 'PAINT_SHOP_01',
        content_code: 'LOAD_OVER_THRESHOLD',
        created_at: new Date(Date.now() - 60000).toISOString(),
        params: { threshold: 150, current: 165 },
      },
    ],
  });
});

app.listen(PORT, () => {
  console.log(`✅ Mock EoH API server running at http://localhost:${PORT}`);
});
