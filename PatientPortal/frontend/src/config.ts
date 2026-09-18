// Central API configuration for the Patient Portal.
// For local dev, defaults to the portal backend on port 8001.
// For deployment, set VITE_API_BASE in your .env.production file.
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8001';
