import { Router } from 'express';
import { verifyToken } from '../../middlewares/auth.middleware';
import { sendSuccess, sendError } from '../../utils/response';
export function createSeekerProfileRoutes(seekerProfileCollection) {
    const router = Router();
    router.get('/profile', verifyToken, async (req, res) => {
        try {
            const userId = req.user?.sub;
            if (!userId)
                return sendError(res, 'Unauthorized', 401);
            const profile = await seekerProfileCollection.findOne({ userId });
            sendSuccess(res, profile || null);
        }
        catch {
            sendError(res, 'Failed to fetch profile');
        }
    });
    router.put('/profile', verifyToken, async (req, res) => {
        try {
            const userId = req.user?.sub;
            if (!userId)
                return sendError(res, 'Unauthorized', 401);
            const { phone, bio, location, resumeUrl, linkedinUrl, portfolioUrl, githubUrl, skills, education, experience, } = req.body;
            const updateData = {
                userId,
                phone: phone || '',
                bio: bio || '',
                location: location || '',
                resumeUrl: resumeUrl || '',
                linkedinUrl: linkedinUrl || '',
                portfolioUrl: portfolioUrl || '',
                githubUrl: githubUrl || '',
                skills: skills || [],
                education: education || [],
                experience: experience || [],
                updatedAt: new Date(),
            };
            const existing = await seekerProfileCollection.findOne({ userId });
            if (existing) {
                await seekerProfileCollection.updateOne({ userId }, { $set: updateData });
            }
            else {
                updateData.createdAt = new Date();
                await seekerProfileCollection.insertOne(updateData);
            }
            sendSuccess(res, { message: 'Profile updated' });
        }
        catch {
            sendError(res, 'Failed to update profile');
        }
    });
    return router;
}
