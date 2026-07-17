import { Router, Response } from 'express';
import { Collection, Document } from 'mongodb';
import { AuthRequest } from '../../types/express.d';
import { verifyToken } from '../../middlewares/auth.middleware';
import { sendSuccess, sendError } from '../../utils/response';

export function createAuthRoutes(
  userCollection: Collection<Document>,
) {
  const router = Router();

  router.post('/register', async (req, res: Response) => {
    try {
      const { userId, name, email, role } = req.body;

      if (!userId || !email) {
        return sendError(res, 'userId and email are required', 400);
      }

      const existing = await userCollection.findOne({ userId });
      if (existing) {
        return sendSuccess(res, { message: 'User already exists' });
      }

      const user = {
        userId,
        name: name || '',
        email,
        role: role || 'seeker',
        isBlocked: false,
        createdAt: new Date(),
      };

      await userCollection.insertOne(user);
      sendSuccess(res, { message: 'User registered successfully' }, 201);
    } catch {
      sendError(res, 'Failed to register user');
    }
  });

  router.get('/me', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      if (!userId) return sendError(res, 'Unauthorized', 401);

      const user = await userCollection.findOne({ userId });
      if (!user) return sendError(res, 'User not found', 404);

      sendSuccess(res, user);
    } catch {
      sendError(res, 'Failed to fetch user');
    }
  });

  router.get('/jwks', (_req, res: Response) => {
    res.json({ keys: [] });
  });

  return router;
}
