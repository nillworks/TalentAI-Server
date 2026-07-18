import { Router, Response } from 'express';
import { Collection, Document } from 'mongodb';
import { AuthRequest } from '../../types/express.d';
import { verifyToken, requireRole } from '../../middlewares/auth.middleware';
import { sendSuccess, sendError } from '../../utils/response';

export function createRecruiterProfileRoutes(
  recruiterProfileCollection: Collection<Document>,
) {
  const router = Router();

  router.get('/profile', verifyToken, requireRole('recruiter', 'admin'), async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      if (!userId) return sendError(res, 'Unauthorized', 401);

      const profile = await recruiterProfileCollection.findOne({ userId });
      sendSuccess(res, profile || null);
    } catch {
      sendError(res, 'Failed to fetch profile');
    }
  });

  router.put('/profile', verifyToken, requireRole('recruiter', 'admin'), async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      if (!userId) return sendError(res, 'Unauthorized', 401);

      const {
        companyName, companyLogo, companyWebsite, companyDescription,
        companyLocation, industry, companySize, phone,
      } = req.body;

      if (!companyName) return sendError(res, 'companyName is required', 400);

      const updateData: Record<string, any> = {
        userId,
        companyName,
        companyLogo: companyLogo || '',
        companyWebsite: companyWebsite || '',
        companyDescription: companyDescription || '',
        companyLocation: companyLocation || '',
        industry: industry || '',
        companySize: companySize || '',
        phone: phone || '',
        updatedAt: new Date(),
      };

      const existing = await recruiterProfileCollection.findOne({ userId });

      if (existing) {
        await recruiterProfileCollection.updateOne(
          { userId },
          { $set: updateData },
        );
      } else {
        updateData.createdAt = new Date();
        await recruiterProfileCollection.insertOne(updateData);
      }

      sendSuccess(res, { message: 'Profile updated' });
    } catch {
      sendError(res, 'Failed to update profile');
    }
  });

  return router;
}
