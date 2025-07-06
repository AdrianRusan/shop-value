'use client';

import { useEffect, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { PriceUpdateData, ProductStatusData } from '@/lib/socket-server';

interface NotificationItem {
  id: string;
  type: 'price-update' | 'status-change' | 'connection';
  data: PriceUpdateData | ProductStatusData | { status: string };
  timestamp: Date;
  read: boolean;
}

interface RealTimePriceNotificationProps {
  userId?: string;
  subscribedProducts?: string[];
  onPriceUpdate?: (data: PriceUpdateData) => void;
  onStatusChange?: (data: ProductStatusData) => void;
  className?: string;
}

export function RealTimePriceNotification({
  userId,
  subscribedProducts = [],
  onPriceUpdate,
  onStatusChange,
  className = '',
}: RealTimePriceNotificationProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const {
    connected,
    connecting,
    error,
    subscribeToProduct,
    unsubscribeFromProduct,
    onPriceUpdate: handlePriceUpdate,
    onStatusChange: handleStatusChange,
    onConnectionStatus,
  } = useSocket({
    userId,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  // Add notification helper
  const addNotification = (
    type: NotificationItem['type'],
    data: NotificationItem['data']
  ) => {
    const notification: NotificationItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type,
      data,
      timestamp: new Date(),
      read: false,
    };

    setNotifications(prev => [notification, ...prev.slice(0, 49)]); // Keep last 50 notifications
    setUnreadCount(prev => prev + 1);

    // Auto-hide notification after 5 seconds
    setTimeout(() => {
      setNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
      );
    }, 5000);
  };

  // Setup event handlers
  useEffect(() => {
    handlePriceUpdate((data: PriceUpdateData) => {
      console.log('Price update received:', data);
      addNotification('price-update', data);
      onPriceUpdate?.(data);
    });

    handleStatusChange((data: ProductStatusData) => {
      console.log('Status change received:', data);
      addNotification('status-change', data);
      onStatusChange?.(data);
    });

    onConnectionStatus((data: { status: 'connected' | 'disconnected' }) => {
      console.log('Connection status changed:', data);
      addNotification('connection', data);
    });
  }, [handlePriceUpdate, handleStatusChange, onConnectionStatus, onPriceUpdate, onStatusChange]);

  // Subscribe to products when they change
  useEffect(() => {
    if (connected && subscribedProducts.length > 0) {
      subscribedProducts.forEach(productId => {
        subscribeToProduct(productId);
      });
    }

    return () => {
      if (connected && subscribedProducts.length > 0) {
        subscribedProducts.forEach(productId => {
          unsubscribeFromProduct(productId);
        });
      }
    };
  }, [connected, subscribedProducts, subscribeToProduct, unsubscribeFromProduct]);

  // Mark notifications as read
  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => {
        if (n.id === id && !n.read) {
          setUnreadCount(count => Math.max(0, count - 1));
          return { ...n, read: true };
        }
        return n;
      })
    );
  };

  // Mark all as read
  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  // Clear all notifications
  const clearAll = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  // Format price change
  const formatPriceChange = (data: PriceUpdateData) => {
    const change = data.priceChange;
    const changePercent = data.priceChangePercent;
    const isDecrease = change < 0;
    
    return {
      change: Math.abs(change),
      changePercent: Math.abs(changePercent),
      isDecrease,
      color: isDecrease ? 'text-green-600' : 'text-red-600',
      icon: isDecrease ? '↓' : '↑',
    };
  };

  // Render notification item
  const renderNotification = (notification: NotificationItem) => {
    const { type, data, timestamp, read } = notification;

    return (
      <div
        key={notification.id}
        className={`p-3 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${
          !read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
        }`}
        onClick={() => markAsRead(notification.id)}
      >
        {type === 'price-update' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm text-gray-900">
                Price Update
              </span>
              <span className="text-xs text-gray-500">
                {timestamp.toLocaleTimeString()}
              </span>
            </div>
            <div className="text-sm text-gray-700">
              {(data as PriceUpdateData).productTitle}
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-bold">
                {(data as PriceUpdateData).newPrice.toFixed(2)} RON
              </span>
              {(() => {
                const priceInfo = formatPriceChange(data as PriceUpdateData);
                return (
                  <span className={`text-sm font-medium ${priceInfo.color}`}>
                    {priceInfo.icon} {priceInfo.change.toFixed(2)} RON 
                    ({priceInfo.changePercent.toFixed(1)}%)
                  </span>
                );
              })()}
            </div>
          </div>
        )}

        {type === 'status-change' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm text-gray-900">
                Status Change
              </span>
              <span className="text-xs text-gray-500">
                {timestamp.toLocaleTimeString()}
              </span>
            </div>
            <div className="text-sm text-gray-700">
              {(data as ProductStatusData).productTitle}
            </div>
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                (data as ProductStatusData).status === 'available'
                  ? 'bg-green-100 text-green-800'
                  : (data as ProductStatusData).status === 'out_of_stock'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {(data as ProductStatusData).status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>
        )}

        {type === 'connection' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm text-gray-900">
                Connection Status
              </span>
              <span className="text-xs text-gray-500">
                {timestamp.toLocaleTimeString()}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                (data as { status: string }).status === 'connected'
                  ? 'bg-green-500'
                  : 'bg-red-500'
              }`} />
              <span className="text-sm text-gray-700">
                {(data as { status: string }).status === 'connected'
                  ? 'Connected to real-time updates'
                  : 'Disconnected from real-time updates'}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`relative ${className}`}>
      {/* Connection Status Indicator */}
      <div className="flex items-center space-x-2 mb-4">
        <div className={`w-3 h-3 rounded-full ${
          connected ? 'bg-green-500' : connecting ? 'bg-yellow-500' : 'bg-red-500'
        }`} />
        <span className="text-sm text-gray-600">
          {connected ? 'Connected' : connecting ? 'Connecting...' : 'Disconnected'}
        </span>
        {error && (
          <span className="text-sm text-red-600">
            ({error})
          </span>
        )}
      </div>

      {/* Notification Bell */}
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Panel */}
      {showNotifications && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">
                Real-time Updates
              </h3>
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={clearAll}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Clear all
                </button>
              </div>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No notifications yet
              </div>
            ) : (
              notifications.map(renderNotification)
            )}
          </div>
        </div>
      )}
    </div>
  );
}