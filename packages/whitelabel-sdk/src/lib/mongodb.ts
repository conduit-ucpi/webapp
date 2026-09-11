import { MongoClient, Db } from 'mongodb';

// In-memory store for development/testing
const inMemoryStore: Map<string, any> = new Map();

// MongoDB connection (optional - fallback to in-memory if not configured)
let client: MongoClient | null = null;
let db: Db | null = null;

const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB = process.env.MONGODB_DB || 'shopify-app';

export async function getDatabase(): Promise<Db | null> {
  // Check if MongoDB URI is valid - handle empty strings, whitespace, and placeholder values
  if (!MONGODB_URI ||
      MONGODB_URI === 'undefined' ||
      MONGODB_URI === 'null' ||
      MONGODB_URI.trim() === '' ||
      MONGODB_URI.trim() === ' ' ||
      MONGODB_URI === ' ') {
    return null; // Will use in-memory store
  }

  // Validate URI format
  if (!MONGODB_URI.startsWith('mongodb://') && !MONGODB_URI.startsWith('mongodb+srv://')) {
    console.log('Invalid MongoDB URI format, using in-memory store');
    return null;
  }

  try {
    if (!client) {
      client = new MongoClient(MONGODB_URI);
      await client.connect();
      db = client.db(MONGODB_DB);
      console.log('Connected to MongoDB');
    }
    return db;
  } catch (error) {
    console.error('MongoDB connection failed, using in-memory store:', error);
    return null;
  }
}

// Merchant settings storage interface
export interface MerchantSettings {
  shop: string;
  walletAddress: string;
  payoutDelayDays: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  accessToken?: string; // Shopify access token
}

export async function getMerchantSettings(shop: string): Promise<MerchantSettings | null> {
  const database = await getDatabase();

  if (database) {
    const collection = database.collection<MerchantSettings>('merchant_settings');
    return await collection.findOne({ shop });
  } else {
    // In-memory fallback
    return inMemoryStore.get(`merchant:${shop}`) || null;
  }
}

export async function saveMerchantSettings(settings: MerchantSettings): Promise<void> {
  const database = await getDatabase();

  if (database) {
    const collection = database.collection<MerchantSettings>('merchant_settings');
    await collection.replaceOne(
      { shop: settings.shop },
      settings,
      { upsert: true }
    );
  } else {
    // In-memory fallback
    inMemoryStore.set(`merchant:${settings.shop}`, settings);
  }
}

export async function deleteMerchantSettings(shop: string): Promise<void> {
  const database = await getDatabase();

  if (database) {
    const collection = database.collection<MerchantSettings>('merchant_settings');
    await collection.deleteOne({ shop });
  } else {
    // In-memory fallback
    inMemoryStore.delete(`merchant:${shop}`);
  }
}