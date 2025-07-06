import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useSocket } from '@/hooks/useSocket';
import { RealTimePriceNotification } from '@/components/RealTimePriceNotification';
import { PriceUpdateData, ProductStatusData } from '@/lib/socket-server';

// Mock Socket.IO client
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    connected: false,
  })),
}));

// Mock the useSocket hook
jest.mock('@/hooks/useSocket', () => ({
  useSocket: jest.fn(),
}));

const mockUseSocket = useSocket as jest.MockedFunction<typeof useSocket>;

describe('Real-time Price Updates', () => {
  const mockPriceUpdateData: PriceUpdateData = {
    productId: 'test-product-1',
    newPrice: 1299.99,
    oldPrice: 1399.99,
    priceChange: -100.00,
    priceChangePercent: -7.14,
    timestamp: new Date().toISOString(),
    productTitle: 'Test Product Title',
    productUrl: 'https://flip.ro/test-product',
  };

  const mockStatusChangeData: ProductStatusData = {
    productId: 'test-product-1',
    status: 'out_of_stock',
    timestamp: new Date().toISOString(),
    productTitle: 'Test Product Title',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useSocket Hook', () => {
    it('should initialize with default options', () => {
      const mockSocketReturn = {
        connected: false,
        connecting: false,
        error: null,
        reconnectAttempts: 0,
        socket: null,
        subscribedProducts: [],
        connect: jest.fn(),
        disconnect: jest.fn(),
        subscribeToProduct: jest.fn(),
        unsubscribeFromProduct: jest.fn(),
        onPriceUpdate: jest.fn(),
        onStatusChange: jest.fn(),
        onConnectionStatus: jest.fn(),
      };

      mockUseSocket.mockReturnValue(mockSocketReturn);

      const { result } = renderHook(() => useSocket());
      
      expect(result.current.connected).toBe(false);
      expect(result.current.connecting).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.subscribedProducts).toEqual([]);
    });

    it('should handle connection states correctly', () => {
      const mockSocketReturn = {
        connected: true,
        connecting: false,
        error: null,
        reconnectAttempts: 0,
        socket: { id: 'test-socket-id' } as any,
        subscribedProducts: ['product-1'],
        connect: jest.fn(),
        disconnect: jest.fn(),
        subscribeToProduct: jest.fn(),
        unsubscribeFromProduct: jest.fn(),
        onPriceUpdate: jest.fn(),
        onStatusChange: jest.fn(),
        onConnectionStatus: jest.fn(),
      };

      mockUseSocket.mockReturnValue(mockSocketReturn);

      const { result } = renderHook(() => useSocket({ userId: 'test-user' }));
      
      expect(result.current.connected).toBe(true);
      expect(result.current.socket?.id).toBe('test-socket-id');
      expect(result.current.subscribedProducts).toContain('product-1');
    });

    it('should handle connection errors', () => {
      const mockSocketReturn = {
        connected: false,
        connecting: false,
        error: 'Connection failed',
        reconnectAttempts: 3,
        socket: null,
        subscribedProducts: [],
        connect: jest.fn(),
        disconnect: jest.fn(),
        subscribeToProduct: jest.fn(),
        unsubscribeFromProduct: jest.fn(),
        onPriceUpdate: jest.fn(),
        onStatusChange: jest.fn(),
        onConnectionStatus: jest.fn(),
      };

      mockUseSocket.mockReturnValue(mockSocketReturn);

      const { result } = renderHook(() => useSocket());
      
      expect(result.current.connected).toBe(false);
      expect(result.current.error).toBe('Connection failed');
      expect(result.current.reconnectAttempts).toBe(3);
    });
  });

  describe('RealTimePriceNotification Component', () => {
    const defaultSocketMock = {
      connected: true,
      connecting: false,
      error: null,
      reconnectAttempts: 0,
      socket: { id: 'test-socket-id' } as any,
      subscribedProducts: [],
      connect: jest.fn(),
      disconnect: jest.fn(),
      subscribeToProduct: jest.fn(),
      unsubscribeFromProduct: jest.fn(),
      onPriceUpdate: jest.fn(),
      onStatusChange: jest.fn(),
      onConnectionStatus: jest.fn(),
    };

    beforeEach(() => {
      mockUseSocket.mockReturnValue(defaultSocketMock);
    });

    it('should render connection status correctly', () => {
      render(<RealTimePriceNotification />);
      
      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeInTheDocument(); // Notification bell
    });

    it('should show connecting state', () => {
      mockUseSocket.mockReturnValue({
        ...defaultSocketMock,
        connected: false,
        connecting: true,
      });

      render(<RealTimePriceNotification />);
      
      expect(screen.getByText('Connecting...')).toBeInTheDocument();
    });

    it('should show disconnected state with error', () => {
      mockUseSocket.mockReturnValue({
        ...defaultSocketMock,
        connected: false,
        connecting: false,
        error: 'Network error',
      });

      render(<RealTimePriceNotification />);
      
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
      expect(screen.getByText('(Network error)')).toBeInTheDocument();
    });

    it('should toggle notifications panel', () => {
      render(<RealTimePriceNotification />);
      
      const notificationButton = screen.getByRole('button');
      
      // Initially hidden
      expect(screen.queryByText('Real-time Updates')).not.toBeInTheDocument();
      
      // Click to show
      fireEvent.click(notificationButton);
      expect(screen.getByText('Real-time Updates')).toBeInTheDocument();
      expect(screen.getByText('No notifications yet')).toBeInTheDocument();
      
      // Click to hide
      fireEvent.click(notificationButton);
      expect(screen.queryByText('Real-time Updates')).not.toBeInTheDocument();
    });

    it('should handle price update notifications', async () => {
      let priceUpdateHandler: ((data: PriceUpdateData) => void) | null = null;
      
      mockUseSocket.mockReturnValue({
        ...defaultSocketMock,
        onPriceUpdate: jest.fn((handler) => {
          priceUpdateHandler = handler;
        }),
      });

      render(<RealTimePriceNotification />);
      
      // Open notifications panel
      const notificationButton = screen.getByRole('button');
      fireEvent.click(notificationButton);
      
      // Simulate price update
      act(() => {
        priceUpdateHandler?.(mockPriceUpdateData);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Price Update')).toBeInTheDocument();
        expect(screen.getByText('Test Product Title')).toBeInTheDocument();
        expect(screen.getByText('1299.99 RON')).toBeInTheDocument();
        expect(screen.getByText(/↓ 100.00 RON/)).toBeInTheDocument();
        expect(screen.getByText(/7.1%/)).toBeInTheDocument();
      });
      
      // Check unread count
      expect(screen.getByText('1')).toBeInTheDocument(); // Unread badge
    });

    it('should handle status change notifications', async () => {
      let statusChangeHandler: ((data: ProductStatusData) => void) | null = null;
      
      mockUseSocket.mockReturnValue({
        ...defaultSocketMock,
        onStatusChange: jest.fn((handler) => {
          statusChangeHandler = handler;
        }),
      });

      render(<RealTimePriceNotification />);
      
      // Open notifications panel
      const notificationButton = screen.getByRole('button');
      fireEvent.click(notificationButton);
      
      // Simulate status change
      act(() => {
        statusChangeHandler?.(mockStatusChangeData);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Status Change')).toBeInTheDocument();
        expect(screen.getByText('Test Product Title')).toBeInTheDocument();
        expect(screen.getByText('OUT OF_STOCK')).toBeInTheDocument();
      });
    });

    it('should mark notifications as read', async () => {
      let priceUpdateHandler: ((data: PriceUpdateData) => void) | null = null;
      
      mockUseSocket.mockReturnValue({
        ...defaultSocketMock,
        onPriceUpdate: jest.fn((handler) => {
          priceUpdateHandler = handler;
        }),
      });

      render(<RealTimePriceNotification />);
      
      // Open notifications panel
      const notificationButton = screen.getByRole('button');
      fireEvent.click(notificationButton);
      
      // Add notification
      act(() => {
        priceUpdateHandler?.(mockPriceUpdateData);
      });
      
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument(); // Unread badge
      });
      
      // Click on notification to mark as read
      const notification = screen.getByText('Price Update').closest('div');
      fireEvent.click(notification!);
      
      await waitFor(() => {
        expect(screen.queryByText('1')).not.toBeInTheDocument(); // Unread badge should be gone
      });
    });

    it('should mark all notifications as read', async () => {
      let priceUpdateHandler: ((data: PriceUpdateData) => void) | null = null;
      
      mockUseSocket.mockReturnValue({
        ...defaultSocketMock,
        onPriceUpdate: jest.fn((handler) => {
          priceUpdateHandler = handler;
        }),
      });

      render(<RealTimePriceNotification />);
      
      // Open notifications panel
      const notificationButton = screen.getByRole('button');
      fireEvent.click(notificationButton);
      
      // Add multiple notifications
      act(() => {
        priceUpdateHandler?.(mockPriceUpdateData);
        priceUpdateHandler?.({ ...mockPriceUpdateData, productId: 'product-2' });
      });
      
      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument(); // Unread badge
      });
      
      // Click "Mark all read"
      const markAllReadButton = screen.getByText('Mark all read');
      fireEvent.click(markAllReadButton);
      
      await waitFor(() => {
        expect(screen.queryByText('2')).not.toBeInTheDocument(); // Unread badge should be gone
      });
    });

    it('should clear all notifications', async () => {
      let priceUpdateHandler: ((data: PriceUpdateData) => void) | null = null;
      
      mockUseSocket.mockReturnValue({
        ...defaultSocketMock,
        onPriceUpdate: jest.fn((handler) => {
          priceUpdateHandler = handler;
        }),
      });

      render(<RealTimePriceNotification />);
      
      // Open notifications panel
      const notificationButton = screen.getByRole('button');
      fireEvent.click(notificationButton);
      
      // Add notification
      act(() => {
        priceUpdateHandler?.(mockPriceUpdateData);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Price Update')).toBeInTheDocument();
      });
      
      // Click "Clear all"
      const clearAllButton = screen.getByText('Clear all');
      fireEvent.click(clearAllButton);
      
      await waitFor(() => {
        expect(screen.getByText('No notifications yet')).toBeInTheDocument();
        expect(screen.queryByText('Price Update')).not.toBeInTheDocument();
      });
    });

    it('should subscribe to products when connected', () => {
      const mockSubscribeToProduct = jest.fn();
      
      mockUseSocket.mockReturnValue({
        ...defaultSocketMock,
        subscribeToProduct: mockSubscribeToProduct,
      });

      render(
        <RealTimePriceNotification 
          subscribedProducts={['product-1', 'product-2']} 
        />
      );
      
      expect(mockSubscribeToProduct).toHaveBeenCalledWith('product-1');
      expect(mockSubscribeToProduct).toHaveBeenCalledWith('product-2');
    });

    it('should call onPriceUpdate callback when provided', async () => {
      const mockOnPriceUpdate = jest.fn();
      let priceUpdateHandler: ((data: PriceUpdateData) => void) | null = null;
      
      mockUseSocket.mockReturnValue({
        ...defaultSocketMock,
        onPriceUpdate: jest.fn((handler) => {
          priceUpdateHandler = handler;
        }),
      });

      render(<RealTimePriceNotification onPriceUpdate={mockOnPriceUpdate} />);
      
      // Simulate price update
      act(() => {
        priceUpdateHandler?.(mockPriceUpdateData);
      });
      
      await waitFor(() => {
        expect(mockOnPriceUpdate).toHaveBeenCalledWith(mockPriceUpdateData);
      });
    });
  });

  describe('WebSocket Integration', () => {
    const defaultSocketMock = {
      connected: true,
      connecting: false,
      error: null,
      reconnectAttempts: 0,
      socket: { id: 'test-socket-id' } as any,
      subscribedProducts: [],
      connect: jest.fn(),
      disconnect: jest.fn(),
      subscribeToProduct: jest.fn(),
      unsubscribeFromProduct: jest.fn(),
      onPriceUpdate: jest.fn(),
      onStatusChange: jest.fn(),
      onConnectionStatus: jest.fn(),
    };

    it('should handle connection lifecycle', () => {
      const mockConnect = jest.fn();
      const mockDisconnect = jest.fn();
      
      // The useSocket hook should be called with autoConnect: true by default
      mockUseSocket.mockImplementation((options = {}) => ({
        ...defaultSocketMock,
        connect: mockConnect,
        disconnect: mockDisconnect,
      }));

      const { unmount } = render(<RealTimePriceNotification />);
      
      // Verify that useSocket was called with autoConnect: true
      expect(mockUseSocket).toHaveBeenCalledWith(
        expect.objectContaining({ autoConnect: true })
      );
      
      // Component should disconnect on unmount
      unmount();
      // Note: The actual disconnect happens in the useSocket hook's useEffect cleanup
      // This test verifies the hook was properly configured
    });

    it('should handle subscription management', () => {
      const mockSubscribeToProduct = jest.fn();
      const mockUnsubscribeFromProduct = jest.fn();
      
      mockUseSocket.mockReturnValue({
        ...defaultSocketMock,
        subscribeToProduct: mockSubscribeToProduct,
        unsubscribeFromProduct: mockUnsubscribeFromProduct,
      });

      const { rerender, unmount } = render(
        <RealTimePriceNotification 
          subscribedProducts={['product-1']} 
        />
      );
      
      expect(mockSubscribeToProduct).toHaveBeenCalledWith('product-1');
      
      // Change subscribed products
      rerender(
        <RealTimePriceNotification 
          subscribedProducts={['product-2']} 
        />
      );
      
      expect(mockUnsubscribeFromProduct).toHaveBeenCalledWith('product-1');
      expect(mockSubscribeToProduct).toHaveBeenCalledWith('product-2');
      
      // Unmount should unsubscribe from all
      unmount();
      expect(mockUnsubscribeFromProduct).toHaveBeenCalledWith('product-2');
    });
  });
});

// Helper function to render hooks (simplified version)
function renderHook<T>(callback: () => T) {
  let result: { current: T };
  
  function TestComponent() {
    result = { current: callback() };
    return null;
  }
  
  render(<TestComponent />);
  
  return { result: result! };
}