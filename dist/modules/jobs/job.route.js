import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { sendSuccess, sendError, sendPaginated } from '../../utils/response';
export function createJobRoutes(jobCollection, applicationCollection) {
    const router = Router();
    router.get('/', async (req, res) => {
        try {
            const { page = '1', limit = '10', search, type, category, location, sortBy, } = req.query;
            const pageNum = Number(page);
            const limitNum = Number(limit);
            const query = { status: 'approved' };
            if (search) {
                query.$or = [
                    { title: { $regex: new RegExp(search, 'i') } },
                    { companyName: { $regex: new RegExp(search, 'i') } },
                ];
            }
            if (type && type !== 'All') {
                query.jobType = { $regex: new RegExp(`^${type}$`, 'i') };
            }
            if (category && category !== 'All') {
                query.category = { $regex: new RegExp(`^${category}$`, 'i') };
            }
            if (location && location !== 'All') {
                query.location = { $regex: new RegExp(location, 'i') };
            }
            const sortOptions = { createdAt: -1 };
            if (sortBy === 'oldest')
                sortOptions.createdAt = 1;
            if (sortBy === 'applications')
                sortOptions.applicationCount = -1;
            if (sortBy === 'salary_high')
                sortOptions.salaryMax = -1;
            const skip = (pageNum - 1) * limitNum;
            const jobs = await jobCollection
                .find(query)
                .sort(sortOptions)
                .skip(skip)
                .limit(limitNum)
                .toArray();
            const total = await jobCollection.countDocuments(query);
            sendPaginated(res, jobs, total, pageNum, limitNum);
        }
        catch {
            sendError(res, 'Failed to fetch jobs');
        }
    });
    router.get('/featured', async (req, res) => {
        try {
            const limit = parseInt(req.query.limit) || 6;
            const jobs = await jobCollection
                .find({ status: 'approved' })
                .sort({ applicationCount: -1 })
                .limit(limit)
                .toArray();
            sendSuccess(res, jobs);
        }
        catch {
            sendError(res, 'Failed to fetch featured jobs');
        }
    });
    router.get('/:id', async (req, res) => {
        try {
            const id = String(req.params.id);
            if (id === 'featured') {
                return sendError(res, 'Not found', 404);
            }
            if (!ObjectId.isValid(id)) {
                return sendError(res, 'Invalid job ID', 400);
            }
            const job = await jobCollection.findOne({ _id: new ObjectId(id) });
            if (!job)
                return sendError(res, 'Job not found', 404);
            sendSuccess(res, job);
        }
        catch {
            sendError(res, 'Failed to fetch job');
        }
    });
    return router;
}
