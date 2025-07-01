import mongoose from 'mongoose';
import { redis } from './upstash';

// Add Node.js types
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      MONGODB_URI?: string;
    }
  }
}

let isConnected = false;
let connectionAttempts = 0;

// Enhanced connection options for production SaaS scale
const mongoOptions: mongoose.ConnectOptions = {
  // Connection pooling optimized for SaaS workloads
  maxPoolSize: process.env.NODE_ENV === 'production' ? 20 : 10, // Increased for production
  minPoolSize: process.env.NODE_ENV === 'production' ? 5 : 2,   // Maintain minimum connections
  serverSelectionTimeoutMS: 8000, // Increased for better reliability
  socketTimeoutMS: 60000, // 1 minute for long operations
  maxIdleTimeMS: 30000, // Close idle connections
  connectTimeoutMS: 10000, // Connection timeout
  
  // Retry configuration for resilience
  retryWrites: true,
  retryReads: true,
  
  // Compression for bandwidth efficiency
  compressors: ['zlib'],
  
  // Read preference for better performance
  readPreference: 'primary',
  
  // Write concern for data consistency
  writeConcern: {
    w: 'majority',
    j: true, // Journal writes for durability
    wtimeout: 5000
  },
  
  // Buffer settings
  bufferMaxEntries: 0, // Disable mongoose buffering
  bufferCommands: false, // Disable mongoose buffering
};

// Connection state management
interface ConnectionState {
  isConnected: boolean;
  connectionPromise: Promise<typeof mongoose> | null;
  lastConnectedAt: Date | null;
  connectionAttempts: number;
  reconnectionCount: number;
}

const connectionState: ConnectionState = {
  isConnected: false,
  connectionPromise: null,
  lastConnectedAt: null,
  connectionAttempts: 0,
  reconnectionCount: 0
  };

// Enhanced connection function with retry logic
export const connectToDB = async (): Promise<typeof mongoose | null> => {
  // Validate environment variables
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined in environment variables');
    throw new Error('MONGODB_URI is required');
  }

  // Return existing connection if already connected
  if (connectionState.isConnected && mongoose.connection.readyState === 1) {
    console.log('✅ Using existing MongoDB connection');
    return mongoose;
  }

  // Return existing connection promise if one is in progress
  if (connectionState.connectionPromise) {
    console.log('⏳ MongoDB connection in progress, waiting...');
    return connectionState.connectionPromise;
  }

  // Create new connection promise
  connectionState.connectionPromise = connectWithRetry();
  
  try {
    const result = await connectionState.connectionPromise;
    connectionState.connectionPromise = null;
    return result;
  } catch (error) {
    connectionState.connectionPromise = null;
    throw error;
  }
};

