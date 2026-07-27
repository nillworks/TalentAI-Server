import { Router } from 'express';
import { Collection, Document } from 'mongodb';
import { AuthRequest } from '../../types/express.d.js';
import { verifyToken } from '../../middlewares/auth.middleware.js';
import { sendError } from '../../utils/response.js';
import multer from 'multer';
import {
  createCoverLetterHandler,
  createRecommendationsHandler,
  createResumeAnalyzeHandler,
  createChatHandler,
  createChatHistoryHandler,
  createChatClearHandler,
  createResumeClassifierHandler,
  createGenerateJobPostHandler,
} from './ai.controller.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export function createAIRoutes(
  jobCollection: Collection<Document>,
  seekerProfileCollection: Collection<Document>,
  chatCollection: Collection<Document>,
) {
  const userCollection = jobCollection.db.collection('user');
  const applicationCollection = jobCollection.db.collection('applications');
  const savedJobCollection = jobCollection.db.collection('savedJobs');
  const plansCollection = jobCollection.db.collection('plans');

  const router = Router();

  router.post('/cover-letter', verifyToken, createCoverLetterHandler());

  router.post('/recommendations', verifyToken, createRecommendationsHandler(jobCollection));

  router.post('/resume-analyze', verifyToken, upload.single('resume'), createResumeAnalyzeHandler(seekerProfileCollection));

  router.post('/chat', verifyToken, createChatHandler(chatCollection, jobCollection, seekerProfileCollection, userCollection, applicationCollection, savedJobCollection, plansCollection));

  router.get('/chat/history', verifyToken, createChatHistoryHandler(chatCollection));

  router.delete('/chat/history', verifyToken, createChatClearHandler(chatCollection));

  router.post('/classify-resumes', verifyToken, createResumeClassifierHandler(seekerProfileCollection));

  router.post('/generate-job-post', verifyToken, createGenerateJobPostHandler());

  return router;
}

export default createAIRoutes;
