// Note: Toast notifications handled by app's notification system

export interface PWAInstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PWAUpdateInfo {
  available: boolean;
  waiting: ServiceWorker | null;
  installing: ServiceWorker | null;
}

export interface NotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
}

export class PWAManager {
  private static instance: PWAManager;
  private registration: ServiceWorkerRegistration | null = null;
  private installPromptEvent: PWAInstallPrompt | null = null;
  private updateAvailable = false;
  private pushSubscription: PushSubscription | null = null;

  // Event listeners
  private onInstallPromptCallbacks: Array<(canInstall: boolean) => void> = [];
  private onUpdateAvailableCallbacks: Array<(updateInfo: PWAUpdateInfo) => void> = [];
  private onConnectionChangeCallbacks: Array<(isOnline: boolean) => void> = [];

  private constructor() {
    this.initialize();
  }

  public static getInstance(): PWAManager {
    if (!PWAManager.instance) {
      PWAManager.instance = new PWAManager();
    }
    return PWAManager.instance;
  }

  /**
   * Initialize PWA functionality
   */
  private async initialize(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      // Register service worker
      await this.registerServiceWorker();

      // Setup install prompt handling
      this.setupInstallPrompt();

      // Setup connection monitoring
      this.setupConnectionMonitoring();

      // Setup notification handling
      this.setupNotificationHandling();

      // Setup background sync
      this.setupBackgroundSync();

      console.log('[PWA] PWA Manager initialized successfully');
    } catch (error) {
      console.error('[PWA] Failed to initialize PWA Manager:', error);
    }
  }

  /**
   * Register service worker
   */
  private async registerServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.log('[PWA] Service Worker not supported');
      return;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      });

      console.log('[PWA] Service Worker registered:', this.registration);

      // Setup update handling
      this.setupUpdateHandling();

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this));

    } catch (error) {
      console.error('[PWA] Service Worker registration failed:', error);
      throw error;
    }
  }

  /**
   * Setup service worker update handling
   */
  private setupUpdateHandling(): void {
    if (!this.registration) return;

    // Handle waiting service worker
    if (this.registration.waiting) {
      this.updateAvailable = true;
      this.notifyUpdateAvailable({
        available: true,
        waiting: this.registration.waiting,
        installing: null,
      });
    }

    // Handle installing service worker
    if (this.registration.installing) {
      this.trackInstalling(this.registration.installing);
    }

    // Listen for updates
    this.registration.addEventListener('updatefound', () => {
      const newWorker = this.registration!.installing;
      if (newWorker) {
        this.trackInstalling(newWorker);
      }
    });

    // Listen for controller change (new SW activated)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[PWA] New service worker activated');
      window.location.reload();
    });
  }

  /**
   * Track installing service worker
   */
  private trackInstalling(worker: ServiceWorker): void {
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        // New service worker installed and ready
        this.updateAvailable = true;
        this.notifyUpdateAvailable({
          available: true,
          waiting: worker,
          installing: null,
        });
      }
    });
  }

  /**
   * Setup install prompt handling
   */
  private setupInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.installPromptEvent = e as PWAInstallPrompt;
      this.notifyInstallPrompt(true);
      console.log('[PWA] Install prompt ready');
    });

    window.addEventListener('appinstalled', () => {
      this.installPromptEvent = null;
      this.notifyInstallPrompt(false);
      console.log('[PWA] App installed successfully');
      
      console.log('[PWA] App installed successfully - can be accessed from home screen');
    });
  }

  /**
   * Setup connection monitoring
   */
  private setupConnectionMonitoring(): void {
    const updateConnectionStatus = () => {
      this.notifyConnectionChange(navigator.onLine);
    };

    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);

    // Initial status
    updateConnectionStatus();
  }

  /**
   * Setup notification handling
   */
  private setupNotificationHandling(): void {
    // Listen for notification clicks from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'navigate') {
        window.location.href = event.data.url;
      }
    });
  }

  /**
   * Setup background sync
   */
  private setupBackgroundSync(): void {
    if (!('serviceWorker' in navigator) || !('sync' in window.ServiceWorkerRegistration.prototype)) {
      console.log('[PWA] Background Sync not supported');
      return;
    }

    // Register background sync events when needed
    console.log('[PWA] Background Sync available');
  }

  /**
   * Handle messages from service worker
   */
  private handleServiceWorkerMessage(event: MessageEvent): void {
    const { type, data } = event.data || {};

    switch (type) {
      case 'cache-updated':
        console.log('[PWA] Cache updated:', data);
        break;
      case 'offline-ready':
        console.log('[PWA] App ready for offline use');
        break;
      case 'navigate':
        if (data?.url) {
          window.location.href = data.url;
        }
        break;
      default:
        console.log('[PWA] Unknown message from SW:', event.data);
    }
  }

  /**
   * Install the PWA
   */
  public async installApp(): Promise<boolean> {
    if (!this.installPromptEvent) {
      console.log('[PWA] No install prompt available');
      return false;
    }

    try {
      await this.installPromptEvent.prompt();
      const choiceResult = await this.installPromptEvent.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] User accepted install prompt');
        this.installPromptEvent = null;
        this.notifyInstallPrompt(false);
        return true;
      } else {
        console.log('[PWA] User dismissed install prompt');
        return false;
      }
    } catch (error) {
      console.error('[PWA] Install prompt failed:', error);
      return false;
    }
  }

  /**
   * Update the service worker
   */
  public async updateServiceWorker(): Promise<void> {
    if (!this.registration || !this.updateAvailable) {
      console.log('[PWA] No update available');
      return;
    }

    const waiting = this.registration.waiting;
    if (waiting) {
      waiting.postMessage({ type: 'skip-waiting' });
      console.log('[PWA] Service worker update requested');
    }
  }

  /**
   * Request notification permission and setup push notifications
   */
  public async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.log('[PWA] Notifications not supported');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      console.log('[PWA] Notification permission:', permission);
      
      if (permission === 'granted') {
        await this.subscribeToPushNotifications();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[PWA] Failed to request notification permission:', error);
      return false;
    }
  }

  /**
   * Subscribe to push notifications
   */
  public async subscribeToPushNotifications(): Promise<PushSubscriptionData | null> {
    if (!this.registration) {
      console.error('[PWA] Service worker not registered');
      return null;
    }

    try {
      // Check if already subscribed
      this.pushSubscription = await this.registration.pushManager.getSubscription();
      
      if (!this.pushSubscription) {
        // Subscribe to push notifications
        this.pushSubscription = await this.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: await this.getVapidPublicKey(),
        });
      }

      const subscriptionData = this.getPushSubscriptionData();
      
      if (subscriptionData) {
        // Send subscription to server
        await this.sendSubscriptionToServer(subscriptionData);
        console.log('[PWA] Push notification subscription successful');
      }

      return subscriptionData;
    } catch (error) {
      console.error('[PWA] Failed to subscribe to push notifications:', error);
      return null;
    }
  }

  /**
   * Get VAPID public key from server
   */
  private async getVapidPublicKey(): Promise<string> {
    try {
      const response = await fetch('/api/push/vapid-key');
      const data = await response.json();
      return data.publicKey;
    } catch (error) {
      console.error('[PWA] Failed to get VAPID key:', error);
      // Fallback VAPID key (should be replaced with actual key)
      return 'BEl62iUYgUivxIkv69yViEuiBIa40HI0DLLEo3pj8pP6GJqxQ1v_8yqAXZ7hfLYFN3bZR7RBJR8iMQr-gq6d7t4';
    }
  }

  /**
   * Get push subscription data
   */
  private getPushSubscriptionData(): PushSubscriptionData | null {
    if (!this.pushSubscription) return null;

    const key = this.pushSubscription.getKey('p256dh');
    const auth = this.pushSubscription.getKey('auth');

    if (!key || !auth) return null;

    return {
      endpoint: this.pushSubscription.endpoint,
      keys: {
        p256dh: btoa(String.fromCharCode(...Array.from(new Uint8Array(key)))),
        auth: btoa(String.fromCharCode(...Array.from(new Uint8Array(auth)))),
      },
    };
  }

  /**
   * Send subscription to server
   */
  private async sendSubscriptionToServer(subscription: PushSubscriptionData): Promise<void> {
    try {
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription),
      });

      if (!response.ok) {
        throw new Error('Failed to send subscription to server');
      }

      console.log('[PWA] Subscription sent to server successfully');
    } catch (error) {
      console.error('[PWA] Failed to send subscription to server:', error);
      throw error;
    }
  }

  /**
   * Show local notification
   */
  public async showNotification(options: NotificationOptions): Promise<void> {
    if (!this.registration) {
      console.error('[PWA] Service worker not registered');
      return;
    }

    if (Notification.permission !== 'granted') {
      console.error('[PWA] Notification permission not granted');
      return;
    }

    try {
      const notificationOptions: globalThis.NotificationOptions = {
        body: options.body,
        icon: options.icon || '/icons/icon-192x192.png',
        badge: options.badge || '/icons/badge-72x72.png',
        tag: options.tag,
        data: options.data,
        requireInteraction: options.requireInteraction,
        silent: options.silent,
      };

      // Add vibrate if supported (not in official NotificationOptions but may work in some browsers)
      if (options.vibrate) {
        (notificationOptions as any).vibrate = options.vibrate;
      }
      
      // Add actions if supported
      if (options.actions && 'actions' in globalThis.Notification.prototype) {
        (notificationOptions as any).actions = options.actions;
      }
      
      await this.registration.showNotification(options.title, notificationOptions);

      console.log('[PWA] Notification shown:', options.title);
    } catch (error) {
      console.error('[PWA] Failed to show notification:', error);
    }
  }

  /**
   * Register background sync
   */
  public async registerBackgroundSync(tag: string): Promise<void> {
    if (!this.registration) {
      console.error('[PWA] Service worker not registered');
      return;
    }

    if (!('sync' in this.registration)) {
      console.log('[PWA] Background Sync not supported');
      return;
    }

    try {
      await (this.registration as any).sync.register(tag);
      console.log('[PWA] Background sync registered:', tag);
    } catch (error) {
      console.error('[PWA] Failed to register background sync:', error);
    }
  }

  /**
   * Cache important URLs
   */
  public async cacheUrls(urls: string[]): Promise<void> {
    if (!this.registration) {
      console.error('[PWA] Service worker not registered');
      return;
    }

    try {
      if (this.registration.active) {
        this.registration.active.postMessage({
          type: 'cache-urls',
          data: { urls }
        });
      }
      console.log('[PWA] URLs queued for caching:', urls);
    } catch (error) {
      console.error('[PWA] Failed to cache URLs:', error);
    }
  }

  /**
   * Clear all caches
   */
  public async clearCaches(): Promise<void> {
    if (!this.registration) {
      console.error('[PWA] Service worker not registered');
      return;
    }

    try {
      if (this.registration.active) {
        this.registration.active.postMessage({ type: 'clear-cache' });
      }
      console.log('[PWA] Cache clear requested');
    } catch (error) {
      console.error('[PWA] Failed to clear caches:', error);
    }
  }

  /**
   * Event listener management
   */
  public onInstallPrompt(callback: (canInstall: boolean) => void): () => void {
    this.onInstallPromptCallbacks.push(callback);
    
    // Call immediately with current state
    callback(this.canInstall());
    
    return () => {
      const index = this.onInstallPromptCallbacks.indexOf(callback);
      if (index > -1) {
        this.onInstallPromptCallbacks.splice(index, 1);
      }
    };
  }

  public onUpdateAvailable(callback: (updateInfo: PWAUpdateInfo) => void): () => void {
    this.onUpdateAvailableCallbacks.push(callback);
    
    // Call immediately with current state
    callback({
      available: this.updateAvailable,
      waiting: this.registration?.waiting || null,
      installing: this.registration?.installing || null,
    });
    
    return () => {
      const index = this.onUpdateAvailableCallbacks.indexOf(callback);
      if (index > -1) {
        this.onUpdateAvailableCallbacks.splice(index, 1);
      }
    };
  }

  public onConnectionChange(callback: (isOnline: boolean) => void): () => void {
    this.onConnectionChangeCallbacks.push(callback);
    
    // Call immediately with current state
    callback(navigator.onLine);
    
    return () => {
      const index = this.onConnectionChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.onConnectionChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Utility methods
   */
  public canInstall(): boolean {
    return this.installPromptEvent !== null;
  }

  public isInstalled(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true;
  }

  public isOnline(): boolean {
    return navigator.onLine;
  }

  public hasUpdateAvailable(): boolean {
    return this.updateAvailable;
  }

  public getInstallationStatus(): 'not-available' | 'available' | 'installed' {
    if (this.isInstalled()) return 'installed';
    if (this.canInstall()) return 'available';
    return 'not-available';
  }

  /**
   * Private notification methods
   */
  private notifyInstallPrompt(canInstall: boolean): void {
    this.onInstallPromptCallbacks.forEach(callback => callback(canInstall));
  }

  private notifyUpdateAvailable(updateInfo: PWAUpdateInfo): void {
    this.onUpdateAvailableCallbacks.forEach(callback => callback(updateInfo));
  }

  private notifyConnectionChange(isOnline: boolean): void {
    this.onConnectionChangeCallbacks.forEach(callback => callback(isOnline));
  }
}

// Export singleton instance
export const pwaManager = PWAManager.getInstance(); 