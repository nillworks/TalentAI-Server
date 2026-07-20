import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { verifyToken } from '../../middlewares/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../../utils/response';
export function createUserRoutes(userCollection) {
    const router = Router();
    router.get('/', async (req, res) => {
        try {
            const { page = '1', limit = '10', search, } = req.query;
            const pageNum = Number(page);
            const limitNum = Number(limit);
            const query = {};
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
        }
        catch {
            sendError(res, 'Failed to fetch users');
        }
    });
    router.get('/:id', verifyToken, async (req, res) => {
        try {
            const id = String(req.params.id);
            if (!ObjectId.isValid(id)) {
                return sendError(res, 'Invalid user ID', 400);
            }
            const user = await userCollection.findOne({ _id: new ObjectId(id) });
            if (!user)
                return sendError(res, 'User not found', 404);
            sendSuccess(res, user);
        }
        catch {
            sendError(res, 'Failed to fetch user');
        }
    });
    return router;
}
