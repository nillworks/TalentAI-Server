import dotenv from 'dotenv';
dotenv.config();
import { MongoClient, ServerApiVersion } from 'mongodb';
import type { Request, Response } from 'express';
import { createApp } from '../src/app';

let cachedApp: any = null;

async function getApp() {
  if (cachedApp) return cachedApp;
  const client = new MongoClient(process.env.MONGODB_URI as string, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
  });
  await client.connect();
  const db = client.db('HireMind');
  const app = createApp(db);
  app.set('trust proxy', 1);
  cachedApp = app;
  return app;
}

export default async function handler(req: Request, res: Response) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (err: any) {
    console.error('Handler error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
}
