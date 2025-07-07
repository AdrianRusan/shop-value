'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { PriceUpdateData, ProductStatusData } from '@/lib/socket-server';
import { motion, AnimatePresence } from 'framer-motion';
import { Howl } from 'howler';

interface NotificationItem {
  id: string;
  type: 'price-update' | 'status-change' | 'connection' | 'system';
  data: PriceUpdateData | ProductStatusData | { status: string } | { message: string };
  timestamp: Date;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

interface RealTimePriceNotificationProps {
  userId?: string;
  subscribedProducts?: string[];
  onPriceUpdate?: (data: PriceUpdateData) => void;
  onStatusChange?: (data: ProductStatusData) => void;
  className?: string;
  enableSound?: boolean;
  enableDesktopNotifications?: boolean;
  maxNotifications?: number;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export function RealTimePriceNotification({
  userId,
  subscribedProducts = [],
  onPriceUpdate,
  onStatusChange,
  className = '',
  enableSound = true,
  enableDesktopNotifications = true,
  maxNotifications = 100,
  position = 'top-right',
}: RealTimePriceNotificationProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'price-update' | 'status-change'>('all');
  const [soundEnabled, setSoundEnabled] = useState(enableSound);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showToastNotification, setShowToastNotification] = useState<NotificationItem | null>(null);

  // Audio notifications
  const soundRef = useRef<{ [key: string]: Howl }>({});
  
  // Initialize audio
  useEffect(() => {
    if (soundEnabled) {
      soundRef.current = {
        priceDown: new Howl({ src: ['/audio/price-down.mp3'], volume: 0.5 }),
        priceUp: new Howl({ src: ['/audio/price-up.mp3'], volume: 0.5 }),
        statusChange: new Howl({ src: ['/audio/notification.mp3'], volume: 0.3 }),
        connection: new Howl({ src: ['/audio/connection.mp3'], volume: 0.3 }),
      };
    }
  }, [soundEnabled]);

  const {
    connected,
    connecting,
    error,
    subscribeToProduct,
    unsubscribeFromProduct,
    onPriceUpdate: handlePriceUpdate,
    onStatusChange: handleStatusChange,
    onConnectionStatus,
    reconnectAttempts,
  } = useSocket({
    userId,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  // Request desktop notification permission
  useEffect(() => {
    if (enableDesktopNotifications && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [enableDesktopNotifications]);

  // Enhanced notification helper
  const addNotification = useCallback((
    type: NotificationItem['type'],
    data: NotificationItem['data'],
    priority: NotificationItem['priority'] = 'medium'
  ) => {
    const notification: NotificationItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type,
      data,
      timestamp: new Date(),
      read: false,
      priority,
    };

    setNotifications(prev => [notification, ...prev.slice(0, maxNotifications - 1)]);
    setUnreadCount(prev => prev + 1);

    // Show toast notification
    setShowToastNotification(notification);
    setTimeout(() => setShowToastNotification(null), 5000);

    // Play sound notification
    if (soundEnabled && soundRef.current) {
      switch (type) {
        case 'price-update':
          const priceData = data as PriceUpdateData;
          soundRef.current[priceData.priceChange < 0 ? 'priceDown' : 'priceUp']?.play();
          break;
        case 'status-change':
          soundRef.current.statusChange?.play();
          break;
        case 'connection':
          soundRef.current.connection?.play();
          break;
      }
    }

    // Desktop notification
    if (enableDesktopNotifications && Notification.permission === 'granted') {
      let title = '';
      let body = '';
      let icon = '/icons/notification.png';

      switch (type) {
        case 'price-update':
          const priceData = data as PriceUpdateData;
          title = 'Price Alert';
          body = `${priceData.productTitle}: ${priceData.newPrice.toFixed(2)} RON (${priceData.priceChange > 0 ? '+' : ''}${priceData.priceChange.toFixed(2)} RON)`;
          icon = priceData.priceChange < 0 ? '/icons/price-down.png' : '/icons/price-up.png';
          break;
        case 'status-change':
          const statusData = data as ProductStatusData;
          title = 'Product Status Update';
          body = `${statusData.productTitle} is now ${statusData.status.replace('_', ' ')}`;
          break;
        case 'connection':
          title = 'Connection Status';
          body = `WebSocket ${(data as { status: string }).status}`;
          break;
      }

      if (title && body) {
        new Notification(title, { body, icon });
      }
    }

    // Auto-mark as read after delay for non-urgent notifications
    if (priority !== 'urgent') {
      setTimeout(() => {
        setNotifications(prev => 
          prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }, 10000);
    }
  }, [soundEnabled, enableDesktopNotifications, maxNotifications]);

  // Setup event handlers
  useEffect(() => {
    handlePriceUpdate((data: PriceUpdateData) => {
      console.log('Price update received:', data);
      const priority = Math.abs(data.priceChangePercent) > 20 ? 'urgent' : 
                      Math.abs(data.priceChangePercent) > 10 ? 'high' : 'medium';
      addNotification('price-update', data, priority);
      onPriceUpdate?.(data);
    });

    handleStatusChange((data: ProductStatusData) => {
      console.log('Status change received:', data);
      const priority = data.status === 'discontinued' ? 'high' : 'medium';
      addNotification('status-change', data, priority);
      onStatusChange?.(data);
    });

    onConnectionStatus((data: { status: 'connected' | 'disconnected' }) => {
      console.log('Connection status changed:', data);
      addNotification('connection', data, 'low');
    });
  }, [handlePriceUpdate, handleStatusChange, onConnectionStatus, onPriceUpdate, onStatusChange, addNotification]);

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

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter(notification => 
      filter === 'all' || notification.type === filter
    );
  }, [notifications, filter]);

  // Mark notifications as read
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => {
        if (n.id === id && !n.read) {
          setUnreadCount(count => Math.max(0, count - 1));
          return { ...n, read: true };
        }
        return n;
      })
    );
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  // Format price change
  const formatPriceChange = useCallback((data: PriceUpdateData) => {
    const change = data.priceChange;
    const changePercent = data.priceChangePercent;
    const isDecrease = change < 0;
    
    return {
      change: Math.abs(change),
      changePercent: Math.abs(changePercent),
      isDecrease,
      color: isDecrease ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      bgColor: isDecrease ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20',
      icon: isDecrease ? '↓' : '↑',
    };
  }, []);

