import { Router, Response } from 'express';
import { ObjectId, Collection, Document } from 'mongodb';
import { AuthRequest } from '../../types/express.d';
import { verifyToken } from '../../middlewares/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../../utils/response';

export function createApplicationRoutes(
  applicationCollection: Collection<Document>,
  jobCollection: Collection<Document>,
) {
  const router = Router();

  router.post('/', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      if (!userId) return sendError(res, 'Unauthorized', 401);

      const { jobId, resumeUrl, coverLetter } = req.body;
      if (!jobId) return sendError(res, 'jobId is required', 400);

      if (!ObjectId.isValid(jobId)) {
        return sendError(res, 'Invalid job ID', 400);
      }

      const existing = await applicationCollection.findOne({ userId, jobId });
      if (existing) return sendError(res, 'Already applied', 409);

      const application = {
        jobId,
        userId,
        resumeUrl: resumeUrl || '',
        coverLetter: coverLetter || '',
        status: 'pending',
        createdAt: new Date(),
      };

      await applicationCollection.insertOne(application);

      await jobCollection.updateOne(
        { _id: new ObjectId(jobId) },
        { $inc: { applicationCount: 1 } },
      );

      sendSuccess(res, { message: 'Application submitted' }, 201);
    } catch {
      sendError(res, 'Failed to submit application');
    }
  });

  router.get('/my', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      if (!userId) return sendError(res, 'Unauthorized', 401);

      const {
        page = '1',
        limit = '10',
      } = req.query as Record<string, string>;

      const pageNum = Number(page);
      const limitNum = Number(limit);
      const skip = (pageNum - 1) * limitNum;

      const applications = await applicationCollection
        .find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .toArray();

      const total = await applicationCollection.countDocuments({ userId });
      sendPaginated(res, applications, total, pageNum, limitNum);
    } catch {
      sendError(res, 'Failed to fetch applications');
    }
  });

  router.get('/my/:id', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      const id = String(req.params.id);

      if (!ObjectId.isValid(id)) {
        return sendError(res, 'Invalid application ID', 400);
      }

      const application = await applicationCollection.findOne({
        _id: new ObjectId(id),
        userId,
      });

      if (!application) return sendError(res, 'Application not found', 404);
      sendSuccess(res, application);
    } catch {
      sendError(res, 'Failed to fetch application');
    }
  });

  router.delete('/:id', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      const id = String(req.params.id);

      if (!ObjectId.isValid(id)) {
        return sendError(res, 'Invalid application ID', 400);
      }

      const application = await applicationCollection.findOne({
        _id: new ObjectId(id),
        userId,
      });

      if (!application) return sendError(res, 'Application not found', 404);

      await applicationCollection.deleteOne({ _id: new ObjectId(id) });

      await jobCollection.updateOne(
        { _id: new ObjectId(application.jobId) },
        { $inc: { applicationCount: -1 } },
      );

      sendSuccess(res, { message: 'Application withdrawn' });
    } catch {
      sendError(res, 'Failed to withdraw application');
    }
  });

  return router;
}
