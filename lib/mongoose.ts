import mongoose from 'mongoose';

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
const MAX_CONNECTION_ATTEMPTS = 5;
const CONNECTION_RETRY_DELAY = 5000; // 5 seconds

// Enhanced connection options for production (compatible with latest MongoDB driver)
const mongoOptions: mongoose.ConnectOptions = {
  // Connection pooling
  maxPoolSize: 10, // Maximum number of connections in the connection pool
  serverSelectionTimeoutMS: 5000, // How long to try selecting a server
  socketTimeoutMS: 45000, // How long a send or receive on a socket can take before timing out
  maxIdleTimeMS: 30000, // Close connections after this many milliseconds of inactivity
  
  // Retry writes
  retryWrites: true,
  retryReads: true,
  
  // Compression
  compressors: ['zlib']
};

// Connection state management
interface ConnectionState {
  isConnected: boolean;
  connectionPromise: Promise<typeof mongoose> | null;
  lastConnectedAt: Date | null;
  connectionAttempts: number;
}

const connectionState: ConnectionState = {
  isConnected: false,
  connectionPromise: null,
  lastConnectedAt: null,
  connectionAttempts: 0
};

// Enhanced connection function with retry logic and monitoring
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
  while (connectionState.connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
    try {
      connectionState.connectionAttempts++;
      
      console.log(`🔄 Attempting MongoDB connection (${connectionState.connectionAttempts}/${MAX_CONNECTION_ATTEMPTS})`);
      
      // Set mongoose configuration
      mongoose.set('strictQuery', true);
      mongoose.set('debug', process.env.NODE_ENV === 'development');
      
      // Connect to MongoDB
      const mongooseInstance = await mongoose.connect(process.env.MONGODB_URI!, mongoOptions);
      
      // Update connection state
      connectionState.isConnected = true;
      connectionState.lastConnectedAt = new Date();
      connectionState.connectionAttempts = 0;
      
      console.log('✅ Successfully connected to MongoDB');
      console.log(`📊 Connection pool size: ${mongoOptions.maxPoolSize}`);
      console.log(`🏠 Database: ${mongooseInstance.connection.name}`);
      
      return mongooseInstance;
      
    } catch (error) {
      console.error(`🔥 MongoDB connection attempt ${connectionState.connectionAttempts} failed:`, error);
      
      if (connectionState.connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
        console.error('❌ Max connection attempts reached. Could not connect to MongoDB');
        throw new Error(`Failed to connect to MongoDB after ${MAX_CONNECTION_ATTEMPTS} attempts`);
      }
      
      // Wait before retrying
      console.log(`⏱️ Retrying connection in ${CONNECTION_RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, CONNECTION_RETRY_DELAY));
    }
  }
  
  throw new Error('Unable to connect to MongoDB');
};

// Connection event handlers
mongoose.connection.on('connected', () => {
  console.log('🎉 Mongoose connected to MongoDB');
  connectionState.isConnected = true;
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
});

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('👋 MongoDB connection closed through app termination');
    process.exit(0);
  } catch (error) {
    console.error('Error during MongoDB connection closure:', error);
    process.exit(1);
  }
});

// Health check function
export const checkDBHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  details: {
    readyState: number;
    host: string;
    port: number;
    name: string;
    collections: number;
    lastConnected: Date | null;
  };
}> => {
  try {
    const connection = mongoose.connection;
    const collections = connection.db ? await connection.db.listCollections().toArray() : [];
    
    return {
      status: connection.readyState === 1 ? 'healthy' : 'unhealthy',
      details: {
        readyState: connection.readyState,
        host: connection.host,
        port: connection.port,
        name: connection.name,
        collections: collections.length,
        lastConnected: connectionState.lastConnectedAt
      }
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
        lastConnected: null
      }
    };
  }
};

// Database statistics function
export const getDBStats = async () => {
  try {
    if (!connectionState.isConnected) {
      throw new Error('Database not connected');
    }
    
    const stats = mongoose.connection.db ? await mongoose.connection.db.stats() : { collections: 0, dataSize: 0, indexSize: 0, objects: 0 };
    return {
      database: mongoose.connection.name,
      collections: stats.collections,
      documents: stats.objects,
      dataSize: Math.round(stats.dataSize / 1024 / 1024 * 100) / 100, // MB
      storageSize: Math.round(stats.storageSize / 1024 / 1024 * 100) / 100, // MB
      indexes: stats.indexes,
      indexSize: Math.round(stats.indexSize / 1024 / 1024 * 100) / 100 // MB
    };
  } catch (error) {
    console.error('Error getting database statistics:', error);
    return null;
  }
};

// Connection utilities
export const disconnectDB = async (): Promise<void> => {
  if (connectionState.isConnected) {
    await mongoose.disconnect();
    connectionState.isConnected = false;
    console.log('🔌 Disconnected from MongoDB');
  }
};

export const getConnectionState = () => ({
  isConnected: connectionState.isConnected,
  readyState: mongoose.connection.readyState,
  lastConnectedAt: connectionState.lastConnectedAt,
  connectionAttempts: connectionState.connectionAttempts
});

// Export for compatibility
export const connectToDatabase = connectToDB;
