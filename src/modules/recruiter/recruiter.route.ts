import { Router, Response } from 'express';
import { ObjectId, Collection, Document } from 'mongodb';
import { AuthRequest } from '../../types/express.d';
import { verifyToken, requireRole } from '../../middlewares/auth.middleware';
import { sendSuccess, sendError } from '../../utils/response';

export function createRecruiterRoutes(
  jobCollection: Collection<Document>,
  applicationCollection: Collection<Document>,
  recruiterRequestCollection: Collection<Document>,
  userCollection: Collection<Document>,
) {
  const router = Router();

  router.post('/apply', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      const email = req.user?.email;
      if (!userId) return sendError(res, 'Unauthorized', 401);

      const { name, company, userImage } = req.body;
      if (!company) return sendError(res, 'company is required', 400);

      const existing = await recruiterRequestCollection.findOne({ userId });
      if (existing) return sendError(res, 'Request already exists', 409);

      await recruiterRequestCollection.insertOne({
        userId,
        name: name || '',
        email: email || '',
        company,
        userImage: userImage || '',
        status: 'pending',
        createdAt: new Date(),
      });

      sendSuccess(res, { message: 'Recruiter application submitted' }, 201);
    } catch {
      sendError(res, 'Failed to apply as recruiter');
    }
  });

  router.get('/apply/status', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      if (!userId) return sendError(res, 'Unauthorized', 401);

      const request = await recruiterRequestCollection.findOne({ userId });
      sendSuccess(res, { status: request?.status || 'none', rejectionReason: request?.rejectionReason || '' });
    } catch {
      sendError(res, 'Failed to check status');
    }
  });

  router.post('/jobs', verifyToken, requireRole('recruiter', 'admin'), async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      if (!userId) return sendError(res, 'Unauthorized', 401);

      const {
        title, companyName, companyLogo, category, jobType, location,
        salaryMin, salaryMax, deadline, shortDescription, fullDescription,
        requirements, benefits, recruiterId, recruiterName, recruiterImage, recruiterEmail,
      } = req.body;

      if (!title || !companyName || !category || !jobType || !location) {
        return sendError(res, 'Missing required fields', 400);
      }

      const job = {
        title,
        companyName,
        companyLogo: companyLogo || '',
        category,
        jobType,
        location,
        salaryMin: Number(salaryMin) || 0,
        salaryMax: Number(salaryMax) || 0,
        deadline: deadline || '',
        shortDescription: shortDescription || '',
        fullDescription: fullDescription || '',
        requirements: requirements || [],
        benefits: benefits || [],
        postedBy: userId,
        recruiterId: recruiterId || userId,
        recruiterName: recruiterName || req.user?.name || '',
        recruiterImage: recruiterImage || '',
        recruiterEmail: recruiterEmail || req.user?.email || '',
        status: 'pending' as const,
        applicationCount: 0,
        createdAt: new Date(),
      };

      const result = await jobCollection.insertOne(job);
      sendSuccess(res, result, 201);
    } catch {
      sendError(res, 'Failed to create job');
    }
  });

  router.get('/jobs', verifyToken, requireRole('recruiter', 'admin'), async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      if (!userId) return sendError(res, 'Unauthorized', 401);

      const jobs = await jobCollection
        .find({ postedBy: userId })
        .sort({ createdAt: -1 })
        .toArray();

      sendSuccess(res, jobs);
    } catch {
      sendError(res, 'Failed to fetch jobs');
    }
  });

  router.get('/jobs/:id', verifyToken, requireRole('recruiter', 'admin'), async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      const id = String(req.params.id);

      if (!ObjectId.isValid(id)) {
        return sendError(res, 'Invalid job ID', 400);
      }

      const job = await jobCollection.findOne({
        _id: new ObjectId(id),
        postedBy: userId,
      });

      if (!job) return sendError(res, 'Job not found', 404);
      sendSuccess(res, job);
    } catch {
      sendError(res, 'Failed to fetch job');
    }
  });

  router.patch('/jobs/:id', verifyToken, requireRole('recruiter', 'admin'), async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      const id = String(req.params.id);

      if (!ObjectId.isValid(id)) {
        return sendError(res, 'Invalid job ID', 400);
      }

      const updateData = req.body;
      delete updateData._id;
      delete updateData.id;
      updateData.updatedAt = new Date();

      const result = await jobCollection.updateOne(
        { _id: new ObjectId(id), postedBy: userId },
        { $set: updateData },
      );

      if (result.matchedCount === 0) {
        return sendError(res, 'Job not found or unauthorized', 404);
      }

      sendSuccess(res, result);
    } catch {
      sendError(res, 'Failed to update job');
    }
  });

  router.delete('/jobs/:id', verifyToken, requireRole('recruiter', 'admin'), async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      const id = String(req.params.id);

      if (!ObjectId.isValid(id)) {
        return sendError(res, 'Invalid job ID', 400);
      }

      const result = await jobCollection.deleteOne({
        _id: new ObjectId(id),
        postedBy: userId,
      });

      if (result.deletedCount === 0) {
        return sendError(res, 'Job not found or unauthorized', 404);
      }

      sendSuccess(res, { message: 'Job deleted successfully' });
    } catch {
      sendError(res, 'Failed to delete job');
    }
  });

  router.get('/jobs/:jobId/applicants', verifyToken, requireRole('recruiter', 'admin'), async (req: AuthRequest, res: Response) => {
    try {
      const jobId = String(req.params.jobId);

      if (!ObjectId.isValid(jobId)) {
        return sendError(res, 'Invalid job ID', 400);
      }

      const applicants = await applicationCollection
        .find({ jobId })
        .sort({ createdAt: -1 })
        .toArray();

      const applicantsWithUser = await Promise.all(
        applicants.map(async (app) => {
          let user = null;
          if (app.userId && ObjectId.isValid(app.userId)) {
            user = await userCollection.findOne(
              { _id: new ObjectId(app.userId) },
              { projection: { name: 1, email: 1, image: 1 } },
            );
          }
          return { ...app, user };
        }),
      );

      sendSuccess(res, applicantsWithUser);
    } catch {
      sendError(res, 'Failed to fetch applicants');
    }
  });

  router.patch('/applications/:appId/status', verifyToken, requireRole('recruiter', 'admin'), async (req: AuthRequest, res: Response) => {
    try {
      const appId = String(req.params.appId);
      const { status, feedback } = req.body;

      if (!ObjectId.isValid(appId)) {
        return sendError(res, 'Invalid application ID', 400);
      }

      if (!['reviewed', 'accepted', 'rejected'].includes(status)) {
        return sendError(res, 'Invalid status', 400);
      }

      if (status === 'rejected' && (!feedback || !feedback.trim())) {
        return sendError(res, 'Feedback is required when rejecting', 400);
      }

      const updateData: Record<string, unknown> = {
        status,
        updatedAt: new Date(),
      };
      if (feedback && feedback.trim()) {
        updateData.feedback = feedback.trim();
      }

      const result = await applicationCollection.updateOne(
        { _id: new ObjectId(appId) },
        { $set: updateData },
      );

      if (result.matchedCount === 0) {
        return sendError(res, 'Application not found', 404);
      }

      sendSuccess(res, { message: 'Status updated' });
    } catch {
      sendError(res, 'Failed to update status');
    }
  });

  router.get('/analytics/overview', verifyToken, requireRole('recruiter', 'admin'), async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;

      const totalJobs = await jobCollection.countDocuments({ postedBy: userId });

      const jobIds = await jobCollection
        .find({ postedBy: userId })
        .project({ _id: 1 })
        .toArray();

      const ids = jobIds.map((j) => j._id.toString());
      const totalApplications = await applicationCollection.countDocuments({
        jobId: { $in: ids },
      });

      sendSuccess(res, { totalJobs, totalApplications });
    } catch {
      sendError(res, 'Failed to fetch analytics');
    }
  });

  router.get('/analytics/recent-applications', verifyToken, requireRole('recruiter', 'admin'), async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      const limit = Math.min(parseInt(req.query.limit as string) || 3, 20);

      const jobIds = await jobCollection
        .find({ postedBy: userId })
        .project({ _id: 1 })
        .toArray();

      const ids = jobIds.map((j) => j._id.toString());

      if (ids.length === 0) return sendSuccess(res, []);

      const applications = await applicationCollection
        .find({ jobId: { $in: ids } })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      const enriched = await Promise.all(
        applications.map(async (app) => {
          const job = await jobCollection.findOne(
            { _id: new ObjectId(app.jobId) },
            { projection: { title: 1, companyName: 1 } },
          );
          let user = null;
          if (app.userId && ObjectId.isValid(app.userId)) {
            user = await userCollection.findOne(
              { _id: new ObjectId(app.userId) },
              { projection: { name: 1, email: 1, image: 1 } },
            );
          }
          return { ...app, jobTitle: job?.title || '', companyName: job?.companyName || '', user };
        }),
      );

      sendSuccess(res, enriched);
    } catch {
      sendError(res, 'Failed to fetch recent applications');
    }
  });

  return router;
}
