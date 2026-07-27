import { Router, Response } from 'express';
import { ObjectId, Collection, Document } from 'mongodb';
import { AuthRequest } from '../../types/express.d.js';
import { verifyToken } from '../../middlewares/auth.middleware.js';
import { sendSuccess, sendError, sendPaginated } from '../../utils/response.js';

export function createUserRoutes(
  userCollection: Collection<Document>,
) {
  const router = Router();

  router.get('/',  async (req: AuthRequest, res: Response) => {
    try {
      const {
        page = '1',
        limit = '10',
        search,
      } = req.query as Record<string, string>;

      const pageNum = Number(page);
      const limitNum = Number(limit);

      const query: Record<string, any> = {};

      if (search) {
        query.$or = [
          { name: { $regex: new RegExp(search, 'i') } },
          { email: { $regex: new RegExp(search, 'i') } },
        ];
      }

      const skip = (pageNum - 1) * limitNum;

      const users = await userCollection
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .toArray();

      const total = await userCollection.countDocuments(query);
      sendPaginated(res, users, total, pageNum, limitNum);
    } catch {
      sendError(res, 'Failed to fetch users');
    }
  });

  router.get('/:id', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
      const id = String(req.params.id);

      if (!ObjectId.isValid(id)) {
        return sendError(res, 'Invalid user ID', 400);
      }

      const user = await userCollection.findOne({ _id: new ObjectId(id) });
      if (!user) return sendError(res, 'User not found', 404);

      sendSuccess(res, user);
    } catch {
      sendError(res, 'Failed to fetch user');
    }
  });

  return router;
}
