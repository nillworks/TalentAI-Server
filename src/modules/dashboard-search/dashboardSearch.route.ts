import { Router, Response } from 'express';
import { Collection, Document } from 'mongodb';
import { AuthRequest } from '../../types/express.d.js';
import { verifyToken } from '../../middlewares/auth.middleware.js';
import { sendSuccess, sendError } from '../../utils/response.js';

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface SearchItem {
  _id: string;
  label: string;
  sublabel?: string;
  href: string;
}

interface SearchCategory {
  category: string;
  categoryIcon: string;
  items: SearchItem[];
}

export function createDashboardSearchRoutes(
  jobCollection: Collection<Document>,
  userCollection: Collection<Document>,
  applicationCollection: Collection<Document>,
  seekerProfileCollection: Collection<Document>,
  recruiterProfileCollection: Collection<Document>,
  recruiterRequestCollection: Collection<Document>,
  blogCollection: Collection<Document>,
  plansCollection: Collection<Document>,
) {
  const router = Router();

  router.get('/', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
      const { q } = req.query as Record<string, string>;
      if (!q || q.length < 2) return sendSuccess(res, []);

      const escaped = escapeRegex(q);
      const regex = new RegExp(escaped, 'i');
      const userId = req.user?.sub;
      const role = (req.user as any)?.role;

      const results: SearchCategory[] = [];

      if (role === 'seeker') {
        const apps = await applicationCollection.aggregate<Document>([
          { $match: { userId } },
          {
            $lookup: {
              from: 'jobs',
              let: { jid: '$jobId' },
              pipeline: [
                { $match: { $expr: { $eq: [{ $toString: '$_id' }, '$$jid'] } } },
              ],
              as: 'job',
            },
          },
          { $unwind: { path: '$job', preserveNullAndEmptyArrays: true } },
          {
            $match: {
              $or: [
                { 'job.title': { $regex: regex } },
                { 'job.companyName': { $regex: regex } },
                { 'job.category': { $regex: regex } },
                { 'job.location': { $regex: regex } },
              ],
            },
          },
          { $limit: 8 },
        ]).toArray();

        if (apps.length > 0) {
          results.push({
            category: 'Applications',
            categoryIcon: 'FileText',
            items: apps.map((a) => ({
              _id: String(a._id),
              label: a.job?.title || 'Unknown Job',
              sublabel: `${a.job?.companyName || ''} — ${a.status || 'applied'}`,
              href: '/dashboard/seeker/applications',
            })),
          });
        }

        const savedAgg = await applicationCollection.aggregate<Document>([
          { $match: { userId, saved: true } },
          {
            $lookup: {
              from: 'jobs',
              let: { jid: '$jobId' },
              pipeline: [
                { $match: { $expr: { $eq: [{ $toString: '$_id' }, '$$jid'] } } },
              ],
              as: 'job',
            },
          },
          { $unwind: { path: '$job', preserveNullAndEmptyArrays: true } },
          {
            $match: {
              $or: [
                { 'job.title': { $regex: regex } },
                { 'job.companyName': { $regex: regex } },
              ],
            },
          },
          { $limit: 5 },
        ]).toArray();

        if (savedAgg.length > 0) {
          results.push({
            category: 'Saved Jobs',
            categoryIcon: 'Heart',
            items: savedAgg.map((s) => ({
              _id: String(s._id),
              label: s.job?.title || 'Unknown Job',
              sublabel: s.job?.companyName || '',
              href: '/dashboard/seeker/saved-jobs',
            })),
          });
        }
      }

      if (role === 'recruiter') {
        const myJobs = await jobCollection.find({ postedBy: userId }).toArray();

        const matchedJobs = myJobs.filter(
          (j) =>
            regex.test(j.title || '') ||
            regex.test(j.companyName || '') ||
            regex.test(j.category || '') ||
            regex.test(j.location || '') ||
            regex.test(j.status || ''),
        );

        if (matchedJobs.length > 0) {
          results.push({
            category: 'My Jobs',
            categoryIcon: 'Briefcase',
            items: matchedJobs.slice(0, 8).map((j) => ({
              _id: String(j._id),
              label: j.title || 'Untitled',
              sublabel: `${j.companyName || ''} — ${j.status || 'draft'}`,
              href: '/dashboard/recruiter/my-jobs',
            })),
          });
        }

        const myJobIds = myJobs.map((j) => String(j._id));
        if (myJobIds.length > 0) {
          const applicants = await applicationCollection.aggregate<Document>([
            { $match: { jobId: { $in: myJobIds } } },
            {
              $lookup: {
                from: 'jobs',
                let: { jid: '$jobId' },
                pipeline: [
                  { $match: { $expr: { $eq: [{ $toString: '$_id' }, '$$jid'] } } },
                ],
                as: 'job',
              },
            },
            { $unwind: { path: '$job', preserveNullAndEmptyArrays: true } },
            {
              $match: {
                $or: [
                  { 'job.title': { $regex: regex } },
                  { 'job.companyName': { $regex: regex } },
                ],
              },
            },
            { $limit: 8 },
          ]).toArray();

          if (applicants.length > 0) {
            results.push({
              category: 'Applicants',
              categoryIcon: 'Users',
              items: applicants.map((a) => ({
                _id: String(a._id),
                label: a.job?.title || 'Unknown Job',
                sublabel: `${a.job?.companyName || ''} — ${a.status || 'pending'}`,
                href: '/dashboard/recruiter/my-jobs',
              })),
            });
          }
        }
      }

      if (role === 'admin') {
        const userResults = await userCollection
          .find({
            $or: [
              { name: { $regex: regex } },
              { email: { $regex: regex } },
              { role: { $regex: regex } },
            ],
          })
          .limit(8)
          .toArray();

        if (userResults.length > 0) {
          results.push({
            category: 'Users',
            categoryIcon: 'Users',
            items: userResults.map((u) => ({
              _id: String(u._id),
              label: u.name || 'Unknown',
              sublabel: `${u.email || ''} — ${u.role || 'seeker'}`,
              href: '/dashboard/admin/users',
            })),
          });
        }

        const jobResults = await jobCollection
          .find({
            $or: [
              { title: { $regex: regex } },
              { companyName: { $regex: regex } },
              { category: { $regex: regex } },
              { location: { $regex: regex } },
              { recruiterName: { $regex: regex } },
            ],
          })
          .limit(8)
          .toArray();

        if (jobResults.length > 0) {
          results.push({
            category: 'Jobs',
            categoryIcon: 'Briefcase',
            items: jobResults.map((j) => ({
              _id: String(j._id),
              label: j.title || 'Untitled',
              sublabel: `${j.companyName || ''} — ${j.status || 'pending'}`,
              href: '/dashboard/admin/jobs',
            })),
          });
        }

        const requestResults = await recruiterRequestCollection
          .find({
            $or: [
              { name: { $regex: regex } },
              { email: { $regex: regex } },
              { company: { $regex: regex } },
            ],
          })
          .limit(8)
          .toArray();

        if (requestResults.length > 0) {
          results.push({
            category: 'Recruiter Requests',
            categoryIcon: 'UserPlus',
            items: requestResults.map((r) => ({
              _id: String(r._id),
              label: r.name || 'Unknown',
              sublabel: `${r.company || ''} — ${r.status || 'pending'}`,
              href: '/dashboard/admin/recruiters',
            })),
          });
        }

        const blogResults = await blogCollection
          .find({
            $or: [
              { title: { $regex: regex } },
              { authorName: { $regex: regex } },
            ],
          })
          .limit(8)
          .toArray();

        if (blogResults.length > 0) {
          results.push({
            category: 'Blog Posts',
            categoryIcon: 'FileText',
            items: blogResults.map((b) => ({
              _id: String(b._id),
              label: b.title || 'Untitled',
              sublabel: `by ${b.authorName || 'Unknown'}`,
              href: '/dashboard/admin/posts',
            })),
          });
        }
      }

      sendSuccess(res, results);
    } catch (err) {
      console.error('[dashboard-search]', err);
      sendError(res, 'Search failed');
    }
  });

  return router;
}
