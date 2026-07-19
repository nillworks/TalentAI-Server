import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { verifyToken, requireRole } from '../../middlewares/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../../utils/response';
import { PLANS } from '../payments/planConfig';
export function createAdminRoutes(userCollection, jobCollection, applicationCollection, recruiterRequestCollection, blogCollection, plansCollection) {
    const router = Router();
    router.get('/users', verifyToken, requireRole('admin'), async (req, res) => {
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
            const users = await userCollection.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).toArray();
            const total = await userCollection.countDocuments(query);
            sendPaginated(res, users, total, pageNum, limitNum);
        }
        catch {
            sendError(res, 'Failed to fetch users');
        }
    });
    router.patch('/users/:id/block', verifyToken, requireRole('admin'), async (req, res) => {
        try {
            const id = String(req.params.id);
            if (!ObjectId.isValid(id))
                return sendError(res, 'Invalid user ID', 400);
            const user = await userCollection.findOne({ _id: new ObjectId(id) });
            if (!user)
                return sendError(res, 'User not found', 404);
            const result = await userCollection.updateOne({ _id: new ObjectId(id) }, { $set: { isBlocked: !user.isBlocked } });
            sendSuccess(res, { message: user.isBlocked ? 'User unblocked' : 'User blocked' });
        }
        catch {
            sendError(res, 'Failed to block/unblock user');
        }
    });
    router.patch('/users/:id/role', verifyToken, requireRole('admin'), async (req, res) => {
        try {
            const id = String(req.params.id);
            const { role } = req.body;
            if (!ObjectId.isValid(id))
                return sendError(res, 'Invalid user ID', 400);
            if (!['seeker', 'recruiter', 'admin'].includes(role)) {
                return sendError(res, 'Invalid role', 400);
            }
            const result = await userCollection.updateOne({ _id: new ObjectId(id) }, { $set: { role } });
            if (result.matchedCount === 0)
                return sendError(res, 'User not found', 404);
            sendSuccess(res, { message: 'Role updated' });
        }
        catch {
            sendError(res, 'Failed to update role');
        }
    });
    router.delete('/users/:id', verifyToken, requireRole('admin'), async (req, res) => {
        try {
            const id = String(req.params.id);
            if (!ObjectId.isValid(id))
                return sendError(res, 'Invalid user ID', 400);
            const result = await userCollection.deleteOne({ _id: new ObjectId(id) });
            if (result.deletedCount === 0)
                return sendError(res, 'User not found', 404);
            sendSuccess(res, { message: 'User deleted' });
        }
        catch {
            sendError(res, 'Failed to delete user');
        }
    });
    router.get('/jobs', verifyToken, requireRole('admin'), async (req, res) => {
        try {
            const { page = '1', limit = '10', status, } = req.query;
            const pageNum = Number(page);
            const limitNum = Number(limit);
            const query = {};
            if (status && status !== 'all') {
                query.status = status;
            }
            const skip = (pageNum - 1) * limitNum;
            const jobs = await jobCollection.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).toArray();
            const total = await jobCollection.countDocuments(query);
            sendPaginated(res, jobs, total, pageNum, limitNum);
        }
        catch {
            sendError(res, 'Failed to fetch jobs');
        }
    });
    router.patch('/jobs/:id/approve', verifyToken, requireRole('admin'), async (req, res) => {
        try {
            const id = String(req.params.id);
            if (!ObjectId.isValid(id))
                return sendError(res, 'Invalid job ID', 400);
            const result = await jobCollection.updateOne({ _id: new ObjectId(id) }, { $set: { status: 'approved', updatedAt: new Date() } });
            if (result.matchedCount === 0)
                return sendError(res, 'Job not found', 404);
            sendSuccess(res, { message: 'Job approved' });
        }
        catch {
            sendError(res, 'Failed to approve job');
        }
    });
    router.patch('/jobs/:id/reject', verifyToken, requireRole('admin'), async (req, res) => {
        try {
            const id = String(req.params.id);
            if (!ObjectId.isValid(id))
                return sendError(res, 'Invalid job ID', 400);
            const result = await jobCollection.updateOne({ _id: new ObjectId(id) }, { $set: { status: 'rejected', updatedAt: new Date() } });
            if (result.matchedCount === 0)
                return sendError(res, 'Job not found', 404);
            sendSuccess(res, { message: 'Job rejected' });
        }
        catch {
            sendError(res, 'Failed to reject job');
        }
    });
    router.delete('/jobs/:id', verifyToken, requireRole('admin'), async (req, res) => {
        try {
            const id = String(req.params.id);
            if (!ObjectId.isValid(id))
                return sendError(res, 'Invalid job ID', 400);
            const result = await jobCollection.deleteOne({ _id: new ObjectId(id) });
            if (result.deletedCount === 0)
                return sendError(res, 'Job not found', 404);
            sendSuccess(res, { message: 'Job deleted' });
        }
        catch {
            sendError(res, 'Failed to delete job');
        }
    });
    router.get('/recruiter-requests', verifyToken, requireRole('admin'), async (req, res) => {
        try {
            const { status, search } = req.query;
            const query = {};
            if (status && status !== 'all') {
                query.status = status;
            }
            if (search) {
                query.$or = [
                    { name: { $regex: new RegExp(search, 'i') } },
                    { email: { $regex: new RegExp(search, 'i') } },
                    { company: { $regex: new RegExp(search, 'i') } },
                ];
            }
            const requests = await recruiterRequestCollection
                .find(query)
                .sort({ createdAt: -1 })
                .toArray();
            sendSuccess(res, requests);
        }
        catch {
            sendError(res, 'Failed to fetch recruiter requests');
        }
    });
    router.patch('/recruiter-requests/:id/approve', verifyToken, requireRole('admin'), async (req, res) => {
        try {
            const id = String(req.params.id);
            if (!ObjectId.isValid(id))
                return sendError(res, 'Invalid request ID', 400);
            const result = await recruiterRequestCollection.updateOne({ _id: new ObjectId(id) }, { $set: { status: 'approved', updatedAt: new Date() } });
            if (result.matchedCount === 0)
                return sendError(res, 'Request not found', 404);
            const request = await recruiterRequestCollection.findOne({ _id: new ObjectId(id) });
            if (request) {
                await userCollection.updateOne({ userId: request.userId }, { $set: { role: 'recruiter', plan: 'recruiter_free' } });
            }
            sendSuccess(res, { message: 'Recruiter approved' });
        }
        catch {
            sendError(res, 'Failed to approve recruiter');
        }
    });
    router.patch('/recruiter-requests/:id/reject', verifyToken, requireRole('admin'), async (req, res) => {
        try {
            const id = String(req.params.id);
            const { rejectionReason } = req.body;
            if (!ObjectId.isValid(id))
                return sendError(res, 'Invalid request ID', 400);
            const result = await recruiterRequestCollection.updateOne({ _id: new ObjectId(id) }, { $set: { status: 'rejected', rejectionReason: rejectionReason || '', updatedAt: new Date() } });
            if (result.matchedCount === 0)
                return sendError(res, 'Request not found', 404);
            const request = await recruiterRequestCollection.findOne({ _id: new ObjectId(id) });
            if (request) {
                await userCollection.updateOne({ userId: request.userId }, { $set: { role: 'seeker', plan: 'free_seeker' } });
            }
            sendSuccess(res, { message: 'Recruiter rejected' });
        }
        catch {
            sendError(res, 'Failed to reject recruiter');
        }
    });
    router.post('/blog', verifyToken, requireRole('admin'), async (req, res) => {
        try {
            const userId = req.user?.sub;
            const { title, content, tags, authorImage, authorRole } = req.body;
            if (!title || !content)
                return sendError(res, 'title and content are required', 400);
            const blog = {
                title,
                content,
                authorId: userId,
                authorName: req.user?.name || '',
                authorImage: authorImage || '',
                authorRole: authorRole || req.user?.role || 'admin',
                tags: tags || [],
                createdAt: new Date(),
            };
            const result = await blogCollection.insertOne(blog);
            sendSuccess(res, result, 201);
        }
        catch {
            sendError(res, 'Failed to create blog');
        }
    });
    router.get('/blog', verifyToken, requireRole('admin'), async (req, res) => {
        try {
            const { authorRole, search } = req.query;
            const query = {};
            if (authorRole && authorRole !== 'all') {
                query.authorRole = authorRole;
            }
            if (search) {
                query.$or = [
                    { title: { $regex: new RegExp(search, 'i') } },
                    { authorName: { $regex: new RegExp(search, 'i') } },
                ];
            }
            const blogs = await blogCollection.find(query).sort({ createdAt: -1 }).toArray();
            sendSuccess(res, blogs);
        }
        catch {
            sendError(res, 'Failed to fetch blogs');
        }
    });
    router.patch('/blog/:id', verifyToken, requireRole('admin'), async (req, res) => {
        try {
            const id = String(req.params.id);
            if (!ObjectId.isValid(id))
                return sendError(res, 'Invalid blog ID', 400);
            const updateData = req.body;
            delete updateData._id;
            updateData.updatedAt = new Date();
            const result = await blogCollection.updateOne({ _id: new ObjectId(id) }, { $set: updateData });
            if (result.matchedCount === 0)
                return sendError(res, 'Blog not found', 404);
            sendSuccess(res, { message: 'Blog updated' });
        }
        catch {
            sendError(res, 'Failed to update blog');
        }
    });
    router.delete('/blog/:id', verifyToken, requireRole('admin'), async (req, res) => {
        try {
            const id = String(req.params.id);
            if (!ObjectId.isValid(id))
                return sendError(res, 'Invalid blog ID', 400);
            const result = await blogCollection.deleteOne({ _id: new ObjectId(id) });
            if (result.deletedCount === 0)
                return sendError(res, 'Blog not found', 404);
            sendSuccess(res, { message: 'Blog deleted' });
        }
        catch {
            sendError(res, 'Failed to delete blog');
        }
    });
    router.get('/analytics/overview', verifyToken, requireRole('admin'), async (req, res) => {
        try {
            const totalUsers = await userCollection.countDocuments();
            const totalJobs = await jobCollection.countDocuments();
            const totalApplications = await applicationCollection.countDocuments();
            const totalRecruiters = await recruiterRequestCollection.countDocuments({ status: 'approved' });
            sendSuccess(res, { totalUsers, totalJobs, totalApplications, totalRecruiters });
        }
        catch {
            sendError(res, 'Failed to fetch analytics');
        }
    });
    // ─── Plans CRUD ───────────────────────────────────────────────────
    // GET /api/admin/plans — list all plans from DB (seed if empty)
    router.get('/plans', verifyToken, requireRole('admin'), async (_req, res) => {
        try {
            const count = await plansCollection.countDocuments();
            if (count === 0) {
                const seed = PLANS.map((p) => ({ ...p, createdAt: new Date(), updatedAt: new Date() }));
                await plansCollection.insertMany(seed);
            }
            const plans = await plansCollection.find().sort({ role: 1, price: 1 }).toArray();
            sendSuccess(res, plans);
        }
        catch {
            sendError(res, 'Failed to fetch plans');
        }
    });
    // GET /api/admin/plans/:id — get single plan
    router.get('/plans/:id', verifyToken, requireRole('admin'), async (req, res) => {
        try {
            const { id } = req.params;
            const plan = await plansCollection.findOne({ _id: new ObjectId(id) });
            if (!plan)
                return sendError(res, 'Plan not found', 404);
            sendSuccess(res, plan);
        }
        catch {
            sendError(res, 'Failed to fetch plan');
        }
    });
    // POST /api/admin/plans — create new plan
    router.post('/plans', verifyToken, requireRole('admin'), async (req, res) => {
        try {
            const { id: planId, name, description, price, priceLabel, interval, role, features, limits, stripePriceId, isFree, } = req.body;
            if (!planId || !name || !role) {
                return sendError(res, 'id, name, and role are required', 400);
            }
            const exists = await plansCollection.findOne({ id: planId });
            if (exists)
                return sendError(res, 'Plan with this id already exists', 400);
            const plan = {
                id: planId,
                name,
                description: description || '',
                price: price || 0,
                priceLabel: priceLabel || 'Free',
                interval: interval || 'month',
                role,
                features: features || [],
                limits: limits || {},
                stripePriceId: stripePriceId || '',
                isFree: isFree ?? true,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            const result = await plansCollection.insertOne(plan);
            sendSuccess(res, { ...plan, _id: result.insertedId }, 201);
        }
        catch {
            sendError(res, 'Failed to create plan');
        }
    });
    // PATCH /api/admin/plans/:id — update plan
    router.patch('/plans/:id', verifyToken, requireRole('admin'), async (req, res) => {
        try {
            const { id } = req.params;
            if (!ObjectId.isValid(id))
                return sendError(res, 'Invalid plan ID', 400);
            const updateData = { ...req.body };
            delete updateData._id;
            delete updateData.createdAt;
            updateData.updatedAt = new Date();
            const result = await plansCollection.updateOne({ _id: new ObjectId(id) }, { $set: updateData });
            if (result.matchedCount === 0)
                return sendError(res, 'Plan not found', 404);
            sendSuccess(res, { message: 'Plan updated' });
        }
        catch {
            sendError(res, 'Failed to update plan');
        }
    });
    // DELETE /api/admin/plans/:id — delete plan
    router.delete('/plans/:id', verifyToken, requireRole('admin'), async (req, res) => {
        try {
            const { id } = req.params;
            if (!ObjectId.isValid(id))
                return sendError(res, 'Invalid plan ID', 400);
            const result = await plansCollection.deleteOne({ _id: new ObjectId(id) });
            if (result.deletedCount === 0)
                return sendError(res, 'Plan not found', 404);
            sendSuccess(res, { message: 'Plan deleted' });
        }
        catch {
            sendError(res, 'Failed to delete plan');
        }
    });
    // POST /api/admin/plans/seed — reseed plans from defaults
    router.post('/plans/seed', verifyToken, requireRole('admin'), async (_req, res) => {
        try {
            await plansCollection.deleteMany({});
            const seed = PLANS.map((p) => ({ ...p, createdAt: new Date(), updatedAt: new Date() }));
            await plansCollection.insertMany(seed);
            sendSuccess(res, { message: 'Plans reseeded', count: seed.length });
        }
        catch {
            sendError(res, 'Failed to reseed plans');
        }
    });
    return router;
}
