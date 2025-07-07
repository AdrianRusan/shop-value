import { Server as NetServer } from 'http';
import { NextApiRequest, NextApiResponse } from 'next';
import { Server as SocketIOServer } from 'socket.io';
import * as Sentry from '@sentry/nextjs';
import { auth } from '@clerk/nextjs/server';
import { redis } from './upstash';

export type NextApiResponseServerIO = NextApiResponse & {
  socket: {
    server: NetServer & {
      io: SocketIOServer;
    };
  };
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export interface ServerToClientEvents {
  'price-update': (data: PriceUpdateData) => void;
  'product-status-change': (data: ProductStatusData) => void;
  'connection-status': (data: { status: 'connected' | 'disconnected' }) => void;
  'error': (data: { message: string; code?: string }) => void;
  'notification': (data: NotificationData) => void;
  'performance-metrics': (data: PerformanceMetrics) => void;
}

export interface ClientToServerEvents {
  'subscribe-product': (productId: string) => void;
  'unsubscribe-product': (productId: string) => void;
  'join-user-room': (userId: string) => void;
  'leave-user-room': (userId: string) => void;
  'ping': () => void;
  'subscribe-notifications': (types: string[]) => void;
  'get-performance-metrics': () => void;
}

export interface InterServerEvents {
  ping: () => void;
  'broadcast-price-update': (data: PriceUpdateData) => void;
  'broadcast-notification': (data: NotificationData) => void;
  'performance-sync': (data: PerformanceMetrics) => void;
}

export interface SocketData {
  userId?: string;
  subscribedProducts?: string[];
  subscribedNotifications?: string[];
  connectedAt?: Date;
  lastActivity?: Date;
  ipAddress?: string;
  userAgent?: string;
  connectionId?: string;
  roomCount?: number;
  messagesSent?: number;
  messagesReceived?: number;
}

export interface PriceUpdateData {
  productId: string;
  newPrice: number;
  oldPrice: number;
  priceChange: number;
  priceChangePercent: number;
  timestamp: string;
  productTitle: string;
  productUrl: string;
  currency?: string;
}

export interface ProductStatusData {
  productId: string;
  status: 'available' | 'out_of_stock' | 'discontinued';
  timestamp: string;
  productTitle: string;
  availabilityInfo?: string;
}

export interface NotificationData {
  id: string;
  type: 'price_alert' | 'system' | 'promotion' | 'security';
  title: string;
  message: string;
  data?: any;
  timestamp: string;
  userId?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface PerformanceMetrics {
  totalConnections: number;
  currentConnections: number;
  messagesEmitted: number;
  messagesReceived: number;
  errors: number;
  reconnections: number;
  uptime: number;
  averageResponseTime: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  roomStats: {
    totalRooms: number;
    userRooms: number;
    productRooms: number;
  };
  connectionsByUserAgent: Record<string, number>;
  slowOperations: number;
  rateLimitHits: number;
}

export class SocketManager {
  private static instance: SocketManager;
  private io: SocketIOServer | null = null;
  private connectionCount = 0;
  private startTime = new Date();
  private performanceData: PerformanceMetrics = {
    totalConnections: 0,
    currentConnections: 0,
    messagesEmitted: 0,
    messagesReceived: 0,
    errors: 0,
    reconnections: 0,
    uptime: 0,
    averageResponseTime: 0,
    memoryUsage: { used: 0, total: 0, percentage: 0 },
    roomStats: { totalRooms: 0, userRooms: 0, productRooms: 0 },
    connectionsByUserAgent: {},
    slowOperations: 0,
    rateLimitHits: 0,
  };
  
  // Rate limiting
  private rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per window
  
  // Connection limits
  private readonly MAX_CONNECTIONS_PER_IP = 10;
  private readonly MAX_ROOMS_PER_CONNECTION = 50;
  private readonly MAX_MESSAGE_SIZE = 1024 * 10; // 10KB
  
  // Performance monitoring
  private responseTimeTracker = new Map<string, number>();
  private slowOperationThreshold = 1000; // 1 second
  
  // Memory management
  private cleanupInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  public initialize(server: NetServer): SocketIOServer {
    if (this.io) {
      return this.io;
    }

    this.io = new SocketIOServer<
      ClientToServerEvents,
      ServerToClientEvents,
      InterServerEvents,
      SocketData
    >(server, {
      path: '/api/socket',
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? [
              process.env.NEXT_PUBLIC_APP_URL,
              'https://shop-value.vercel.app',
              'https://shop-value-feature1.vercel.app'
            ].filter((url): url is string => typeof url === 'string')
          : ['http://localhost:3000', 'http://127.0.0.1:3000'],
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      allowEIO3: true,
      pingTimeout: 30000, // Reduced for faster detection
      pingInterval: 15000, // More frequent pings
      upgradeTimeout: 10000,
      maxHttpBufferSize: this.MAX_MESSAGE_SIZE,
      allowRequest: this.allowRequestHandler.bind(this),
      
      // Performance optimizations
      serveClient: false, // Don't serve client files
      perMessageDeflate: {
        threshold: 1024, // Only compress messages larger than 1KB
        concurrencyLimit: 10,
        windowBits: 13,
        memLevel: 7,
      },
      
      // Connection management
      connectTimeout: 5000,
    });

    this.setupEventHandlers();
    this.setupPerformanceMonitoring();
    this.setupMemoryManagement();
    this.setupHealthChecks();
    
    return this.io;
  }

  private allowRequestHandler(req: any, callback: Function) {
    const startTime = Date.now();
    
    try {
      // Extract IP address and user agent
      const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      
      // Check rate limiting per IP
      if (!this.checkRateLimit(ip)) {
        this.performanceData.rateLimitHits++;
        console.warn(`🚫 Rate limit exceeded for IP: ${ip}`);
        callback('Rate limit exceeded', false);
        return;
      }
      
      // Check connection limits per IP
      const currentConnections = this.getConnectionCountByIP(ip);
      if (currentConnections >= this.MAX_CONNECTIONS_PER_IP) {
        console.warn(`🚫 Connection limit exceeded for IP: ${ip} (${currentConnections})`);
        callback('Connection limit exceeded', false);
        return;
      }
      
      // Track user agents
      this.performanceData.connectionsByUserAgent[userAgent] = 
        (this.performanceData.connectionsByUserAgent[userAgent] || 0) + 1;
      
      const duration = Date.now() - startTime;
      console.log(`✅ Connection request approved for IP: ${ip} (${duration}ms)`);
      
      callback(null, true);
    } catch (error) {
      console.error('Error in allowRequestHandler:', error);
      Sentry.captureException(error);
      callback('Internal error', false);
    }
  }

  private checkRateLimit(identifier: string): boolean {
    const now = Date.now();
    const record = this.rateLimitMap.get(identifier);
    
    if (!record || now > record.resetTime) {
      // Reset or create new record
      this.rateLimitMap.set(identifier, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW
      });
      return true;
    }
    
    if (record.count >= this.RATE_LIMIT_MAX_REQUESTS) {
      return false;
    }
    
    record.count++;
    return true;
  }

  private getConnectionCountByIP(ip: string): number {
    if (!this.io) return 0;
    
    let count = 0;
    for (const [, socket] of Array.from(this.io.sockets.sockets.entries())) {
      if (socket.data.ipAddress === ip) {
        count++;
      }
    }
    return count;
  }

  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', async (socket) => {
      const connectionStartTime = Date.now();
      
      try {
        this.connectionCount++;
        this.performanceData.totalConnections++;
        this.performanceData.currentConnections++;

        // Enhanced connection data
        const ipAddress = socket.handshake.headers['x-forwarded-for'] || 
                         socket.handshake.address;
        const userAgent = socket.handshake.headers['user-agent'] || 'unknown';
        const connectionId = `${socket.id}-${Date.now()}`;
        
        socket.data.connectedAt = new Date();
        socket.data.lastActivity = new Date();
        socket.data.ipAddress = Array.isArray(ipAddress) ? ipAddress[0] : ipAddress;
        socket.data.userAgent = userAgent;
        socket.data.connectionId = connectionId;
        socket.data.roomCount = 0;
        socket.data.messagesSent = 0;
        socket.data.messagesReceived = 0;

        const connectionTime = Date.now() - connectionStartTime;
        console.log(`✅ Client connected: ${socket.id} from ${socket.data.ipAddress} (${connectionTime}ms)`);

        // Set up comprehensive activity tracking
        this.setupActivityTracking(socket);
        this.setupConnectionLimits(socket);

        // Enhanced event handlers with performance tracking
        this.setupUserRoomHandlers(socket);
        this.setupProductSubscriptionHandlers(socket);
        this.setupNotificationHandlers(socket);
        this.setupUtilityHandlers(socket);

        // Set up disconnect handler
        socket.on('disconnect', async (reason) => {
          await this.handleDisconnection(socket, reason);
        });

        // Set up error handler
        socket.on('error', (error) => {
          this.handleSocketError(socket, error);
        });

        // Send initial performance metrics if requested
        socket.on('get-performance-metrics', () => {
          socket.emit('performance-metrics', this.getPerformanceMetrics());
        });

        // Store connection metrics
        await this.storeConnectionMetrics(socket, connectionTime);

      } catch (error) {
        console.error('Error setting up socket connection:', error);
        Sentry.captureException(error);
        socket.disconnect(true);
      }
    });
  }

  private setupActivityTracking(socket: any) {
    // Enhanced activity tracking with performance monitoring
    const originalEmit = socket.emit.bind(socket);
    socket.emit = (...args: any[]) => {
      const startTime = Date.now();
      socket.data.lastActivity = new Date();
      socket.data.messagesSent = (socket.data.messagesSent || 0) + 1;
      this.performanceData.messagesEmitted++;
      
      const result = originalEmit(...args);
      
      const duration = Date.now() - startTime;
      if (duration > this.slowOperationThreshold) {
        this.performanceData.slowOperations++;
        console.warn(`🐌 Slow emit operation: ${duration}ms for event ${args[0]}`);
      }
      
      return result;
    };

    // Track incoming messages
    socket.prependAny((eventName: string, ...args: any[]) => {
      socket.data.lastActivity = new Date();
      socket.data.messagesReceived = (socket.data.messagesReceived || 0) + 1;
      this.performanceData.messagesReceived++;
      
      // Validate message size
      const messageSize = JSON.stringify(args).length;
      if (messageSize > this.MAX_MESSAGE_SIZE) {
        socket.emit('error', { 
          message: 'Message too large', 
          code: 'MESSAGE_SIZE_LIMIT' 
        });
        return;
      }
      
      // Track response time for specific events
      this.responseTimeTracker.set(`${socket.id}-${eventName}`, Date.now());
    });
  }

  private setupConnectionLimits(socket: any) {
    // Monitor room count
    const originalJoin = socket.join.bind(socket);
    socket.join = (room: string) => {
      if ((socket.data.roomCount || 0) >= this.MAX_ROOMS_PER_CONNECTION) {
        socket.emit('error', { 
          message: 'Maximum room limit exceeded', 
          code: 'ROOM_LIMIT_EXCEEDED' 
        });
        return;
      }
      
      socket.data.roomCount = (socket.data.roomCount || 0) + 1;
      return originalJoin(room);
    };
    
    const originalLeave = socket.leave.bind(socket);
    socket.leave = (room: string) => {
      socket.data.roomCount = Math.max(0, (socket.data.roomCount || 0) - 1);
      return originalLeave(room);
    };
  }

  private setupUserRoomHandlers(socket: any) {
    socket.on('join-user-room', async (userId: string) => {
      const startTime = Date.now();
      
      try {
        // Enhanced validation
        if (!this.isValidUserId(userId)) {
          socket.emit('error', { 
            message: 'Invalid user ID format', 
            code: 'INVALID_USER_ID' 
          });
          return;
        }

        socket.data.userId = userId;
        socket.join(`user:${userId}`);
        socket.data.lastActivity = new Date();
        
        console.log(`👤 User ${userId} joined room`);
        
        // Send connection confirmation with enhanced data
        socket.emit('connection-status', { 
          status: 'connected',
          userId,
          connectionId: socket.data.connectionId,
          serverTime: new Date().toISOString()
        });
        
        // Track successful authentication
        await this.trackEvent('user_authenticated', { 
          userId, 
          socketId: socket.id,
          connectionTime: Date.now() - startTime
        });
        
      } catch (error) {
        console.error(`Error joining user room for ${userId}:`, error);
        socket.emit('error', { 
          message: 'Failed to join user room', 
          code: 'JOIN_ROOM_ERROR' 
        });
        Sentry.captureException(error);
      }
    });

    socket.on('leave-user-room', async (userId: string) => {
      try {
        if (socket.data.userId === userId) {
          socket.leave(`user:${userId}`);
          console.log(`👤 User ${userId} left room`);
          
          await this.trackEvent('user_left_room', { 
            userId, 
            socketId: socket.id 
          });
        }
      } catch (error) {
        console.error(`Error leaving user room for ${userId}:`, error);
        Sentry.captureException(error);
      }
    });
  }

  private setupProductSubscriptionHandlers(socket: any) {
    socket.on('subscribe-product', async (productId: string) => {
      const startTime = Date.now();
      
      try {
        // Enhanced validation
        if (!this.isValidProductId(productId)) {
          socket.emit('error', { 
            message: 'Invalid product ID format', 
            code: 'INVALID_PRODUCT_ID' 
          });
          return;
        }

        // Check subscription limits
        const currentSubscriptions = socket.data.subscribedProducts?.length || 0;
        const maxSubscriptions = this.getMaxSubscriptions(socket);
        
        if (currentSubscriptions >= maxSubscriptions) {
          socket.emit('error', { 
            message: `Maximum ${maxSubscriptions} product subscriptions allowed`, 
            code: 'SUBSCRIPTION_LIMIT_EXCEEDED' 
          });
          return;
        }

        socket.join(`product:${productId}`);
        
        // Track subscribed products
        if (!socket.data.subscribedProducts) {
          socket.data.subscribedProducts = [];
        }
        if (!socket.data.subscribedProducts.includes(productId)) {
          socket.data.subscribedProducts.push(productId);
        }
        
        socket.data.lastActivity = new Date();
        
        const duration = Date.now() - startTime;
        console.log(`📦 Client ${socket.id} subscribed to product ${productId} (${duration}ms)`);
        
        await this.trackEvent('product_subscribed', { 
          productId, 
          socketId: socket.id,
          subscriptionTime: duration
        });
        
      } catch (error) {
        console.error(`Error subscribing to product ${productId}:`, error);
        socket.emit('error', { 
          message: 'Failed to subscribe to product', 
          code: 'SUBSCRIPTION_ERROR' 
        });
        Sentry.captureException(error);
      }
    });

    socket.on('unsubscribe-product', async (productId: string) => {
      try {
        socket.leave(`product:${productId}`);
        
        // Remove from subscribed products
        if (socket.data.subscribedProducts) {
          socket.data.subscribedProducts = socket.data.subscribedProducts.filter(
            (id: string) => id !== productId
          );
        }
        
        socket.data.lastActivity = new Date();
        
        console.log(`📦 Client ${socket.id} unsubscribed from product ${productId}`);
        
        await this.trackEvent('product_unsubscribed', { 
          productId, 
          socketId: socket.id 
        });
        
      } catch (error) {
        console.error(`Error unsubscribing from product ${productId}:`, error);
        Sentry.captureException(error);
      }
    });
  }

  private setupNotificationHandlers(socket: any) {
    socket.on('subscribe-notifications', async (types: string[]) => {
      try {
        if (!Array.isArray(types) || types.length === 0) {
          socket.emit('error', { 
            message: 'Invalid notification types', 
            code: 'INVALID_NOTIFICATION_TYPES' 
          });
          return;
        }

        const validTypes = ['price_alert', 'system', 'promotion', 'security'];
        const filteredTypes = types.filter(type => validTypes.includes(type));
        
        socket.data.subscribedNotifications = filteredTypes;
        socket.data.lastActivity = new Date();
        
        console.log(`🔔 Client ${socket.id} subscribed to notifications: ${filteredTypes.join(', ')}`);
        
        await this.trackEvent('notifications_subscribed', { 
          types: filteredTypes, 
          socketId: socket.id 
        });
        
      } catch (error) {
        console.error('Error subscribing to notifications:', error);
        Sentry.captureException(error);
      }
    });
  }

  private setupUtilityHandlers(socket: any) {
    socket.on('ping', () => {
      const responseKey = `${socket.id}-ping`;
      const startTime = this.responseTimeTracker.get(responseKey);
      
      if (startTime) {
        const responseTime = Date.now() - startTime;
        this.updateAverageResponseTime(responseTime);
        this.responseTimeTracker.delete(responseKey);
      }
      
      socket.data.lastActivity = new Date();
      socket.emit('connection-status', { 
        status: 'connected',
        responseTime: startTime ? Date.now() - startTime : undefined
      });
    });
  }

  private async handleDisconnection(socket: any, reason: string) {
    this.connectionCount--;
    this.performanceData.currentConnections--;
    
    const connectedDuration = socket.data.connectedAt 
      ? Date.now() - socket.data.connectedAt.getTime() 
      : 0;
    
    const sessionData = {
      socketId: socket.id,
      userId: socket.data.userId,
      reason,
      duration: connectedDuration,
      messagesSent: socket.data.messagesSent || 0,
      messagesReceived: socket.data.messagesReceived || 0,
      roomCount: socket.data.roomCount || 0,
      ipAddress: socket.data.ipAddress
    };
    
    console.log(`❌ Client disconnected: ${socket.id}, reason: ${reason}, duration: ${connectedDuration}ms`);
    
    // Store disconnection metrics
    await this.storeDisconnectionMetrics(sessionData);
    
    await this.trackEvent('client_disconnected', sessionData);
  }

  private handleSocketError(socket: any, error: any) {
    this.performanceData.errors++;
    console.error(`⚠️ Socket error for client ${socket.id}:`, error);
    
    Sentry.captureException(error, {
      tags: { 
        section: 'websocket', 
        action: 'socket_error' 
      },
      extra: { 
        socketId: socket.id, 
        userId: socket.data.userId,
        ipAddress: socket.data.ipAddress
      }
    });
  }

  private setupPerformanceMonitoring() {
    // Collect and store metrics every minute
    this.metricsInterval = setInterval(async () => {
      try {
        await this.collectAndStoreMetrics();
      } catch (error) {
        console.error('Error collecting WebSocket metrics:', error);
      }
    }, 60000);

    console.log('📊 WebSocket performance monitoring initialized');
  }

  private setupMemoryManagement() {
    // Clean up old data every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldData();
    }, 300000);

    console.log('🧹 WebSocket memory management initialized');
  }

  private setupHealthChecks() {
    // Monitor WebSocket health every 30 seconds
    setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('WebSocket health check failed:', error);
      }
    }, 30000);
  }

  private cleanupOldData() {
    const now = Date.now();
    let cleanedCount = 0;
    
    // Clean up old rate limit records
    for (const [key, record] of Array.from(this.rateLimitMap.entries())) {
      if (now > record.resetTime) {
        this.rateLimitMap.delete(key);
        cleanedCount++;
      }
    }
    
    // Clean up old response time tracking
    for (const [key, timestamp] of Array.from(this.responseTimeTracker.entries())) {
      if (now - timestamp > 300000) { // 5 minutes old
        this.responseTimeTracker.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned ${cleanedCount} old WebSocket data entries`);
    }
  }

  private async performHealthCheck() {
    if (!this.io) return;
    
    const memoryUsage = process.memoryUsage();
    this.performanceData.memoryUsage = {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
      percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
    };
    
    // Calculate room statistics
    const rooms = this.io.sockets.adapter.rooms;
    let userRooms = 0;
    let productRooms = 0;
    
    for (const roomName of Array.from(rooms.keys())) {
      if (roomName.startsWith('user:')) userRooms++;
      else if (roomName.startsWith('product:')) productRooms++;
    }
    
    this.performanceData.roomStats = {
      totalRooms: rooms.size,
      userRooms,
      productRooms
    };
    
    // Check for performance alerts
    if (this.performanceData.memoryUsage.percentage > 85) {
      console.warn('⚠️ High memory usage detected:', this.performanceData.memoryUsage);
      
      Sentry.captureMessage('High WebSocket memory usage', {
        level: 'warning',
        extra: { memoryUsage: this.performanceData.memoryUsage }
      });
    }
    
    if (this.performanceData.currentConnections > 1000) {
      console.warn('⚠️ High connection count:', this.performanceData.currentConnections);
    }
  }

  private async collectAndStoreMetrics() {
    // Update performance data
    this.performanceData.uptime = Date.now() - this.startTime.getTime();
    
    // Store in Redis for external monitoring
    try {
      await redis.hset('websocket:metrics', {
        totalConnections: this.performanceData.totalConnections.toString(),
        currentConnections: this.performanceData.currentConnections.toString(),
        messagesEmitted: this.performanceData.messagesEmitted.toString(),
        messagesReceived: this.performanceData.messagesReceived.toString(),
        errors: this.performanceData.errors.toString(),
        uptime: this.performanceData.uptime.toString(),
        memoryUsagePercentage: this.performanceData.memoryUsage.percentage.toString(),
        totalRooms: this.performanceData.roomStats.totalRooms.toString(),
        slowOperations: this.performanceData.slowOperations.toString(),
        rateLimitHits: this.performanceData.rateLimitHits.toString(),
        timestamp: Date.now().toString(),
      });
      
      // Store hourly metrics for trends
      const hour = new Date().getHours();
      await redis.hset(`websocket:metrics:hourly:${hour}`, {
        connections: this.performanceData.currentConnections.toString(),
        messages: (this.performanceData.messagesEmitted + this.performanceData.messagesReceived).toString(),
        errors: this.performanceData.errors.toString(),
        timestamp: Date.now().toString(),
      });
      
    } catch (error) {
      console.error('Error storing WebSocket metrics:', error);
    }
  }

  private async storeConnectionMetrics(socket: any, connectionTime: number) {
    try {
      await redis.lpush('websocket:connections', JSON.stringify({
        socketId: socket.id,
        userId: socket.data.userId,
        ipAddress: socket.data.ipAddress,
        userAgent: socket.data.userAgent,
        connectionTime,
        timestamp: Date.now(),
      }));
      
      // Keep only last 1000 connection records
      await redis.ltrim('websocket:connections', 0, 999);
    } catch (error) {
      console.error('Error storing connection metrics:', error);
    }
  }

  private async storeDisconnectionMetrics(sessionData: any) {
    try {
      await redis.lpush('websocket:disconnections', JSON.stringify({
        ...sessionData,
        timestamp: Date.now(),
      }));
      
      // Keep only last 1000 disconnection records
      await redis.ltrim('websocket:disconnections', 0, 999);
    } catch (error) {
      console.error('Error storing disconnection metrics:', error);
    }
  }

  private updateAverageResponseTime(responseTime: number) {
    const currentAvg = this.performanceData.averageResponseTime;
    const totalMessages = this.performanceData.messagesEmitted + this.performanceData.messagesReceived;
    
    if (totalMessages === 0) {
      this.performanceData.averageResponseTime = responseTime;
    } else {
      this.performanceData.averageResponseTime = 
        (currentAvg * (totalMessages - 1) + responseTime) / totalMessages;
    }
  }

  private isValidUserId(userId: string): boolean {
    return typeof userId === 'string' && 
           userId.length > 0 && 
           userId.length <= 100 &&
           /^[a-zA-Z0-9_-]+$/.test(userId);
  }

  private isValidProductId(productId: string): boolean {
    return typeof productId === 'string' && 
           productId.length > 0 && 
           productId.length <= 100 &&
           /^[a-zA-Z0-9_-]+$/.test(productId);
  }

  private getMaxSubscriptions(socket: any): number {
    // Could be based on user subscription tier
    return socket.data.userId ? 50 : 5; // Authenticated users get more
  }

  private async trackEvent(event: string, data: any) {
    // Enhanced event tracking with performance data
    const eventData = {
      ...data,
      timestamp: new Date().toISOString(),
      memoryUsage: this.performanceData.memoryUsage.percentage,
      currentConnections: this.performanceData.currentConnections,
    };
    
    console.log(`📊 WebSocket Event: ${event}`, eventData);
    
    // Store in Redis for analytics
    if (process.env.NODE_ENV === 'production') {
      try {
        await redis.lpush('websocket:events', JSON.stringify({
          event,
          data: eventData,
        }));
        
        // Keep only last 10000 events
        await redis.ltrim('websocket:events', 0, 9999);
      } catch (error) {
        console.error('Error storing WebSocket event:', error);
      }
    }
  }

  // Public API methods with enhanced functionality
  public getIO(): SocketIOServer | null {
    return this.io;
  }

  // Enhanced emission methods with performance tracking
  public emitPriceUpdate(productId: string, data: PriceUpdateData): void {
    if (!this.io) {
      console.warn('Socket.IO not initialized, cannot emit price update');
      return;
    }
    
    const startTime = Date.now();
    
    try {
      this.io.to(`product:${productId}`).emit('price-update', data);
      
      const duration = Date.now() - startTime;
      console.log(`💰 Price update emitted for product ${productId}: ${data.newPrice} (${duration}ms)`);
      
      this.trackEvent('price_update_emitted', { 
        productId, 
        priceChange: data.priceChange,
        emissionTime: duration,
        subscriberCount: this.io.sockets.adapter.rooms.get(`product:${productId}`)?.size || 0
      });
      
      if (duration > this.slowOperationThreshold) {
        this.performanceData.slowOperations++;
      }
      
    } catch (error) {
      console.error('Error emitting price update:', error);
      Sentry.captureException(error);
    }
  }

  public emitProductStatusChange(productId: string, data: ProductStatusData): void {
    if (!this.io) {
      console.warn('Socket.IO not initialized, cannot emit status change');
      return;
    }
    
    const startTime = Date.now();
    
    try {
      this.io.to(`product:${productId}`).emit('product-status-change', data);
      
      const duration = Date.now() - startTime;
      console.log(`📊 Status change emitted for product ${productId}: ${data.status} (${duration}ms)`);
      
      this.trackEvent('status_change_emitted', { 
        productId, 
        status: data.status,
        emissionTime: duration,
        subscriberCount: this.io.sockets.adapter.rooms.get(`product:${productId}`)?.size || 0
      });
      
    } catch (error) {
      console.error('Error emitting status change:', error);
      Sentry.captureException(error);
    }
  }

  public emitToUser(userId: string, event: keyof ServerToClientEvents, data: any): void {
    if (!this.io) {
      console.warn('Socket.IO not initialized, cannot emit to user');
      return;
    }
    
    const startTime = Date.now();
    
    try {
      this.io.to(`user:${userId}`).emit(event, data);
      
      const duration = Date.now() - startTime;
      console.log(`👤 Event ${event} emitted to user ${userId} (${duration}ms)`);
      
      this.trackEvent('user_event_emitted', { 
        userId, 
        event,
        emissionTime: duration
      });
      
    } catch (error) {
      console.error(`Error emitting to user ${userId}:`, error);
      Sentry.captureException(error);
    }
  }

  public emitNotification(notification: NotificationData): void {
    if (!this.io) {
      console.warn('Socket.IO not initialized, cannot emit notification');
      return;
    }
    
    const startTime = Date.now();
    
    try {
      if (notification.userId) {
        // Send to specific user
        this.io.to(`user:${notification.userId}`).emit('notification', notification);
      } else {
        // Broadcast to all connected clients
        this.io.emit('notification', notification);
      }
      
      const duration = Date.now() - startTime;
      console.log(`🔔 Notification emitted: ${notification.type} (${duration}ms)`);
      
      this.trackEvent('notification_emitted', { 
        type: notification.type,
        priority: notification.priority,
        userId: notification.userId,
        emissionTime: duration
      });
      
    } catch (error) {
      console.error('Error emitting notification:', error);
      Sentry.captureException(error);
    }
  }

  public getConnectedClientsCount(): number {
    return this.connectionCount;
  }

  public async getProductSubscribers(productId: string): Promise<string[]> {
    if (!this.io) return [];
    
    const room = this.io.sockets.adapter.rooms.get(`product:${productId}`);
    if (!room) return [];
    
    const subscribers: string[] = [];
    for (const socketId of Array.from(room)) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket?.data.userId) {
        subscribers.push(socket.data.userId);
      }
    }
    
    return Array.from(new Set(subscribers)); // Remove duplicates
  }

  public getPerformanceMetrics(): PerformanceMetrics {
    return {
      ...this.performanceData,
      uptime: Date.now() - this.startTime.getTime(),
    };
  }

  public async getHealthStatus() {
    const metrics = this.getPerformanceMetrics();
    
    const status = {
      healthy: true,
      uptime: metrics.uptime,
      connections: metrics.currentConnections,
      memoryUsage: metrics.memoryUsage,
      performance: {
        averageResponseTime: metrics.averageResponseTime,
        slowOperations: metrics.slowOperations,
        errorRate: metrics.errors / Math.max(1, metrics.totalConnections) * 100,
      },
      warnings: [] as string[],
      recommendations: [] as string[],
    };
    
    // Generate warnings
    if (metrics.memoryUsage.percentage > 80) {
      status.warnings.push('High memory usage detected');
      status.healthy = false;
    }
    
    if (metrics.averageResponseTime > 1000) {
      status.warnings.push('High average response time');
    }
    
    if (metrics.currentConnections > 500) {
      status.warnings.push('High connection count');
    }
    
    // Generate recommendations
    if (metrics.slowOperations > 10) {
      status.recommendations.push('Optimize slow WebSocket operations');
    }
    
    if (metrics.rateLimitHits > 100) {
      status.recommendations.push('Review rate limiting policies');
    }
    
    return status;
  }

  public async shutdown(): Promise<void> {
    try {
      console.log('🔄 Shutting down WebSocket server...');
      
      // Clear intervals
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
      }
      
      // Store final metrics
      await this.collectAndStoreMetrics();
      
      // Close all connections
      if (this.io) {
        this.io.close();
        this.io = null;
      }
      
      // Clear data structures
      this.rateLimitMap.clear();
      this.responseTimeTracker.clear();
      
      console.log('✅ WebSocket server shutdown complete');
    } catch (error) {
      console.error('Error during WebSocket shutdown:', error);
      throw error;
    }
  }
}

export default SocketManager;