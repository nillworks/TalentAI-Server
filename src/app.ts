import express, { Request, Response } from 'express';
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
import { Db } from 'mongodb';

export function createApp(db: Db) {
  const app = express();

  app.use(helmet());
  app.use(mongoSanitize());
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(
    cors({
      origin: process.env.CLIENT_URL,
      credentials: true,
    }),
  );

  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

  const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });
  app.use('/api/ai', aiLimiter);

  app.get('/', (_req: Request, res: Response) => {
    res.json({ success: true, message: 'TalentAI backend is running' });
  });

  const userCollection = db.collection('users');
  const jobCollection = db.collection('jobs');
  const applicationCollection = db.collection('applications');
  const savedJobCollection = db.collection('savedJobs');
  const recruiterRequestCollection = db.collection('recruiterRequests');
  const blogCollection = db.collection('blogs');

  app.use('/api/auth', createAuthRoutes(userCollection));
  app.use('/api/jobs', createJobRoutes(jobCollection, applicationCollection));
  app.use('/api/applications', createApplicationRoutes(applicationCollection, jobCollection));
  app.use('/api/saved-jobs', createSavedJobRoutes(savedJobCollection));
  app.use('/api/users', createUserRoutes(userCollection));
  app.use('/api/recruiter', createRecruiterRoutes(jobCollection, applicationCollection, recruiterRequestCollection));
  app.use('/api/admin', createAdminRoutes(userCollection, jobCollection, applicationCollection, recruiterRequestCollection, blogCollection));
  app.use('/api/blog', createBlogRoutes(blogCollection));
  app.use('/api/ai', createAIRoutes());

  app.use(globalErrorHandler);

  return app;
}
