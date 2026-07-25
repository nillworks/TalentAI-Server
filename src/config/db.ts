import { MongoClient, Db, ServerApiVersion } from 'mongodb';

let client: MongoClient;
let db: Db;

export const connectDB = async (): Promise<Db> => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not defined in .env');

    client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });

    await client.connect();
    db = client.db('HireMind');
    console.log(`[DB]: MongoDB connected → ${db.databaseName}`);
    return db;
  } catch (error) {
    console.error(`[DB]: Connection failed → ${error}`);
    process.exit(1);
  }
};

export const getDB = (): Db => {
  if (!db) throw new Error('Database not connected yet');
  return db;
};

export const getCollection = (name: string) => {
  return getDB().collection(name);
};

export default connectDB;
