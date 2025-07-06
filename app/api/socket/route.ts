import { NextRequest, NextResponse } from 'next/server';
import { Server as NetServer } from 'http';
import { SocketManager } from '@/lib/socket-server';

export async function GET(req: NextRequest) {
  try {
    // Get the server instance from the request
    const server = (req as any).socket?.server;
    
    if (!server) {
      return NextResponse.json(
        { error: 'Server not available' },
        { status: 500 }
      );
    }

    // Initialize Socket.IO server
    const socketManager = SocketManager.getInstance();
    const io = socketManager.initialize(server);

    return NextResponse.json({ 
      success: true, 
      message: 'Socket.IO server initialized',
      connectedClients: socketManager.getConnectedClientsCount()
    });
  } catch (error) {
    console.error('Socket.IO initialization error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize Socket.IO server' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, productId, data } = body;

    const socketManager = SocketManager.getInstance();
    const io = socketManager.getIO();

    if (!io) {
      return NextResponse.json(
        { error: 'Socket.IO server not initialized' },
        { status: 500 }
      );
    }

    switch (action) {
      case 'price-update':
        socketManager.emitPriceUpdate(productId, data);
        break;
      case 'status-change':
        socketManager.emitProductStatusChange(productId, data);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Socket.IO API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}