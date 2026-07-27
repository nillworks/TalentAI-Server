import { Router, Response } from 'express';
import { ObjectId, Collection, Document } from 'mongodb';
import { AuthRequest } from '../../types/express.d.js';
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js';
import { sendSuccess, sendError, sendPaginated } from '../../utils/response.js';

export function createJobRoutes(
  jobCollection: Collection<Document>,
  applicationCollection: Collection<Document>,
) {
  const router = Router();

  // Split a comma-separated query param (e.g. "Technology,Design") into a
  // cleaned list of values, dropping the "All" sentinel and empty entries.
  const parseMulti = (value?: string): string[] =>
    (value || '')
      .split(',')
      .map(v => v.trim())
      .filter(v => v && v !== 'All');

  // Escape user input before using it inside a RegExp so filter values with
  // special characters (e.g. "C++", "Node.js") match literally.
  const escapeRegex = (value: string): string =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  router.get('/', async (req, res: Response) => {
    try {
      const {
        page = '1',
        limit = '10',
        search,
        type,
        category,
        location,
        minSalary,
        maxSalary,
        sortBy,
      } = req.query as Record<string, string>;

      const pageNum = Number(page);
      const limitNum = Number(limit);

      // Each active filter contributes one condition to `and`, so multiple
      // filters combine with AND while multi-value filters match with $in (OR
      // within the same field). This keeps search + multi-location from
      // clobbering each other on a shared `$or` key.
      const and: Record<string, any>[] = [{ status: 'approved' }];

      if (search) {
        and.push({
          $or: [
            { title: { $regex: new RegExp(escapeRegex(search), 'i') } },
            { companyName: { $regex: new RegExp(escapeRegex(search), 'i') } },
          ],
        });
      }

      const types = parseMulti(type);
      if (types.length) {
        and.push({
          jobType: {
            $in: types.map(t => new RegExp(`^${escapeRegex(t)}$`, 'i')),
          },
        });
      }

      const categories = parseMulti(category);
      if (categories.length) {
        and.push({
          category: {
            $in: categories.map(c => new RegExp(`^${escapeRegex(c)}$`, 'i')),
          },
        });
      }

      const locations = parseMulti(location);
      if (locations.length) {
        and.push({
          location: {
            $in: locations.map(l => new RegExp(escapeRegex(l), 'i')),
          },
        });
      }

      const min = Number(minSalary);
      const max = Number(maxSalary);
      if (!Number.isNaN(min) && minSalary !== undefined && minSalary !== '') {
        and.push({ salaryMax: { $gte: min } });
      }
      if (!Number.isNaN(max) && maxSalary !== undefined && maxSalary !== '') {
        and.push({ salaryMin: { $lte: max } });
      }

      const query: Record<string, any> =
        and.length > 1 ? { $and: and } : and[0];

      const sortOptions: Record<string, any> = { createdAt: -1 };
      if (sortBy === 'oldest') sortOptions.createdAt = 1;
      if (sortBy === 'applications') sortOptions.applicationCount = -1;
      if (sortBy === 'salary_high') sortOptions.salaryMax = -1;

      const skip = (pageNum - 1) * limitNum;

      const jobs = await jobCollection
        .find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .toArray();

      const total = await jobCollection.countDocuments(query);
      sendPaginated(res, jobs, total, pageNum, limitNum);
    } catch {
      sendError(res, 'Failed to fetch jobs');
    }
  });

  // Dynamic filter options built from live data so newly-added categories,
  // job types, or locations become filterable without any frontend change.
  router.get('/filter-options', async (_req, res: Response) => {
    try {
      const base = { status: 'approved' };

      const distinctField = async (field: string): Promise<string[]> => {
        const rows = await jobCollection
          .aggregate([{ $match: base }, { $group: { _id: `$${field}` } }])
          .toArray();
        return rows
          .map(r => r._id)
          .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
          .sort((a, b) => a.localeCompare(b));
      };

      const [categories, jobTypes, locations, salaryAgg] = await Promise.all([
        distinctField('category'),
        distinctField('jobType'),
        distinctField('location'),
        jobCollection
          .aggregate([
            { $match: base },
            {
              $group: {
                _id: null,
                minSalary: { $min: '$salaryMin' },
                maxSalary: { $max: '$salaryMax' },
              },
            },
          ])
          .toArray(),
      ]);

      sendSuccess(res, {
        categories,
        jobTypes,
        locations,
        minSalary: salaryAgg[0]?.minSalary ?? 0,
        maxSalary: salaryAgg[0]?.maxSalary ?? 0,
      });
    } catch {
      sendError(res, 'Failed to fetch filter options');
    }
  });

  // Returns autocomplete suggestions — distinct values matching the query
  // across titles, companies, categories, and locations (approved jobs only).
  router.get('/suggest', async (req, res: Response) => {
    try {
      const q = String(req.query.q || '').trim();
      if (q.length < 2) return sendSuccess(res, { suggestions: [] });

      const escaped = escapeRegex(q);
      const match = { status: 'approved' };

      const distinctPrefix = async (
        field: string,
        limit = 5,
      ): Promise<string[]> => {
        const cursor = jobCollection.aggregate([
          { $match: match },
          { $match: { [field]: { $regex: `^${escaped}`, $options: 'i' } } },
          { $group: { _id: `$${field}` } },
          { $limit: limit },
          { $sort: { _id: 1 } },
        ]);
        const rows = await cursor.toArray();
        return rows
          .map(r => r._id as string)
          .filter(v => typeof v === 'string' && v.trim() !== '');
      };

      const [titles, companies, categories, locations] = await Promise.all([
        distinctPrefix('title'),
        distinctPrefix('companyName'),
        distinctPrefix('category'),
        distinctPrefix('location'),
      ]);

      const suggestions: { text: string; type: string }[] = [
        ...titles.map(t => ({ text: t, type: 'title' })),
        ...companies.map(c => ({ text: c, type: 'company' })),
        ...categories.map(c => ({ text: c, type: 'category' })),
        ...locations.map(l => ({ text: l, type: 'location' })),
      ];

      sendSuccess(res, { suggestions });
    } catch {
      sendError(res, 'Failed to fetch suggestions');
    }
  });

  router.get('/featured', async (req, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 6;

      const jobs = await jobCollection
        .find({ status: 'approved' })
        .sort({ applicationCount: -1 })
        .limit(limit)
        .toArray();

      sendSuccess(res, jobs);
    } catch {
      sendError(res, 'Failed to fetch featured jobs');
    }
  });

  router.get('/:id', async (req, res: Response) => {
    try {
      const id = String(req.params.id);

      if (id === 'featured') {
        return sendError(res, 'Not found', 404);
      }

      if (!ObjectId.isValid(id)) {
        return sendError(res, 'Invalid job ID', 400);
      }

      const job = await jobCollection.findOne({ _id: new ObjectId(id) });
      if (!job) return sendError(res, 'Job not found', 404);

      sendSuccess(res, job);
    } catch {
      sendError(res, 'Failed to fetch job');
    }
  });

  return router;
}
