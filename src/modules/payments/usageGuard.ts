import { Response, NextFunction } from 'express';
import { Collection, Document } from 'mongodb';
import { AuthRequest } from '../../types/express.d';
import { sendError } from '../../utils/response';

export const checkApplicationLimit = (
  applicationCollection: Collection<Document>,
  plansCollection: Collection<Document>,
) => {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.sub;
      const planId = (req.user as any)?.plan;

      if (!userId || !planId) {
        next();
        return;
      }

      const plan = await plansCollection.findOne({ id: planId });
      const maxApplications = plan?.limits?.maxApplications || 0;
      if (!maxApplications) {
        next();
        return;
      }

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const count = await applicationCollection.countDocuments({
        userId,
        createdAt: { $gte: startOfMonth },
      });

      if (count >= maxApplications) {
        sendError(
          res,
          `Application limit reached for your plan. You've used ${count}/${maxApplications} this month. Upgrade your plan for more.`,
          403,
        );
        return;
      }

      (req as any).usageCount = count;
      (req as any).usageLimit = maxApplications;
      next();
    } catch {
      next();
    }
  };
};

export const checkJobPostLimit = (
  jobCollection: Collection<Document>,
  plansCollection: Collection<Document>,
) => {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.sub;
      const planId = (req.user as any)?.plan;

      if (!userId || !planId) {
        next();
        return;
      }

      const plan = await plansCollection.findOne({ id: planId });
      const maxJobPosts = plan?.limits?.maxJobPosts || 0;
      if (!maxJobPosts) {
        next();
        return;
      }

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const count = await jobCollection.countDocuments({
        recruiterId: userId,
        createdAt: { $gte: startOfMonth },
      });

      if (count >= maxJobPosts) {
        sendError(
          res,
          `Job post limit reached for your plan. You've used ${count}/${maxJobPosts} this month. Upgrade your plan for more.`,
          403,
        );
        return;
      }

      (req as any).usageCount = count;
      (req as any).usageLimit = maxJobPosts;
      next();
    } catch {
      next();
    }
  };
};
