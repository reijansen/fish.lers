import mongoose from 'mongoose';
import { loadConfig } from './env.js';

let isConnected = false;

export const connectMongoDB = async (): Promise<void> => {
  if (isConnected) return;
  
  const config = loadConfig();
  
  try {
    await mongoose.connect(config.mongodbUri, {
      // Prevent server startup from hanging indefinitely when Mongo is unreachable.
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
    });
    isConnected = true;
    console.log('✅ MongoDB connected');
  } catch (err: any) {
    console.warn('⚠️  MongoDB connection failed (using Firestore-only mode):', err.message);
    console.warn('   Chat and other Firestore features will work normally.');
  }
};
