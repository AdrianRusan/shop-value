import { Server as NetServer } from 'http';
import { NextApiRequest, NextApiResponse } from 'next';
import { Server as SocketIOServer } from 'socket.io';

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
}

export interface ClientToServerEvents {
  'subscribe-product': (productId: string) => void;
  'unsubscribe-product': (productId: string) => void;
  'join-user-room': (userId: string) => void;
  'leave-user-room': (userId: string) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId?: string;
  subscribedProducts?: string[];
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
}

export interface ProductStatusData {
  productId: string;
  status: 'available' | 'out_of_stock' | 'discontinued';
  timestamp: string;
  productTitle: string;
}

export class SocketManager {
  private static instance: SocketManager;
  private io: SocketIOServer | null = null;

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
          ? process.env.NEXT_PUBLIC_APP_URL 
          : 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.setupEventHandlers();
    return this.io;
  }

  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);

      // Handle user room joining
      socket.on('join-user-room', (userId: string) => {
        socket.data.userId = userId;
        socket.join(`user:${userId}`);
        console.log(`User ${userId} joined room`);
        
        // Send connection confirmation
        socket.emit('connection-status', { status: 'connected' });
      });

      // Handle leaving user room
      socket.on('leave-user-room', (userId: string) => {
        socket.leave(`user:${userId}`);
        console.log(`User ${userId} left room`);
      });

      // Handle product subscription
      socket.on('subscribe-product', (productId: string) => {
        socket.join(`product:${productId}`);
        
        // Track subscribed products
        if (!socket.data.subscribedProducts) {
          socket.data.subscribedProducts = [];
        }
        if (!socket.data.subscribedProducts.includes(productId)) {
          socket.data.subscribedProducts.push(productId);
        }
        
        console.log(`Client ${socket.id} subscribed to product ${productId}`);
      });

      // Handle product unsubscription
      socket.on('unsubscribe-product', (productId: string) => {
        socket.leave(`product:${productId}`);
        
        // Remove from subscribed products
        if (socket.data.subscribedProducts) {
          socket.data.subscribedProducts = socket.data.subscribedProducts.filter(
            (id: string) => id !== productId
          );
        }
        
        console.log(`Client ${socket.id} unsubscribed from product ${productId}`);
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
      });

      // Handle connection errors
      socket.on('error', (error) => {
        console.error(`Socket error for client ${socket.id}:`, error);
      });
    });
  }

  public getIO(): SocketIOServer | null {
    return this.io;
  }

  // Emit price update to all subscribers of a product
  public emitPriceUpdate(productId: string, data: PriceUpdateData): void {
    if (!this.io) return;
    
    this.io.to(`product:${productId}`).emit('price-update', data);
    console.log(`Price update emitted for product ${productId}`);
  }

  // Emit product status change
  public emitProductStatusChange(productId: string, data: ProductStatusData): void {
    if (!this.io) return;
    
    this.io.to(`product:${productId}`).emit('product-status-change', data);
    console.log(`Product status change emitted for product ${productId}`);
  }

  // Emit to specific user
  public emitToUser(userId: string, event: keyof ServerToClientEvents, data: any): void {
    if (!this.io) return;
    
    this.io.to(`user:${userId}`).emit(event, data);
    console.log(`Event ${event} emitted to user ${userId}`);
  }

  // Get connected clients count
  public getConnectedClientsCount(): number {
    if (!this.io) return 0;
    return this.io.engine.clientsCount;
  }

  // Get clients subscribed to a product
  public async getProductSubscribers(productId: string): Promise<string[]> {
    if (!this.io) return [];
    
    const sockets = await this.io.in(`product:${productId}`).fetchSockets();
    return sockets.map(socket => socket.id);
  }
}