  // Get notification icon
  const getNotificationIcon = useCallback((notification: NotificationItem) => {
    switch (notification.type) {
      case 'price-update':
        const priceData = notification.data as PriceUpdateData;
        return priceData.priceChange < 0 ? '📉' : '📈';
      case 'status-change':
        const statusData = notification.data as ProductStatusData;
        return statusData.status === 'available' ? '✅' : 
               statusData.status === 'out_of_stock' ? '⚠️' : '❌';
      case 'connection':
        return '🔌';
      default:
        return '📢';
    }
  }, []);

  // Get connection status details
  const getConnectionStatus = useCallback(() => {
    if (connected) {
      return {
        status: 'Connected',
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-100 dark:bg-green-900/20',
        icon: '🟢'
      };
    } else if (connecting) {
      return {
        status: `Connecting${reconnectAttempts > 0 ? ` (attempt ${reconnectAttempts})` : ''}...`,
        color: 'text-yellow-600 dark:text-yellow-400',
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
        icon: '🟡'
      };
    } else {
      return {
        status: error ? `Disconnected (${error})` : 'Disconnected',
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-100 dark:bg-red-900/20',
        icon: '🔴'
      };
    }
  }, [connected, connecting, error, reconnectAttempts]);

  // Render notification item
  const renderNotification = useCallback((notification: NotificationItem) => {
    const { type, data, timestamp, read, priority } = notification;

    return (
      <motion.div
        key={notification.id}
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
        className={`p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 ${
          !read ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500' : ''
        } ${priority === 'urgent' ? 'border-l-red-500 bg-red-50 dark:bg-red-900/20' : ''}`}
        onClick={() => markAsRead(notification.id)}
      >
        <div className="flex items-start space-x-3">
          <div className="text-2xl">{getNotificationIcon(notification)}</div>
          
          <div className="flex-1 min-w-0">
            {type === 'price-update' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-gray-900 dark:text-white">
                    Price Update
                  </span>
                  <div className="flex items-center space-x-2">
                    {priority === 'urgent' && (
                      <span className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-xs font-medium rounded-full">
                        URGENT
                      </span>
                    )}
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                  {(data as PriceUpdateData).productTitle}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {(data as PriceUpdateData).newPrice.toFixed(2)} RON
                  </span>
                  {(() => {
                    const priceInfo = formatPriceChange(data as PriceUpdateData);
                    return (
                      <span className={`text-sm font-medium px-2 py-1 rounded-full ${priceInfo.bgColor} ${priceInfo.color}`}>
                        {priceInfo.icon} {priceInfo.change.toFixed(2)} RON 
                        ({priceInfo.changePercent.toFixed(1)}%)
                      </span>
                    );
                  })()}
                </div>
              </div>
            )}

            {type === 'status-change' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-gray-900 dark:text-white">
                    Status Update
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                  {(data as ProductStatusData).productTitle}
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    (data as ProductStatusData).status === 'available'
                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      : (data as ProductStatusData).status === 'out_of_stock'
                      ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                      : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                  }`}>
                    {(data as ProductStatusData).status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              </div>
            )}

            {type === 'connection' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-gray-900 dark:text-white">
                    Connection Status
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    (data as { status: string }).status === 'connected'
                      ? 'bg-green-500'
                      : 'bg-red-500'
                  }`} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {(data as { status: string }).status === 'connected'
                      ? 'Connected to real-time updates'
                      : 'Disconnected from real-time updates'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }, [getNotificationIcon, formatPriceChange, markAsRead]);

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  };

