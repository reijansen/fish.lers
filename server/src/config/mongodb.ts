import mongoose from 'mongoose';
import { loadConfig } from './env';

let isConnected = false;

export const connectMongoDB = async (): Promise<void> => {
  if (isConnected) return;
  
  const config = loadConfig();
  
  try {
    await mongoose.connect(config.mongodbUri);
    isConnected = true;
    console.log('✅ MongoDB connected');
  } catch (err: any) {
    console.warn('⚠️  MongoDB connection failed (using Firestore-only mode):', err.message);
    console.warn('   Chat and other Firestore features will work normally.');
  }
};