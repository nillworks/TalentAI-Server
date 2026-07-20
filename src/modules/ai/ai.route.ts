import { Router } from 'express';
import { Collection, Document } from 'mongodb';
import { AuthRequest } from '../../types/express.d';
import { verifyToken } from '../../middlewares/auth.middleware';
import { sendError } from '../../utils/response';
import multer from 'multer';
import {
  createCoverLetterHandler,
  createRecommendationsHandler,
  createResumeAnalyzeHandler,
  createChatHandler,
  createChatHistoryHandler,
  createChatClearHandler,
  createResumeClassifierHandler,
} from './ai.controller';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export function createAIRoutes(
  jobCollection: Collection<Document>,
  seekerProfileCollection: Collection<Document>,
  chatCollection: Collection<Document>,
) {
  const router = Router();

  router.post('/cover-letter', verifyToken, createCoverLetterHandler());

  router.post('/recommendations', verifyToken, createRecommendationsHandler(jobCollection));

  router.post('/resume-analyze', verifyToken, upload.single('resume'), createResumeAnalyzeHandler(seekerProfileCollection));

  router.post('/chat', verifyToken, createChatHandler(chatCollection));

  router.get('/chat/history', verifyToken, createChatHistoryHandler(chatCollection));

  router.delete('/chat/history', verifyToken, createChatClearHandler(chatCollection));

  router.post('/classify-resumes', verifyToken, createResumeClassifierHandler(seekerProfileCollection));

  return router;
}

export default createAIRoutes;
