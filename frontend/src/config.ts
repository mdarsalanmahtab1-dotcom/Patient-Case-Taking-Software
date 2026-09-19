/**
 * SwasthyaSync — Environment & API Configuration
 *
 * Dynamically resolves backend HTTP and WebSocket URLs based on current host/IP.
 * Works seamlessly on localhost, local network IPs (e.g. 103.x, 192.168.x), Vercel, and cloud deployments.
 */

const FALLBACK_PROD_BACKEND = 'https://swasthyasync-backend.onrender.com';

export function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return (import.meta.env.VITE_API_URL as string).replace(/\/+$/, '');
  }
  if (import.meta.env.VITE_BACKEND_HTTP_URL) {
    return (import.meta.env.VITE_BACKEND_HTTP_URL as string).replace(/\/+$/, '');
  }
  
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname || 'localhost';
    const protocol = window.location.protocol;

    // If deployed on Vercel or Render or any cloud host
    if (hostname.includes('vercel.app') || hostname.includes('onrender.com')) {
      return FALLBACK_PROD_BACKEND;
    }

    // Local development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//localhost:8000`;
    }

    // LAN / local network testing (e.g. phone accessing laptop)
    return `${protocol}//${hostname}:8000`;
  }

  return 'http://localhost:8000';
}

export function getWsUrl(): string {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL as string;
  }

  // If VITE_API_URL or VITE_BACKEND_HTTP_URL is provided, derive WS directly from it
  const explicitApi = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_HTTP_URL;
  if (explicitApi) {
    const wsProto = (explicitApi as string).startsWith('https:') ? 'wss:' : 'ws:';
    const cleanHost = (explicitApi as string).replace(/^https?:\/\//, '').replace(/\/+$/, '');
    return `${wsProto}//${cleanHost}/ws/session`;
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname || 'localhost';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    // Cloud deployment (Vercel, Render, etc.)
    if (hostname.includes('vercel.app') || hostname.includes('onrender.com')) {
      const prodWs = FALLBACK_PROD_BACKEND.replace('https://', 'wss://').replace('http://', 'ws://');
      return `${prodWs}/ws/session`;
    }

    // Local development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'ws://localhost:8000/ws/session';
    }

    // Local network testing
    return `${protocol}//${hostname}:8000/ws/session`;
  }

  return 'ws://localhost:8000/ws/session';
}

