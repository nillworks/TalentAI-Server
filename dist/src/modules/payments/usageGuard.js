import { sendError } from '../../utils/response';
export const checkApplicationLimit = (applicationCollection, plansCollection) => {
    return async (req, res, next) => {
        try {
            const userId = req.user?.sub;
            const planId = req.user?.plan;
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
                sendError(res, `Application limit reached for your plan. You've used ${count}/${maxApplications} this month. Upgrade your plan for more.`, 403);
                return;
            }
            req.usageCount = count;
            req.usageLimit = maxApplications;
            next();
        }
        catch {
            next();
        }
    };
};
export const checkJobPostLimit = (jobCollection, plansCollection) => {
    return async (req, res, next) => {
        try {
            const userId = req.user?.sub;
            const planId = req.user?.plan;
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
                sendError(res, `Job post limit reached for your plan. You've used ${count}/${maxJobPosts} this month. Upgrade your plan for more.`, 403);
                return;
            }
            req.usageCount = count;
            req.usageLimit = maxJobPosts;
            next();
        }
        catch {
            next();
        }
    };
};
