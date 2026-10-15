// Public configuration only. NEVER add Gemini, Turnstile or other secrets here.
// HTTPS URL for separately hosted Gemini backend (optional)
window.ADDRESSRAIL_API_URL = 'https://addressrail-ai.onrender.com';
// HTTPS URL for optional Cloudflare Worker/D1 visitor counter (free-tier setup required).
// Example: 'https://addressrail-visitors.YOUR_SUBDOMAIN.workers.dev'
window.ADDRESSRAIL_STATS_URL = 'https://addressrail-visitors.dhanapalkav.workers.dev';

// Public URL only; comments require Worker/D1 + Turnstile server-side setup.
window.ADDRESSRAIL_COMMENTS_URL = 'https://addressrail-visitors.dhanapalkav.workers.dev';
