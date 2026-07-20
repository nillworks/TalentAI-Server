import { Response } from 'express';
import { AuthRequest } from '../../types/express.d';
import { sendSuccess, sendError } from '../../utils/response';
import { Collection, Document, ObjectId } from 'mongodb';
import {
  generateCoverLetterStream,
  getJobRecommendations,
  analyzeResumeText,
  extractTextFromBuffer,
  chatWithCareerCoachStream,
  classifyResumes,
  CoverLetterInput,
  RecommendationInput,
  JobForRecommendation,
  ChatMessage,
} from './ai.service';

// ==================== Cover Letter Generator ====================

export function createCoverLetterHandler() {
  return async (req: AuthRequest, res: Response) => {
    try {
      const input = req.body as CoverLetterInput;

      if (!input.jobTitle || !input.company || !input.skills) {
        return sendError(res, 'Job title, company name, and skills are required', 400);
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      let fullText = '';

      await generateCoverLetterStream(
        input,
        (chunk) => {
          fullText += chunk;
          res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
        },
        () => {
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          res.end();
        },
        (err) => {
          res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
          res.end();
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate cover letter';
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
        return res.end();
      }
      return sendError(res, message);
    }
  };
}

// ==================== Job Recommendations ====================

export function createRecommendationsHandler(
  jobCollection: Collection<Document>,
) {
  return async (req: AuthRequest, res: Response) => {
    try {
      const input = req.body as RecommendationInput;

      const allJobs = await jobCollection
        .find({ status: 'approved' })
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();

      const availableJobs: JobForRecommendation[] = allJobs.map((job) => ({
        _id: job._id.toString(),
        title: job.title,
        companyName: job.companyName,
        category: job.category,
        jobType: job.jobType,
        location: job.location,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        shortDescription: job.shortDescription,
      }));

      if (availableJobs.length === 0) {
        return sendSuccess(res, { recommendations: [], totalJobs: 0 });
      }

      const recommendations = await getJobRecommendations(input, availableJobs);

      return sendSuccess(res, {
        recommendations,
        totalJobs: availableJobs.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get recommendations';
      return sendError(res, message);
    }
  };
}

// ==================== Resume Analyzer ====================

export function createResumeAnalyzeHandler(
  seekerProfileCollection: Collection<Document>,
) {
  return async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      if (!userId) return sendError(res, 'Unauthorized', 401);

      let resumeText = '';

      if (req.file) {
        resumeText = await extractTextFromBuffer(req.file.buffer, req.file.mimetype);
      } else if (req.body.resumeText) {
        resumeText = req.body.resumeText;
      } else {
        const profile = await seekerProfileCollection.findOne({ userId });
        if (profile?.resumeUrl) {
          return sendSuccess(res, {
            message: 'Resume URL found. Please upload file for analysis.',
            resumeUrl: profile.resumeUrl,
          });
        }
        return sendError(res, 'No resume provided. Upload a file or paste resume text.', 400);
      }

      if (resumeText.trim().length < 50) {
        return sendError(res, 'Resume content too short. Please provide a complete resume.', 400);
      }

      const analysis = await analyzeResumeText(resumeText);

      return sendSuccess(res, {
        analysis,
        wordCount: resumeText.split(/\s+/).length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to analyze resume';
      return sendError(res, message);
    }
  };
}

// ==================== Career Coach Chatbot ====================

export function createChatHandler(chatCollection: Collection<Document>) {
  return async (req: AuthRequest, res: Response) => {
    try {
      const { message: userMessage, conversationId } = req.body;
      const userId = req.user?.sub;

      if (!userId) return sendError(res, 'Unauthorized', 401);
      if (!userMessage || typeof userMessage !== 'string') {
        return sendError(res, 'Message is required', 400);
      }

      const history = await chatCollection
        .find({ userId, conversationId: conversationId || null })
        .sort({ createdAt: 1 })
        .limit(50)
        .toArray();

      const messages: ChatMessage[] = history.map((h) => ({
        role: h.role as 'user' | 'model',
        text: h.text,
      }));
      messages.push({ role: 'user', text: userMessage });

      await chatCollection.insertOne({
        userId,
        conversationId: conversationId || null,
        role: 'user',
        text: userMessage,
        createdAt: new Date(),
      });

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      let fullResponse = '';

      await chatWithCareerCoachStream(
        messages,
        (chunk) => {
          fullResponse += chunk;
          res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
        },
        async () => {
          await chatCollection.insertOne({
            userId,
            conversationId: conversationId || null,
            role: 'model',
            text: fullResponse,
            createdAt: new Date(),
          });
          res.write(`data: ${JSON.stringify({ done: true, conversationId: conversationId || null })}\n\n`);
          res.end();
        },
        (err) => {
          res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
          res.end();
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process chat';
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
        return res.end();
      }
      return sendError(res, message);
    }
  };
}

// ==================== Chat History ====================

export function createChatHistoryHandler(chatCollection: Collection<Document>) {
  return async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      if (!userId) return sendError(res, 'Unauthorized', 401);

      const history = await chatCollection
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray();

      return sendSuccess(res, history);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch history';
      return sendError(res, message);
    }
  };
}

export function createChatClearHandler(chatCollection: Collection<Document>) {
  return async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      if (!userId) return sendError(res, 'Unauthorized', 401);

      await chatCollection.deleteMany({ userId });
      return sendSuccess(res, { message: 'Chat history cleared' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to clear history';
      return sendError(res, message);
    }
  };
}

// ==================== Resume Classifier (Recruiter) ====================

export function createResumeClassifierHandler(
  seekerProfileCollection: Collection<Document>,
) {
  return async (req: AuthRequest, res: Response) => {
    try {
      const { jobTitle, jobRequirements } = req.body;

      if (!jobTitle || !jobRequirements || !Array.isArray(jobRequirements)) {
        return sendError(res, 'Job title and requirements array are required', 400);
      }

      const profiles = await seekerProfileCollection
        .find({ resumeUrl: { $exists: true, $ne: '' } })
        .limit(50)
        .toArray();

      const resumes = profiles
        .filter((p) => p.resumeUrl)
        .map((p) => ({
          userId: p.userId,
          resumeText: p.resumeUrl || '',
        }));

      if (resumes.length === 0) {
        return sendSuccess(res, { classifications: [] });
      }

      const classifications = await classifyResumes(jobTitle, jobRequirements, resumes);

      return sendSuccess(res, { classifications, totalProfiles: profiles.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to classify resumes';
      return sendError(res, message);
    }
  };
}
