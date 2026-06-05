// Vercel Speed Insights initialization
// This module loads and initializes Vercel Speed Insights for the application

import { injectSpeedInsights } from 'https://cdn.jsdelivr.net/npm/@vercel/speed-insights@2.0.0/dist/index.mjs';

// Initialize Speed Insights
// Only tracks data in production mode (when deployed to Vercel)
injectSpeedInsights({
    framework: 'vanilla',
    debug: false // Set to true for development debugging
});
