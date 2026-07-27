import { MongoClient } from 'mongodb';
import { createApp } from '../src/app.js';

let cachedApp: any = null;

export default async function handler(req: any, res: any) {
  if (cachedApp) {
    return cachedApp(req, res);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    res.status(500).json({ success: false, message: 'MONGODB_URI environment variable is not set' });
    return;
  }

  try {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    await client.connect();
    const db = client.db('TalentAI');
    const app = createApp(db);
    cachedApp = app;
    return app(req, res);
  } catch (error: any) {
    console.error('[Vercel Function] MongoDB connection failed:', error);
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
