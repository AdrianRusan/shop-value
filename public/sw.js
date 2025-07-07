// Service Worker for Shop Value PWA
// Version 1.0.0

const CACHE_NAME = 'shop-value-v1';
const OFFLINE_CACHE = 'shop-value-offline-v1';
const RUNTIME_CACHE = 'shop-value-runtime-v1';

// Assets to cache during install
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/products',
  '/pricing',
  '/offline.html',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // Add other critical assets
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
  /^\/api\/products\//,
  /^\/api\/alerts\//,
  /^\/api\/user\//,
  /^\/api\/subscription\//,
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      caches.open(OFFLINE_CACHE).then((cache) => {
        console.log('[SW] Setting up offline cache');
        return cache.add('/offline.html');
      })
    ]).then(() => {
      console.log('[SW] Service worker installed successfully');
      // Skip waiting to activate immediately
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== OFFLINE_CACHE && 
                cacheName !== RUNTIME_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Claim all clients
      self.clients.claim()
    ]).then(() => {
      console.log('[SW] Service worker activated successfully');
    })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip Chrome extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // Handle different request types with appropriate caching strategies
  if (url.pathname.startsWith('/api/')) {
    // API requests - network first with cache fallback
    event.respondWith(handleApiRequest(request));
  } else if (isStaticAsset(url.pathname)) {
    // Static assets - cache first
    event.respondWith(handleStaticAsset(request));
  } else {
    // HTML pages - network first with offline fallback
    event.respondWith(handlePageRequest(request));
  }
});

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
  const url = new URL(request.url);
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache successful responses for certain endpoints
    if (networkResponse.ok && shouldCacheApiResponse(url.pathname)) {
      const cache = await caches.open(RUNTIME_CACHE);
      // Clone the response since it can only be consumed once
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed for API request, trying cache:', url.pathname);
    
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // No cache available, return offline response for specific endpoints
    if (isOfflineApiEndpoint(url.pathname)) {
      return new Response(
        JSON.stringify({ 
          error: 'Offline', 
          message: 'This feature is not available offline',
          offline: true 
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Re-throw error for other endpoints
    throw error;
  }
}

// Handle static assets with cache-first strategy
async function handleStaticAsset(request) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Not in cache, fetch from network and cache
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Failed to load static asset:', request.url);
    throw error;
  }
}

// Handle page requests with network-first strategy and offline fallback
async function handlePageRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache successful HTML responses
    if (networkResponse.ok && networkResponse.headers.get('content-type')?.includes('text/html')) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed for page request, trying cache:', request.url);
    
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // No cache available, return offline page
    const offlineResponse = await caches.match('/offline.html');
    return offlineResponse || new Response('Offline', { status: 503 });
  }
}

// Check if URL is a static asset
function isStaticAsset(pathname) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2'];
  return staticExtensions.some(ext => pathname.endsWith(ext)) || 
         pathname.startsWith('/icons/') ||
         pathname.startsWith('/_next/static/');
}

// Check if API response should be cached
function shouldCacheApiResponse(pathname) {
  return API_CACHE_PATTERNS.some(pattern => pattern.test(pathname)) &&
         !pathname.includes('/realtime') && // Don't cache real-time endpoints
         !pathname.includes('/notifications') && // Don't cache notification endpoints
         !pathname.includes('/analytics'); // Don't cache analytics endpoints
}

// Check if endpoint supports offline functionality
function isOfflineApiEndpoint(pathname) {
  const offlineEndpoints = [
    '/api/products/',
    '/api/user/profile',
    '/api/alerts/list',
    '/api/subscription/status'
  ];
  
  return offlineEndpoints.some(endpoint => pathname.startsWith(endpoint));
}

// Push notification handling
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  if (!event.data) {
    console.log('[SW] Push event but no data');
    return;
  }

  try {
    const data = event.data.json();
    console.log('[SW] Push data:', data);

    const options = {
      body: data.body || 'You have a new notification',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: data.data || {},
      actions: data.actions || [],
      tag: data.tag || 'default',
      requireInteraction: data.requireInteraction || false,
      silent: data.silent || false,
      vibrate: data.vibrate || [200, 100, 200],
      timestamp: Date.now(),
    };

    // Add custom actions based on notification type
    if (data.type === 'price_alert') {
      options.actions = [
        {
          action: 'view_product',
          title: 'View Product'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ];
    } else if (data.type === 'subscription') {
      options.actions = [
        {
          action: 'upgrade',
          title: 'Upgrade Now'
        },
        {
          action: 'later',
          title: 'Remind Later'
        }
      ];
    }

    event.waitUntil(
      self.registration.showNotification(data.title || 'Shop Value', options)
    );
  } catch (error) {
    console.error('[SW] Error handling push notification:', error);
    
    // Fallback notification
    event.waitUntil(
      self.registration.showNotification('Shop Value', {
        body: 'You have a new notification',
        icon: '/icons/icon-192x192.png',
        tag: 'fallback'
      })
    );
  }
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification);
  
  event.notification.close();

  const { action, data } = event;
  const notificationData = event.notification.data || {};

  event.waitUntil(
    handleNotificationClick(action, notificationData)
  );
});

