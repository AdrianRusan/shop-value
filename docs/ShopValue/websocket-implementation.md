# WebSocket Real-time Updates Implementation

## Overview

This document describes the implementation of real-time price updates using WebSocket connections in the ShopValue application. The implementation allows users to receive instant notifications when product prices change or product availability status updates.

## Architecture

### Components

1. **Socket Server** (`lib/socket-server.ts`)
   - Singleton pattern for managing Socket.IO server instance
   - Event handling for client connections and subscriptions
   - Room-based subscription management for products and users

2. **API Route** (`app/api/socket/route.ts`)
   - HTTP endpoint for initializing the Socket.IO server
   - REST API for triggering price updates and status changes

3. **React Hook** (`hooks/useSocket.ts`)
   - Custom hook for managing WebSocket connections
   - Automatic reconnection with exponential backoff
   - Event handler management and subscription tracking

4. **UI Component** (`components/RealTimePriceNotification.tsx`)
   - Real-time notification display
   - Connection status indicator
   - Notification management (read/unread, clear all)

## Features

### 1. Connection Management
- Automatic connection on component mount
- Reconnection with exponential backoff strategy
- Connection status indicators
- Graceful disconnection handling

### 2. Room-based Subscriptions
- **User Rooms**: `user:{userId}` - for user-specific notifications
- **Product Rooms**: `product:{productId}` - for product-specific updates
- Automatic subscription management when components mount/unmount

### 3. Event Types

#### Server to Client Events
- `price-update`: Price change notifications
- `product-status-change`: Availability status updates
- `connection-status`: Connection state changes

#### Client to Server Events
- `join-user-room`: Join user-specific room
- `leave-user-room`: Leave user-specific room
- `subscribe-product`: Subscribe to product updates
- `unsubscribe-product`: Unsubscribe from product updates

### 4. Data Structures

```typescript
interface PriceUpdateData {
  productId: string;
  newPrice: number;
  oldPrice: number;
  priceChange: number;
  priceChangePercent: number;
  timestamp: string;
  productTitle: string;
  productUrl: string;
}

interface ProductStatusData {
  productId: string;
  status: 'available' | 'out_of_stock' | 'discontinued';
  timestamp: string;
  productTitle: string;
}
```

## Usage

### Basic Setup

```tsx
import { RealTimePriceNotification } from '@/components/RealTimePriceNotification';

function MyComponent() {
  const handlePriceUpdate = (data: PriceUpdateData) => {
    console.log('Price updated:', data);
    // Handle price update (e.g., update UI, show toast)
  };

  const handleStatusChange = (data: ProductStatusData) => {
    console.log('Status changed:', data);
    // Handle status change
  };

  return (
    <RealTimePriceNotification
      userId="user-123"
      subscribedProducts={['product-1', 'product-2']}
      onPriceUpdate={handlePriceUpdate}
      onStatusChange={handleStatusChange}
      className="fixed top-4 right-4"
    />
  );
}
```

### Advanced Hook Usage

```tsx
import { useSocket } from '@/hooks/useSocket';

function CustomComponent() {
  const {
    connected,
    connecting,
    error,
    subscribeToProduct,
    unsubscribeFromProduct,
    onPriceUpdate,
    onStatusChange,
  } = useSocket({
    userId: 'user-123',
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  useEffect(() => {
    onPriceUpdate((data) => {
      // Custom price update handling
    });

    onStatusChange((data) => {
      // Custom status change handling
    });
  }, [onPriceUpdate, onStatusChange]);

  return (
    <div>
      <div>Status: {connected ? 'Connected' : 'Disconnected'}</div>
      {error && <div>Error: {error}</div>}
    </div>
  );
}
```

## Server-side Integration

### Triggering Price Updates

```typescript
import { SocketManager } from '@/lib/socket-server';

// When a price update is detected
const socketManager = SocketManager.getInstance();
socketManager.emitPriceUpdate(productId, {
  productId,
  newPrice: 1299.99,
  oldPrice: 1399.99,
  priceChange: -100.00,
  priceChangePercent: -7.14,
  timestamp: new Date().toISOString(),
  productTitle: 'Product Name',
  productUrl: 'https://example.com/product',
});
```

### Via API Route

```typescript
// POST /api/socket
const response = await fetch('/api/socket', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'price-update',
    productId: 'product-123',
    data: priceUpdateData,
  }),
});
```

