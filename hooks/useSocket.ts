'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  ServerToClientEvents, 
  ClientToServerEvents, 
  PriceUpdateData, 
  ProductStatusData 
} from '@/lib/socket-server';

interface UseSocketOptions {
  userId?: string;
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

interface SocketState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  reconnectAttempts: number;
}

export function useSocket(options: UseSocketOptions = {}) {
  const {
    userId,
    autoConnect = true,
    reconnection = true,
    reconnectionAttempts = 5,
    reconnectionDelay = 1000,
  } = options;

  const [socketState, setSocketState] = useState<SocketState>({
    connected: false,
    connecting: false,
    error: null,
    reconnectAttempts: 0,
  });

  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const subscribedProductsRef = useRef<Set<string>>(new Set());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Event handlers
  const [priceUpdateHandler, setPriceUpdateHandler] = useState<
    ((data: PriceUpdateData) => void) | null
  >(null);
  const [statusChangeHandler, setStatusChangeHandler] = useState<
    ((data: ProductStatusData) => void) | null
  >(null);
  const [connectionStatusHandler, setConnectionStatusHandler] = useState<
    ((data: { status: 'connected' | 'disconnected' }) => void) | null
  >(null);

  // Initialize socket connection
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    setSocketState(prev => ({ ...prev, connecting: true, error: null }));

    const socket = io(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000', {
      path: '/api/socket',
      transports: ['websocket', 'polling'],
      reconnection,
      reconnectionAttempts,
      reconnectionDelay,
      timeout: 10000,
    });

    socketRef.current = socket;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setSocketState(prev => ({
        ...prev,
        connected: true,
        connecting: false,
        error: null,
        reconnectAttempts: 0,
      }));

      // Join user room if userId is provided
      if (userId) {
        socket.emit('join-user-room', userId);
      }

      // Re-subscribe to products after reconnection
      subscribedProductsRef.current.forEach(productId => {
        socket.emit('subscribe-product', productId);
      });

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setSocketState(prev => ({
        ...prev,
        connected: false,
        connecting: false,
        error: `Disconnected: ${reason}`,
      }));

      connectionStatusHandler?.({ status: 'disconnected' });
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      
      // Calculate the new reconnect attempts value to avoid stale closure
      const newReconnectAttempts = socketState.reconnectAttempts + 1;
      
      setSocketState(prev => ({
        ...prev,
        connected: false,
        connecting: false,
        error: error.message,
        reconnectAttempts: newReconnectAttempts,
      }));

      // Implement exponential backoff for reconnection using the correct value
      if (reconnection && newReconnectAttempts < reconnectionAttempts) {
        const delay = reconnectionDelay * Math.pow(2, newReconnectAttempts);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    });

    // Business logic event handlers
    socket.on('price-update', (data: PriceUpdateData) => {
      console.log('Price update received:', data);
      priceUpdateHandler?.(data);
    });

    socket.on('product-status-change', (data: ProductStatusData) => {
      console.log('Product status change received:', data);
      statusChangeHandler?.(data);
    });

    socket.on('connection-status', (data: { status: 'connected' | 'disconnected' }) => {
      console.log('Connection status received:', data);
      connectionStatusHandler?.(data);
    });

  }, [userId, reconnection, reconnectionAttempts, reconnectionDelay, socketState.reconnectAttempts, priceUpdateHandler, statusChangeHandler, connectionStatusHandler]);

  // Disconnect socket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setSocketState({
      connected: false,
      connecting: false,
      error: null,
      reconnectAttempts: 0,
    });
  }, []);

  // Subscribe to product updates
  const subscribeToProduct = useCallback((productId: string) => {
    if (!socketRef.current?.connected) {
      console.warn('Socket not connected, cannot subscribe to product');
      return;
    }

    socketRef.current.emit('subscribe-product', productId);
    subscribedProductsRef.current.add(productId);
    console.log(`Subscribed to product: ${productId}`);
  }, []);

  // Unsubscribe from product updates
  const unsubscribeFromProduct = useCallback((productId: string) => {
    if (!socketRef.current?.connected) {
      console.warn('Socket not connected, cannot unsubscribe from product');
      return;
    }

    socketRef.current.emit('unsubscribe-product', productId);
    subscribedProductsRef.current.delete(productId);
    console.log(`Unsubscribed from product: ${productId}`);
  }, []);

  // Set event handlers
  const onPriceUpdate = useCallback((handler: (data: PriceUpdateData) => void) => {
    setPriceUpdateHandler(() => handler);
  }, []);

  const onStatusChange = useCallback((handler: (data: ProductStatusData) => void) => {
    setStatusChangeHandler(() => handler);
  }, []);

  const onConnectionStatus = useCallback((handler: (data: { status: 'connected' | 'disconnected' }) => void) => {
    setConnectionStatusHandler(() => handler);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    ...socketState,
    socket: socketRef.current,
    subscribedProducts: Array.from(subscribedProductsRef.current),
    
    // Actions
    connect,
    disconnect,
    subscribeToProduct,
    unsubscribeFromProduct,
    
    // Event handlers
    onPriceUpdate,
    onStatusChange,
    onConnectionStatus,
  };
}