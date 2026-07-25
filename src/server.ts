import dotenv from 'dotenv';
dotenv.config();

import { MongoClient, ServerApiVersion } from 'mongodb';
import { createApp } from './app';

const PORT = process.env.PORT || 5000;

const client = new MongoClient(process.env.MONGODB_URI as string, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

client
  .connect()
  .then(() => {
    const db = client.db('TalentAI');
    console.log(`[DB]: MongoDB connected → ${db.databaseName}`);

    const app = createApp(db);
    app.listen(PORT, () => {
      console.log(`[server]: Running at http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('[DB]: Connection failed →', err);
    process.exit(1);
  });
