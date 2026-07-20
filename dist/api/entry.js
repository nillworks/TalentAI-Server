import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();
const MONGODB_URI = process.env.MONGODB_URI || '';
const client = new MongoClient(MONGODB_URI, {
    serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true,
    },
});
let cachedDb = null;
let cachedApp = null;
async function getApp() {
    if (cachedApp)
        return cachedApp;
    if (!cachedDb) {
        await client.connect();
        cachedDb = client.db('TalentAI');
    }
    const { createApp } = await import('../src/app.ts');
    const app = createApp(cachedDb);
    cachedApp = app;
    return app;
}
export default async function handler(req, res) {
    try {
        const app = await getApp();
        return app(req, res);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Internal Server Error';
        res.status(500).json({ success: false, message });
    }
}
