import { Router } from 'express';
import { connectDB } from '../config/db';
import { createAuthRoutes } from '../modules/auth/auth.route';
import { createJobRoutes } from '../modules/jobs/job.route';
import { createApplicationRoutes } from '../modules/applications/application.route';
import { createSavedJobRoutes } from '../modules/saved-jobs/savedJob.route';
import { createUserRoutes } from '../modules/users/user.route';
import { createRecruiterRoutes } from '../modules/recruiter/recruiter.route';
import { createAdminRoutes } from '../modules/admin/admin.route';
import { createBlogRoutes } from '../modules/blog/blog.route';
import { createAIRoutes } from '../modules/ai/ai.route';

const router = Router();

const initRoutes = async () => {
  const db = await connectDB();

  const userCollection = db.collection('users');
  const jobCollection = db.collection('jobs');
  const applicationCollection = db.collection('applications');
  const savedJobCollection = db.collection('savedJobs');
  const recruiterRequestCollection = db.collection('recruiterRequests');
  const blogCollection = db.collection('blogs');

  router.use('/auth', createAuthRoutes(userCollection));
  router.use('/jobs', createJobRoutes(jobCollection, applicationCollection));
  router.use('/applications', createApplicationRoutes(applicationCollection, jobCollection));
  router.use('/saved-jobs', createSavedJobRoutes(savedJobCollection));
  router.use('/users', createUserRoutes(userCollection));
  router.use('/recruiter', createRecruiterRoutes(jobCollection, applicationCollection, recruiterRequestCollection));
  router.use('/admin', createAdminRoutes(userCollection, jobCollection, applicationCollection, recruiterRequestCollection, blogCollection));
  router.use('/blog', createBlogRoutes(blogCollection));
  router.use('/ai', createAIRoutes());
};

initRoutes();

export default router;