// Handle notification click actions
async function handleNotificationClick(action, data) {
  const clients = await self.clients.matchAll({ type: 'window' });
  
  // Define navigation URLs based on action and data
  let url = '/';
  
  switch (action) {
    case 'view_product':
      if (data.productId) {
        url = `/products/${data.productId}`;
      } else {
        url = '/products';
      }
      break;
    case 'upgrade':
      url = '/pricing';
      break;
    case 'later':
      // Just focus the app, don't navigate
      break;
    case 'dismiss':
      return; // Don't open anything
    default:
      if (data.url) {
        url = data.url;
      } else if (data.type === 'price_alert') {
        url = '/dashboard/alerts';
      } else if (data.type === 'subscription') {
        url = '/dashboard/subscription';
      }
  }

  // Focus existing window or open new one
  const existingClient = clients.find(client => client.url.includes(self.location.origin));
  
  if (existingClient) {
    // Focus existing window and navigate
    await existingClient.focus();
    if (action !== 'later') {
      existingClient.postMessage({ type: 'navigate', url });
    }
  } else {
    // Open new window
    await self.clients.openWindow(url);
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  switch (event.tag) {
    case 'background-sync-alerts':
      event.waitUntil(syncPendingAlerts());
      break;
    case 'background-sync-analytics':
      event.waitUntil(syncAnalytics());
      break;
    case 'background-sync-preferences':
      event.waitUntil(syncUserPreferences());
      break;
    default:
      console.log('[SW] Unknown sync tag:', event.tag);
  }
});

// Sync pending price alerts created while offline
async function syncPendingAlerts() {
  try {
    console.log('[SW] Syncing pending alerts...');
    
    // Get pending alerts from IndexedDB or localStorage
    const pendingAlerts = await getPendingAlerts();
    
    for (const alert of pendingAlerts) {
      try {
        const response = await fetch('/api/alerts/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(alert)
        });
        
        if (response.ok) {
          await removePendingAlert(alert.id);
          console.log('[SW] Synced alert:', alert.id);
        }
      } catch (error) {
        console.error('[SW] Failed to sync alert:', alert.id, error);
      }
    }
  } catch (error) {
    console.error('[SW] Error syncing pending alerts:', error);
  }
}

// Sync analytics data
async function syncAnalytics() {
  try {
    console.log('[SW] Syncing analytics data...');
    
    const pendingAnalytics = await getPendingAnalytics();
    
    if (pendingAnalytics.length > 0) {
      const response = await fetch('/api/analytics/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events: pendingAnalytics })
      });
      
      if (response.ok) {
        await clearPendingAnalytics();
        console.log('[SW] Synced analytics data');
      }
    }
  } catch (error) {
    console.error('[SW] Error syncing analytics:', error);
  }
}

// Sync user preferences
async function syncUserPreferences() {
  try {
    console.log('[SW] Syncing user preferences...');
    
    const pendingPreferences = await getPendingPreferences();
    
    for (const pref of pendingPreferences) {
      try {
        const response = await fetch('/api/user/preferences', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(pref)
        });
        
        if (response.ok) {
          await removePendingPreference(pref.id);
          console.log('[SW] Synced preference:', pref.id);
        }
      } catch (error) {
        console.error('[SW] Failed to sync preference:', pref.id, error);
      }
    }
  } catch (error) {
    console.error('[SW] Error syncing preferences:', error);
  }
}

// Helper functions for IndexedDB operations
async function getPendingAlerts() {
  // Placeholder - implement IndexedDB operations
  return [];
}

async function removePendingAlert(id) {
  // Placeholder - implement IndexedDB operations
  console.log('[SW] Remove pending alert:', id);
}

async function getPendingAnalytics() {
  // Placeholder - implement IndexedDB operations
  return [];
}

async function clearPendingAnalytics() {
  // Placeholder - implement IndexedDB operations
  console.log('[SW] Clear pending analytics');
}

async function getPendingPreferences() {
  // Placeholder - implement IndexedDB operations
  return [];
}

async function removePendingPreference(id) {
  // Placeholder - implement IndexedDB operations
  console.log('[SW] Remove pending preference:', id);
}

// Message handling for communication with main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Received message:', event.data);
  
  const { type, data } = event.data;
  
  switch (type) {
    case 'skip-waiting':
      self.skipWaiting();
      break;
    case 'claim-clients':
      self.clients.claim();
      break;
    case 'cache-urls':
      if (data.urls) {
        cacheUrls(data.urls);
      }
      break;
    case 'clear-cache':
      clearCaches();
      break;
    default:
      console.log('[SW] Unknown message type:', type);
  }
});

// Cache specific URLs
async function cacheUrls(urls) {
  try {
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.addAll(urls);
    console.log('[SW] Cached URLs:', urls);
  } catch (error) {
    console.error('[SW] Error caching URLs:', error);
  }
}

// Clear all caches
async function clearCaches() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );
    console.log('[SW] All caches cleared');
  } catch (error) {
    console.error('[SW] Error clearing caches:', error);
  }
}

// Periodic background sync for keeping data fresh
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync triggered:', event.tag);
  
  switch (event.tag) {
    case 'price-updates':
      event.waitUntil(updatePriceCache());
      break;
    case 'content-refresh':
      event.waitUntil(refreshContent());
      break;
    default:
      console.log('[SW] Unknown periodic sync tag:', event.tag);
  }
});

// Update price cache in background
async function updatePriceCache() {
  try {
    console.log('[SW] Updating price cache...');
    
    const response = await fetch('/api/products/trending');
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put('/api/products/trending', response.clone());
    }
  } catch (error) {
    console.error('[SW] Error updating price cache:', error);
  }
}

// Refresh cached content
async function refreshContent() {
  try {
    console.log('[SW] Refreshing content cache...');
    
    const criticalUrls = [
      '/',
      '/dashboard',
      '/products'
    ];
    
    for (const url of criticalUrls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(url, response.clone());
        }
      } catch (error) {
        console.error('[SW] Error refreshing:', url, error);
      }
    }
  } catch (error) {
    console.error('[SW] Error in content refresh:', error);
  }
}

console.log('[SW] Service worker script loaded'); 