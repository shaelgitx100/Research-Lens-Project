import mongoose from 'mongoose';

/**
 * Connect to MongoDB when a URI is configured.
 * The API can still start without MongoDB; database-backed routes should use
 * `isDatabaseConnected` (or return a 503) until the connection is available.
 */
export async function connectDB(uri = process.env.MONGODB_URI): Promise<void> {
  if (!uri) {
    console.warn('MONGODB_URI is not configured; database-backed routes are unavailable.');
    return;
  }

  try {
    await mongoose.connect(uri);
    console.log('MongoDB connected');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`MongoDB unavailable: ${message}`);
  }
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export default mongoose;
