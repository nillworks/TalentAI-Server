import { Router, Response } from 'express';
import { ObjectId, Collection, Document } from 'mongodb';
import { AuthRequest } from '../../types/express.d';
import { verifyToken, requireRole } from '../../middlewares/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../../utils/response';

export function createAdminRoutes(
  userCollection: Collection<Document>,
  jobCollection: Collection<Document>,
  applicationCollection: Collection<Document>,
  recruiterRequestCollection: Collection<Document>,
  blogCollection: Collection<Document>,
) {
  const router = Router();

  router.get('/users', verifyToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const {
        page = '1',
        limit = '10',
        search,
      } = req.query as Record<string, string>;

      const pageNum = Number(page);
      const limitNum = Number(limit);

      const query: Record<string, any> = {};
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
    } catch {
      sendError(res, 'Failed to fetch users');
    }
  });

  router.patch('/users/:id/block', verifyToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!ObjectId.isValid(id)) return sendError(res, 'Invalid user ID', 400);

      const user = await userCollection.findOne({ _id: new ObjectId(id) });
      if (!user) return sendError(res, 'User not found', 404);

      const result = await userCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { isBlocked: !user.isBlocked } },
      );

      sendSuccess(res, { message: user.isBlocked ? 'User unblocked' : 'User blocked' });
    } catch {
      sendError(res, 'Failed to block/unblock user');
    }
  });

  router.patch('/users/:id/role', verifyToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const id = String(req.params.id);
      const { role } = req.body;

      if (!ObjectId.isValid(id)) return sendError(res, 'Invalid user ID', 400);
      if (!['seeker', 'recruiter', 'admin'].includes(role)) {
        return sendError(res, 'Invalid role', 400);
      }

      const result = await userCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role } },
      );

      if (result.matchedCount === 0) return sendError(res, 'User not found', 404);
      sendSuccess(res, { message: 'Role updated' });
    } catch {
      sendError(res, 'Failed to update role');
    }
  });

  router.delete('/users/:id', verifyToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!ObjectId.isValid(id)) return sendError(res, 'Invalid user ID', 400);

      const result = await userCollection.deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount === 0) return sendError(res, 'User not found', 404);

      sendSuccess(res, { message: 'User deleted' });
    } catch {
      sendError(res, 'Failed to delete user');
    }
  });

  router.get('/jobs', verifyToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const {
        page = '1',
        limit = '10',
        status,
      } = req.query as Record<string, string>;

      const pageNum = Number(page);
      const limitNum = Number(limit);

      const query: Record<string, any> = {};
      if (status && status !== 'all') {
        query.status = status;
      }

      const skip = (pageNum - 1) * limitNum;
      const jobs = await jobCollection.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).toArray();
      const total = await jobCollection.countDocuments(query);
      sendPaginated(res, jobs, total, pageNum, limitNum);
    } catch {
      sendError(res, 'Failed to fetch jobs');
    }
  });

  router.patch('/jobs/:id/approve', verifyToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!ObjectId.isValid(id)) return sendError(res, 'Invalid job ID', 400);

      const result = await jobCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'approved', updatedAt: new Date() } },
      );

      if (result.matchedCount === 0) return sendError(res, 'Job not found', 404);
      sendSuccess(res, { message: 'Job approved' });
    } catch {
      sendError(res, 'Failed to approve job');
    }
  });

  router.patch('/jobs/:id/reject', verifyToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!ObjectId.isValid(id)) return sendError(res, 'Invalid job ID', 400);

      const result = await jobCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'rejected', updatedAt: new Date() } },
      );

      if (result.matchedCount === 0) return sendError(res, 'Job not found', 404);
      sendSuccess(res, { message: 'Job rejected' });
    } catch {
      sendError(res, 'Failed to reject job');
    }
  });

  router.delete('/jobs/:id', verifyToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!ObjectId.isValid(id)) return sendError(res, 'Invalid job ID', 400);

      const result = await jobCollection.deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount === 0) return sendError(res, 'Job not found', 404);

      sendSuccess(res, { message: 'Job deleted' });
    } catch {
      sendError(res, 'Failed to delete job');
    }
  });

  router.get('/recruiter-requests', verifyToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const requests = await recruiterRequestCollection
        .find({ status: 'pending' })
        .sort({ createdAt: -1 })
        .toArray();

      sendSuccess(res, requests);
    } catch {
      sendError(res, 'Failed to fetch recruiter requests');
    }
  });

  router.patch('/recruiter-requests/:id/approve', verifyToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!ObjectId.isValid(id)) return sendError(res, 'Invalid request ID', 400);

      const result = await recruiterRequestCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'approved', updatedAt: new Date() } },
      );

      if (result.matchedCount === 0) return sendError(res, 'Request not found', 404);

      const request = await recruiterRequestCollection.findOne({ _id: new ObjectId(id) });
      if (request) {
        await userCollection.updateOne(
          { userId: request.userId },
          { $set: { role: 'recruiter' } },
        );
      }

      sendSuccess(res, { message: 'Recruiter approved' });
    } catch {
      sendError(res, 'Failed to approve recruiter');
    }
  });

  router.patch('/recruiter-requests/:id/reject', verifyToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!ObjectId.isValid(id)) return sendError(res, 'Invalid request ID', 400);

      const result = await recruiterRequestCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'rejected', updatedAt: new Date() } },
      );

      if (result.matchedCount === 0) return sendError(res, 'Request not found', 404);
      sendSuccess(res, { message: 'Recruiter rejected' });
    } catch {
      sendError(res, 'Failed to reject recruiter');
    }
  });

  router.post('/blog', verifyToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      const { title, content, tags, authorImage, authorRole } = req.body;

      if (!title || !content) return sendError(res, 'title and content are required', 400);

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
    } catch {
      sendError(res, 'Failed to create blog');
    }
  });

  router.get('/blog', verifyToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const { authorRole, search } = req.query as Record<string, string>;

      const query: Record<string, any> = {};
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
    } catch {
      sendError(res, 'Failed to fetch blogs');
    }
  });

  router.patch('/blog/:id', verifyToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!ObjectId.isValid(id)) return sendError(res, 'Invalid blog ID', 400);

      const updateData = req.body;
      delete updateData._id;
      updateData.updatedAt = new Date();

      const result = await blogCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData },
      );

      if (result.matchedCount === 0) return sendError(res, 'Blog not found', 404);
      sendSuccess(res, { message: 'Blog updated' });
    } catch {
      sendError(res, 'Failed to update blog');
    }
  });

  router.delete('/blog/:id', verifyToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!ObjectId.isValid(id)) return sendError(res, 'Invalid blog ID', 400);

      const result = await blogCollection.deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount === 0) return sendError(res, 'Blog not found', 404);

      sendSuccess(res, { message: 'Blog deleted' });
    } catch {
      sendError(res, 'Failed to delete blog');
    }
  });

  router.get('/analytics/overview', verifyToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const totalUsers = await userCollection.countDocuments();
      const totalJobs = await jobCollection.countDocuments();
      const totalApplications = await applicationCollection.countDocuments();
      const totalRecruiters = await recruiterRequestCollection.countDocuments({ status: 'approved' });

      sendSuccess(res, { totalUsers, totalJobs, totalApplications, totalRecruiters });
    } catch {
      sendError(res, 'Failed to fetch analytics');
    }
  });

  return router;
}
