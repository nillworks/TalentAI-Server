import dotenv from 'dotenv';
dotenv.config();
import { MongoClient, ServerApiVersion } from 'mongodb';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import cookieParser from 'cookie-parser';
import { globalErrorHandler } from '../dist/middlewares/error.middleware.js';
import { createAuthRoutes } from '../dist/modules/auth/auth.route.js';
import { createJobRoutes } from '../dist/modules/jobs/job.route.js';
import { createApplicationRoutes } from '../dist/modules/applications/application.route.js';
import { createSavedJobRoutes } from '../dist/modules/saved-jobs/savedJob.route.js';
import { createUserRoutes } from '../dist/modules/users/user.route.js';
import { createRecruiterRoutes } from '../dist/modules/recruiter/recruiter.route.js';
import { createAdminRoutes } from '../dist/modules/admin/admin.route.js';
import { createBlogRoutes } from '../dist/modules/blog/blog.route.js';
import { createAIRoutes } from '../dist/modules/ai/ai.route.js';
import { createSeekerProfileRoutes } from '../dist/modules/seeker-profile/seekerProfile.route.js';
import { createRecruiterProfileRoutes } from '../dist/modules/recruiter-profile/recruiterProfile.route.js';
import { createPaymentRoutes } from '../dist/modules/payments/payment.route.js';
import { setUserCollection } from '../dist/middlewares/auth.middleware.js';
let cachedDb = null;
let cachedApp = null;
async function getDb() {
    if (cachedDb)
        return cachedDb;
    const client = new MongoClient(process.env.MONGODB_URI, {
        serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
    });
    await client.connect();
    cachedDb = client.db('TalentAI');
    return cachedDb;
}
async function getApp() {
    if (cachedApp)
        return cachedApp;
    const db = await getDb();
    const app = express();
    app.set('trust proxy', 1);
    app.use(helmet());
    app.use(mongoSanitize());
    app.use(cookieParser());
    app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), (_req, _res, next) => next());
    const allowedOrigins = (process.env.CLIENT_URL || '').split(',').map((s) => s.trim()).filter(Boolean);
    app.use(express.json({ limit: '10mb' }));
    app.use(cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin))
                callback(null, true);
            else
                callback(new Error('Not allowed by CORS'));
        },
        credentials: true,
    }));
    app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
    const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });
    app.use('/api/ai', aiLimiter);
    app.get('/', (_req, res) => { res.json({ success: true, message: 'TalentAI backend is running' }); });
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
    const chatCollection = db.collection('chatHistory');
    app.use('/api/auth', createAuthRoutes(userCollection));
    app.use('/api/jobs', createJobRoutes(jobCollection, applicationCollection));
    app.use('/api/applications', createApplicationRoutes(applicationCollection, jobCollection));
    app.use('/api/saved-jobs', createSavedJobRoutes(savedJobCollection));
    app.use('/api/users', createUserRoutes(userCollection));
    app.use('/api/recruiter', createRecruiterRoutes(jobCollection, applicationCollection, recruiterRequestCollection, userCollection));
    app.use('/api/admin', createAdminRoutes(userCollection, jobCollection, applicationCollection, recruiterRequestCollection, blogCollection, plansCollection));
    app.use('/api/blog', createBlogRoutes(blogCollection));
    app.use('/api/ai', createAIRoutes(jobCollection, seekerProfileCollection, chatCollection));
    app.use('/api/seeker', createSeekerProfileRoutes(seekerProfileCollection));
    app.use('/api/recruiter-profile', createRecruiterProfileRoutes(recruiterProfileCollection));
    app.use('/api/payments', createPaymentRoutes(userCollection, applicationCollection, jobCollection, plansCollection, subscriptionsCollection));
    app.use(globalErrorHandler);
    cachedApp = app;
    return app;
}
export default async function handler(req, res) {
    try {
        const app = await getApp();
        return app(req, res);
    }
    catch (err) {
        console.error('Handler error:', err);
        res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
}