  const connectionStatus = getConnectionStatus();

  return (
    <>
      {/* Toast Notification */}
      <AnimatePresence>
        {showToastNotification && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className={`fixed ${positionClasses[position]} z-50 max-w-sm`}
          >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center space-x-3">
                <div className="text-2xl">{getNotificationIcon(showToastNotification)}</div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {showToastNotification.type === 'price-update' ? 'Price Alert' :
                     showToastNotification.type === 'status-change' ? 'Status Update' : 'Notification'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {showToastNotification.type === 'price-update' && 
                      `${(showToastNotification.data as PriceUpdateData).productTitle} - ${(showToastNotification.data as PriceUpdateData).newPrice.toFixed(2)} RON`
                    }
                    {showToastNotification.type === 'status-change' && 
                      `${(showToastNotification.data as ProductStatusData).productTitle} - ${(showToastNotification.data as ProductStatusData).status}`
                    }
                  </div>
                </div>
                <button
                  onClick={() => setShowToastNotification(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Notification Component */}
      <div className={`relative ${className}`}>
        {!isMinimized && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            {/* Enhanced Connection Status */}
            <div className={`flex items-center justify-between p-3 rounded-lg ${connectionStatus.bgColor} border`}>
              <div className="flex items-center space-x-3">
                <span className="text-lg">{connectionStatus.icon}</span>
                <div>
                  <span className={`text-sm font-medium ${connectionStatus.color}`}>
                    {connectionStatus.status}
                  </span>
                  {subscribedProducts.length > 0 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Tracking {subscribedProducts.length} product{subscribedProducts.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {/* Sound Toggle */}
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`p-2 rounded-full transition-colors ${
                    soundEnabled 
                      ? 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-400' 
                      : 'text-gray-400 bg-gray-100 dark:bg-gray-800'
                  }`}
                  title={soundEnabled ? 'Disable sound' : 'Enable sound'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {soundEnabled ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M9 12a1 1 0 11-2 0 1 1 0 012 0z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    )}
                  </svg>
                </button>

                {/* Minimize Toggle */}
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-2 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 bg-gray-100 dark:bg-gray-800 transition-colors"
                  title="Minimize panel"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Notification Bell - Always Visible */}
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="relative p-3 bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all duration-200 hover:shadow-xl"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-medium"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Enhanced Notifications Panel */}
        <AnimatePresence>
          {showNotifications && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                    Real-time Updates
                  </h3>
                  <div className="flex items-center space-x-2">
                    {unreadCount > 0 && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={markAllAsRead}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                      >
                        Mark all read
                      </motion.button>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={clearAll}
                      className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      Clear all
                    </motion.button>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex space-x-1 bg-white dark:bg-gray-700 rounded-lg p-1">
                  {[
                    { key: 'all', label: 'All', count: notifications.length },
                    { key: 'price-update', label: 'Prices', count: notifications.filter(n => n.type === 'price-update').length },
                    { key: 'status-change', label: 'Status', count: notifications.filter(n => n.type === 'status-change').length },
                  ].map(({ key, label, count }) => (
                    <button
                      key={key}
                      onClick={() => setFilter(key as any)}
                      className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                        filter === key
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      {label} {count > 0 && <span className="ml-1">({count})</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notifications List */}
              <div className="max-h-96 overflow-y-auto">
                <AnimatePresence>
                  {filteredNotifications.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-8 text-center text-gray-500 dark:text-gray-400"
                    >
                      <svg className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <p className="text-sm">No notifications yet</p>
                      <p className="text-xs mt-1">You'll see real-time updates here</p>
                    </motion.div>
                  ) : (
                    filteredNotifications.map(renderNotification)
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}