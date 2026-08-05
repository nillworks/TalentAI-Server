import { Router, Response } from 'express';
import { ObjectId, Collection, Document } from 'mongodb';
import { AuthRequest } from '../../types/express.d.js';
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js';
import { sendSuccess, sendError, sendPaginated } from '../../utils/response.js';

const PUBLIC_USER_FIELDS = {
  name: 1,
  email: 1,
  image: 1,
  role: 1,
  plan: 1,
  isBlocked: 1,
  createdAt: 1,
};

export function createUserRoutes(
  userCollection: Collection<Document>,
) {
  const router = Router();

  router.get('/', verifyToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const {
        page = '1',
        limit = '10',
        search,
      } = req.query as Record<string, string>;

      const pageNum = Math.max(1, Number(page) || 1);
      const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));

      const query: Record<string, any> = {};

      if (search) {
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.$or = [
          { name: { $regex: new RegExp(escaped, 'i') } },
          { email: { $regex: new RegExp(escaped, 'i') } },
        ];
      }

      const skip = (pageNum - 1) * limitNum;

      const users = await userCollection
        .find(query, { projection: PUBLIC_USER_FIELDS })
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

      const user = await userCollection.findOne(
        { _id: new ObjectId(id) },
        { projection: PUBLIC_USER_FIELDS },
      );
      if (!user) return sendError(res, 'User not found', 404);

      sendSuccess(res, user);
    } catch {
      sendError(res, 'Failed to fetch user');
    }
  });

  return router;
}