## Configuration

### Environment Variables

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000  # For CORS configuration
```

### Socket.IO Configuration

```typescript
// lib/socket-server.ts
const io = new SocketIOServer(server, {
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
```

## Testing

### Component Testing

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RealTimePriceNotification } from '@/components/RealTimePriceNotification';

// Mock the useSocket hook
jest.mock('@/hooks/useSocket', () => ({
  useSocket: jest.fn(() => ({
    connected: true,
    connecting: false,
    error: null,
    // ... other mock properties
  })),
}));

test('should display price update notifications', async () => {
  render(<RealTimePriceNotification />);
  
  // Test implementation
});
```

### Integration Testing

```typescript
// Test WebSocket connection and message delivery
import { io } from 'socket.io-client';

describe('WebSocket Integration', () => {
  let clientSocket;

  beforeAll((done) => {
    clientSocket = io('http://localhost:3000', {
      path: '/api/socket',
    });
    clientSocket.on('connect', done);
  });

  afterAll(() => {
    clientSocket.close();
  });

  test('should receive price updates', (done) => {
    clientSocket.on('price-update', (data) => {
      expect(data.productId).toBeDefined();
      expect(data.newPrice).toBeGreaterThan(0);
      done();
    });

    // Trigger price update
    clientSocket.emit('subscribe-product', 'test-product');
  });
});
```

## Performance Considerations

### 1. Connection Limits
- Monitor concurrent connections
- Implement connection pooling if needed
- Use Redis adapter for horizontal scaling

### 2. Memory Management
- Limit notification history (default: 50 notifications)
- Clean up event listeners on component unmount
- Implement proper room cleanup

### 3. Network Optimization
- Use binary protocols for large data
- Implement message compression
- Batch multiple updates when possible

## Security

### 1. Authentication
- Validate user tokens before joining user rooms
- Implement rate limiting for subscription requests
- Sanitize all incoming data

### 2. Authorization
- Verify user permissions for product subscriptions
- Implement room-level access controls
- Log suspicious activities

### 3. Data Validation
```typescript
import { z } from 'zod';

const priceUpdateSchema = z.object({
  productId: z.string().min(1),
  newPrice: z.number().positive(),
  oldPrice: z.number().positive(),
  // ... other fields
});
```

## Monitoring

### 1. Connection Metrics
- Track connection count and duration
- Monitor reconnection attempts
- Alert on high disconnection rates

### 2. Message Delivery
- Track message delivery success rates
- Monitor message queue sizes
- Implement dead letter queues for failed messages

### 3. Performance Metrics
```typescript
// Example monitoring
const socketManager = SocketManager.getInstance();
console.log('Connected clients:', socketManager.getConnectedClientsCount());

// Track subscription metrics
const subscribers = await socketManager.getProductSubscribers(productId);
console.log(`Product ${productId} has ${subscribers.length} subscribers`);
```

## Troubleshooting

### Common Issues

1. **Connection Failures**
   - Check CORS configuration
   - Verify Socket.IO path configuration
   - Check firewall settings

2. **Missing Notifications**
   - Verify subscription status
   - Check room membership
   - Validate event emission

3. **Memory Leaks**
   - Ensure proper cleanup of event listeners
   - Monitor connection cleanup
   - Check for circular references

### Debug Mode

```typescript
// Enable debug logging
const socket = io('http://localhost:3000', {
  path: '/api/socket',
  forceNew: true,
  debug: true,
});
```

## Future Enhancements

1. **Message Persistence**
   - Store messages in Redis for offline users
   - Implement message history API

2. **Advanced Filtering**
   - Price threshold-based notifications
   - Category-based subscriptions
   - User preference-based filtering

3. **Mobile Push Notifications**
   - Integrate with Firebase Cloud Messaging
   - Background sync for mobile apps

4. **Analytics Integration**
   - Track user engagement with notifications
   - A/B test notification formats
   - Measure conversion rates

## Dependencies

```json
{
  "socket.io": "^4.7.2",
  "socket.io-client": "^4.7.2",
  "@types/socket.io": "^3.0.2"
}
```

## Conclusion

The WebSocket implementation provides a robust foundation for real-time price updates in the ShopValue application. It includes proper error handling, reconnection logic, and scalable architecture patterns that can support future growth and additional real-time features.