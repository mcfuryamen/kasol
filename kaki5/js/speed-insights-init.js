// ==================== VERCEL SPEED INSIGHTS INIT ====================
// Initialize Vercel Speed Insights for performance monitoring
// Docs: https://vercel.com/docs/speed-insights/quickstart

import { injectSpeedInsights } from './speed-insights.mjs';

// Initialize Speed Insights
// This will track Core Web Vitals and send them to Vercel
if (typeof window !== 'undefined') {
  injectSpeedInsights({
    debug: false, // Set to true to enable debug logging in development
  });
}
