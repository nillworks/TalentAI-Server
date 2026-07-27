import { Router, Response } from 'express';
import { Collection, Document } from 'mongodb';
import { AuthRequest } from '../../types/express.d.js';
import { verifyToken } from '../../middlewares/auth.middleware.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export function createSavedJobRoutes(
  savedJobCollection: Collection<Document>,
) {
  const router = Router();

  router.post('/:jobId', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      if (!userId) return sendError(res, 'Unauthorized', 401);

      const jobId = String(req.params.jobId);

      const existing = await savedJobCollection.findOne({ userId, jobId });
      if (existing) {
        await savedJobCollection.deleteOne({ _id: existing._id });
        return sendSuccess(res, { message: 'Job unsaved', saved: false });
      }

      await savedJobCollection.insertOne({
        jobId,
        userId,
        createdAt: new Date(),
      });

      sendSuccess(res, { message: 'Job saved', saved: true }, 201);
    } catch {
      sendError(res, 'Failed to save job');
    }
  });

  router.delete('/:jobId', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      if (!userId) return sendError(res, 'Unauthorized', 401);

      const jobId = String(req.params.jobId);
      const result = await savedJobCollection.deleteOne({ userId, jobId });

      if (result.deletedCount === 0) {
        return sendError(res, 'Not found in saved jobs', 404);
      }

      sendSuccess(res, { message: 'Job removed from saved' });
    } catch {
      sendError(res, 'Failed to remove saved job');
    }
  });

  router.get('/', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      if (!userId) return sendError(res, 'Unauthorized', 401);

      const items = await savedJobCollection
        .find({ userId })
        .sort({ createdAt: -1 })
        .toArray();

      sendSuccess(res, items);
    } catch {
      sendError(res, 'Failed to fetch saved jobs');
    }
  });

  router.get('/check/:jobId', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      if (!userId) return sendError(res, 'Unauthorized', 401);

      const jobId = String(req.params.jobId);
      const existing = await savedJobCollection.findOne({ userId, jobId });
      sendSuccess(res, { saved: !!existing });
    } catch {
      sendError(res, 'Failed to check saved job');
    }
  });

  return router;
}