// Connection function with retry logic
const connectWithRetry = async (): Promise<typeof mongoose> => {
  const MAX_ATTEMPTS = 5;
  const BASE_DELAY = 2000; // 2 seconds
  
  while (connectionState.connectionAttempts < MAX_ATTEMPTS) {
    try {
      connectionState.connectionAttempts++;
      
      console.log(`🔄 Attempting MongoDB connection (${connectionState.connectionAttempts}/${MAX_ATTEMPTS})`);
      
      // Set mongoose configuration for production
      mongoose.set('strictQuery', true);
      mongoose.set('debug', process.env.NODE_ENV === 'development');
      mongoose.set('bufferCommands', false);
      mongoose.set('bufferMaxEntries', 0);
      
      // Connect to MongoDB
      const mongooseInstance = await mongoose.connect(process.env.MONGODB_URI!, mongoOptions);
      
      // Update connection state
      connectionState.isConnected = true;
      connectionState.lastConnectedAt = new Date();
      connectionState.connectionAttempts = 0;
      
      console.log('✅ Successfully connected to MongoDB');
      console.log(`📊 Connection pool: min=${mongoOptions.minPoolSize}, max=${mongoOptions.maxPoolSize}`);
      console.log(`🏠 Database: ${mongooseInstance.connection.name}`);
      
      return mongooseInstance;
      
    } catch (error) {
      console.error(`🔥 MongoDB connection attempt ${connectionState.connectionAttempts} failed:`, error);
      
      if (connectionState.connectionAttempts >= MAX_ATTEMPTS) {
        console.error('❌ Max connection attempts reached. Could not connect to MongoDB');
        throw new Error(`Failed to connect to MongoDB after ${MAX_ATTEMPTS} attempts`);
      }
      
      // Exponential backoff
      const delay = BASE_DELAY * Math.pow(2, connectionState.connectionAttempts - 1);
      console.log(`⏱️ Retrying connection in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Unable to connect to MongoDB');
};



// Connection event handlers
mongoose.connection.on('connected', () => {
  console.log('🎉 Mongoose connected to MongoDB');
  connectionState.isConnected = true;
  connectionState.lastConnectedAt = new Date();
});

mongoose.connection.on('error', (error: Error) => {
  console.error('🔥 Mongoose connection error:', error);
  connectionState.isConnected = false;
});

mongoose.connection.on('disconnected', () => {
  console.log('📡 Mongoose disconnected from MongoDB');
  connectionState.isConnected = false;
});

mongoose.connection.on('reconnected', () => {
  console.log('🔄 Mongoose reconnected to MongoDB');
  connectionState.isConnected = true;
  connectionState.reconnectionCount++;
  connectionState.lastConnectedAt = new Date();
});

// Graceful shutdown handler (if running in Node.js environment)
if (typeof process !== 'undefined' && process.on) {
  process.on('SIGINT', async () => {
    try {
      console.log('📝 Gracefully shutting down MongoDB connection...');
      await mongoose.connection.close(false);
      console.log('👋 MongoDB connection closed through app termination');
      process.exit(0);
    } catch (error) {
      console.error('Error during MongoDB connection closure:', error);
      process.exit(1);
    }
  });
}

// Health check function
export const checkDBHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy' | 'degraded';
  details: {
    readyState: number;
    host: string;
    port: number;
    name: string;
    collections: number;
    lastConnected: Date | null;
    reconnectionCount: number;
  };
  timestamp: string;
}> => {
  try {
    const connection = mongoose.connection;
    const collections = connection.db ? await connection.db.listCollections().toArray() : [];
    
    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    
    if (connection.readyState !== 1) {
      status = 'unhealthy';
    } else if (connectionState.reconnectionCount > 3) {
      status = 'degraded';
    }
    
    return {
      status,
      details: {
        readyState: connection.readyState,
        host: connection.host || 'unknown',
        port: connection.port || 0,
        name: connection.name || 'unknown',
        collections: collections.length,
        lastConnected: connectionState.lastConnectedAt,
        reconnectionCount: connectionState.reconnectionCount
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      details: {
        readyState: 0,
        host: 'unknown',
        port: 0,
        name: 'unknown',
        collections: 0,
        lastConnected: null,
        reconnectionCount: connectionState.reconnectionCount
      },
      timestamp: new Date().toISOString()
    };
  }
};

// Enhanced database statistics function
export const getDBStats = async () => {
  try {
    if (!connectionState.isConnected) {
      throw new Error('Database not connected');
    }
    
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database instance not available');
    }
    
    const stats = await db.stats();
    
    return {
      database: mongoose.connection.name,
      collections: stats.collections || 0,
      documents: stats.objects || 0,
      dataSize: Math.round((stats.dataSize || 0) / 1024 / 1024 * 100) / 100, // MB
      storageSize: Math.round((stats.storageSize || 0) / 1024 / 1024 * 100) / 100, // MB
      indexes: stats.indexes || 0,
      indexSize: Math.round((stats.indexSize || 0) / 1024 / 1024 * 100) / 100, // MB
      averageObjSize: Math.round(stats.avgObjSize || 0), // bytes
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting database statistics:', error);
    return null;
  }
};

// Connection utilities
export const disconnectDB = async (): Promise<void> => {
  if (connectionState.isConnected) {
    try {
      await mongoose.disconnect();
      connectionState.isConnected = false;
      console.log('🔌 Disconnected from MongoDB');
    } catch (error) {
      console.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  }
};

export const getConnectionState = () => ({
  isConnected: connectionState.isConnected,
  readyState: mongoose.connection.readyState,
  lastConnectedAt: connectionState.lastConnectedAt,
  connectionAttempts: connectionState.connectionAttempts,
  reconnectionCount: connectionState.reconnectionCount
});



// Export for compatibility
export const connectToDatabase = connectToDB;
