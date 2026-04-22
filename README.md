# EnergyHub SCADA - Industrial IoT Monitor

A professional-grade energy and resources monitoring dashboard designed for industrial applications.

## Features

- **Real-time Monitoring**: Live telemetry from the EoH API for electricity (kWh) and water (m3) consumption.
- **SCADA Aesthetic**: High-contrast, technical UI optimized for industrial control rooms.
- **Unit Segmentation**: Distinct monitoring for facility units returned by the EoH API.
- **Responsive Design**: Fluid layout that scales from mobile devices to large display walls.
- **Built with Modern Tech**: React 19, Vite, Tailwind CSS, Recharts, and Framer Motion.

## EoH API Configuration

Create a local `.env.local` file with:

```bash
VITE_EOH_API_BASE_URL="https://backend.eoh.io/api"
VITE_EOH_API_TOKEN="YOUR_EOH_TOKEN"
VITE_EOH_POLL_INTERVAL_MS="10000"
```

The local Vite app calls the backend directly and uses the `Authorization: Token <token>` header. You can paste either the raw token or a full `Token ...` value into `VITE_EOH_API_TOKEN`.

For Vercel production, configure these Environment Variables in the Vercel project:

```bash
EOH_API_BASE_URL="https://backend.eoh.io/api"
EOH_API_TOKEN="YOUR_EOH_TOKEN"
VITE_EOH_POLL_INTERVAL_MS="10000"
```

The production build calls the same-origin `/api/eoh/*` serverless proxy so browser CORS rules do not block `backend.eoh.io`, and the token stays server-side.
Do not set `VITE_EOH_API_TOKEN` in Vercel; if you need to point production at another backend, set `EOH_API_BASE_URL` instead of a public `VITE_` value.

## Deployment Instructions

### Deploy to Vercel/Netlify (Recommended)

1. Push this code to a GitHub repository.
2. Connect your repository to Vercel or Netlify.
3. The platform will automatically detect the Vite setup. Ensure the build command is `npm run build` and the output directory is `dist`.

### Deploy to GitHub Pages

If you are deploying to a GitHub Pages subpath (e.g., `username.github.io/repo-name/`), you must update `vite.config.ts`:

```typescript
export default defineConfig({
  base: '/your-repo-name/',
  // ... other config
})
```

## Local Development

```bash
npm install
npm run dev
```

## License

MIT
