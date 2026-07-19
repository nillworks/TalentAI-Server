import dotenv from 'dotenv';
dotenv.config();

import { MongoClient, ServerApiVersion, Db } from 'mongodb';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import cookieParser from 'cookie-parser';
import { createAuthRoutes } from '../src/modules/auth/auth.route';
import { createJobRoutes } from '../src/modules/jobs/job.route';
import { createApplicationRoutes } from '../src/modules/applications/application.route';
import { createSavedJobRoutes } from '../src/modules/saved-jobs/savedJob.route';
import { createUserRoutes } from '../src/modules/users/user.route';
import { createRecruiterRoutes } from '../src/modules/recruiter/recruiter.route';
import { createAdminRoutes } from '../src/modules/admin/admin.route';
import { createBlogRoutes } from '../src/modules/blog/blog.route';
import { createAIRoutes } from '../src/modules/ai/ai.route';
import { createSeekerProfileRoutes } from '../src/modules/seeker-profile/seekerProfile.route';
import { createRecruiterProfileRoutes } from '../src/modules/recruiter-profile/recruiterProfile.route';
import { createPaymentRoutes } from '../src/modules/payments/payment.route';
import { setUserCollection } from '../src/middlewares/auth.middleware';
import { globalErrorHandler } from '../src/middlewares/error.middleware';

let cachedDb: Db | null = null;
let cachedApp: express.Express | null = null;

async function getDb(): Promise<Db> {
  if (cachedDb) return cachedDb;
  const client = new MongoClient(process.env.MONGODB_URI as string, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
  });
  await client.connect();
  cachedDb = client.db('TalentAI');
  return cachedDb;
}

async function getApp(): Promise<express.Express> {
  if (cachedApp) return cachedApp;

  const db = await getDb();
  const app = express();

  app.use(helmet());
  app.use(mongoSanitize());
  app.use(cookieParser());

  const allowedOrigins = (process.env.CLIENT_URL || '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);

  app.use(express.json({ limit: '10mb' }));
  app.use(
    cors({
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    }),
  );

  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

  const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });
  app.use('/api/ai', aiLimiter);

  app.get('/', (_req, res) => {
    res.json({ success: true, message: 'TalentAI backend is running' });
  });

  const userCollection = db.collection('user');
  setUserCollection(userCollection);
  const jobCollection = db.collection('jobs');
  const applicationCollection = db.collection('applications');
  const savedJobCollection = db.collection('savedJobs');
  const recruiterRequestCollection = db.collection('recruiterRequests');
  const blogCollection = db.collection('blogs');
  const seekerProfileCollection = db.collection('seekerProfiles');
  const recruiterProfileCollection = db.collection('recruiterProfiles');
  const plansCollection = db.collection('plans');
  const subscriptionsCollection = db.collection('subscriptions');

  app.use('/api/auth', createAuthRoutes(userCollection));
  app.use('/api/jobs', createJobRoutes(jobCollection, applicationCollection));
  app.use('/api/applications', createApplicationRoutes(applicationCollection, jobCollection));
  app.use('/api/saved-jobs', createSavedJobRoutes(savedJobCollection));
  app.use('/api/users', createUserRoutes(userCollection));
  app.use('/api/recruiter', createRecruiterRoutes(jobCollection, applicationCollection, recruiterRequestCollection, userCollection));
  app.use('/api/admin', createAdminRoutes(userCollection, jobCollection, applicationCollection, recruiterRequestCollection, blogCollection, plansCollection));
  app.use('/api/blog', createBlogRoutes(blogCollection));
  app.use('/api/ai', createAIRoutes());
  app.use('/api/seeker', createSeekerProfileRoutes(seekerProfileCollection));
  app.use('/api/recruiter-profile', createRecruiterProfileRoutes(recruiterProfileCollection));
  app.use('/api/payments', createPaymentRoutes(userCollection, applicationCollection, jobCollection, plansCollection, subscriptionsCollection));

  app.use(globalErrorHandler);

  cachedApp = app;
  return app;
}

export default async function handler(req: any, res: any) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (err: any) {
    console.error('Handler error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
}
