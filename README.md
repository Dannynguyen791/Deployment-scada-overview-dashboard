# EnergyHub SCADA - Industrial IoT Monitor

A professional-grade energy and resources monitoring dashboard designed for industrial applications.

## Features

- **Real-time Monitoring**: Live telemetry simulation for electricity (kWh) and water (m³) consumption.
- **SCADA Aesthetic**: High-contrast, technical UI optimized for industrial control rooms.
- **Workshop Segmentation**: Distinct monitoring for separate facility units (e.g., Paint Shop, Space Shop).
- **Responsive Design**: Fluid layout that scales from mobile devices to large display walls.
- **Built with Modern Tech**: React 19, Vite, Tailwind CSS, Recharts, and Framer Motion.

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
