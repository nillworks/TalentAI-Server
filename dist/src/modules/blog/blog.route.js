import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { sendSuccess, sendError } from '../../utils/response';
export function createBlogRoutes(blogCollection) {
    const router = Router();
    router.get('/', async (req, res) => {
        try {
            const { page = '1', limit = '10' } = req.query;
            const pageNum = Number(page);
            const limitNum = Number(limit);
            const skip = (pageNum - 1) * limitNum;
            const blogs = await blogCollection
                .find()
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .toArray();
            const total = await blogCollection.countDocuments();
            sendSuccess(res, { blogs, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
        }
        catch {
            sendError(res, 'Failed to fetch blogs');
        }
    });
    router.get('/:id', async (req, res) => {
        try {
            const id = String(req.params.id);
            if (!ObjectId.isValid(id))
                return sendError(res, 'Invalid blog ID', 400);
            const blog = await blogCollection.findOne({ _id: new ObjectId(id) });
            if (!blog)
                return sendError(res, 'Blog not found', 404);
            sendSuccess(res, blog);
        }
        catch {
            sendError(res, 'Failed to fetch blog');
        }
    });
    return router;
}
