import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import cookieParser from 'cookie-parser';
import { globalErrorHandler } from './middlewares/error.middleware';
import { createAuthRoutes } from './modules/auth/auth.route';
import { createJobRoutes } from './modules/jobs/job.route';
import { createApplicationRoutes } from './modules/applications/application.route';
import { createSavedJobRoutes } from './modules/saved-jobs/savedJob.route';
import { createUserRoutes } from './modules/users/user.route';
import { createRecruiterRoutes } from './modules/recruiter/recruiter.route';
import { createAdminRoutes } from './modules/admin/admin.route';
import { createBlogRoutes } from './modules/blog/blog.route';
import { createAIRoutes } from './modules/ai/ai.route';
import { createSeekerProfileRoutes } from './modules/seeker-profile/seekerProfile.route';
import { createRecruiterProfileRoutes } from './modules/recruiter-profile/recruiterProfile.route';
import { createPaymentRoutes } from './modules/payments/payment.route';
import { setUserCollection } from './middlewares/auth.middleware';
export function createApp(db) {
    const app = express();
    app.use(helmet());
    app.use(mongoSanitize());
    app.use(cookieParser());
    // Stripe webhook needs raw body — mount before express.json()
    app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), (_req, _res, next) => next());
    const allowedOrigins = (process.env.CLIENT_URL || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    app.use(express.json({ limit: '10mb' }));
    app.use(cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
                callback(null, true);
            }
            else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
    }));
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
    return app;
}
