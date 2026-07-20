import { sendSuccess, sendError } from '../../utils/response';
import { ObjectId } from 'mongodb';
import { generateCoverLetterStream, getJobRecommendations, analyzeResumeText, extractTextFromBuffer, chatWithCareerCoachStream, classifyResumes, generateJobPostFromDescription, } from './ai.service';
// ==================== Cover Letter Generator ====================
export function createCoverLetterHandler() {
    return async (req, res) => {
        try {
            const input = req.body;
            if (!input.jobTitle || !input.company || !input.skills) {
                return sendError(res, 'Job title, company name, and skills are required', 400);
            }
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders();
            let fullText = '';
            await generateCoverLetterStream(input, (chunk) => {
                fullText += chunk;
                res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
            }, () => {
                res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                res.end();
            }, (err) => {
                res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
                res.end();
            });
        }
        catch (err) {
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
export function createRecommendationsHandler(jobCollection) {
    return async (req, res) => {
        try {
            const input = req.body;
            const allJobs = await jobCollection
                .find({ status: 'approved' })
                .sort({ createdAt: -1 })
                .limit(50)
                .toArray();
            const availableJobs = allJobs.map((job) => ({
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
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to get recommendations';
            return sendError(res, message);
        }
    };
}
// ==================== Resume Analyzer ====================
export function createResumeAnalyzeHandler(seekerProfileCollection) {
    return async (req, res) => {
        try {
            const userId = req.user?.sub;
            if (!userId)
                return sendError(res, 'Unauthorized', 401);
            let resumeText = '';
            if (req.file) {
                resumeText = await extractTextFromBuffer(req.file.buffer, req.file.mimetype);
            }
            else if (req.body.resumeText) {
                resumeText = req.body.resumeText;
            }
            else {
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
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to analyze resume';
            return sendError(res, message);
        }
    };
}
// ==================== Career Coach Chatbot ====================
export function createChatHandler(chatCollection, jobCollection, seekerProfileCollection, userCollection, applicationCollection, savedJobCollection, plansCollection) {
    return async (req, res) => {
        try {
            const { message: userMessage, conversationId } = req.body;
            const userId = req.user?.sub;
            if (!userId)
                return sendError(res, 'Unauthorized', 401);
            if (!userMessage || typeof userMessage !== 'string') {
                return sendError(res, 'Message is required', 400);
            }
            const [history, totalJobs, jobCategories, userData, profile, plans] = await Promise.all([
                chatCollection
                    .find({ userId, conversationId: conversationId || null })
                    .sort({ createdAt: 1 })
                    .limit(50)
                    .toArray(),
                jobCollection.countDocuments({ status: 'approved' }),
                jobCollection.aggregate([
                    { $match: { status: 'approved' } },
                    { $group: { _id: '$category' } },
                    { $sort: { _id: 1 } },
                ]).toArray().then((cats) => cats.map((c) => c._id)),
                userCollection.findOne({ _id: new ObjectId(userId) }),
                seekerProfileCollection.findOne({ userId }),
                plansCollection.find().sort({ price: 1 }).toArray(),
            ]);
            const [appliedCount, savedCount] = await Promise.all([
                applicationCollection.countDocuments({ userId }),
                savedJobCollection.countDocuments({ userId }),
            ]);
            const websiteContext = buildWebsiteContext(totalJobs, jobCategories, plans);
            const userContext = buildUserContext(userData, profile, appliedCount, savedCount);
            const messages = history.map((h) => ({
                role: h.role,
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
            await chatWithCareerCoachStream(messages, websiteContext, userContext, (chunk) => {
                fullResponse += chunk;
                res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
            }, async () => {
                await chatCollection.insertOne({
                    userId,
                    conversationId: conversationId || null,
                    role: 'model',
                    text: fullResponse,
                    createdAt: new Date(),
                });
                res.write(`data: ${JSON.stringify({ done: true, conversationId: conversationId || null })}\n\n`);
                res.end();
            }, (err) => {
                res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
                res.end();
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to process chat';
            if (res.headersSent) {
                res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
                return res.end();
            }
            return sendError(res, message);
        }
    };
}
function buildWebsiteContext(totalJobs, categories, plans) {
    const planSummary = plans.map((p) => `- ${p.name}: $${p.price}/${p.interval || 'month'} - ${p.description || ''}`).join('\n');
    return `=== TALENTAI WEBSITE CONTEXT ===
TalentAI is an AI-powered job board and career coaching platform.
- Total available jobs: ${totalJobs}
- Job categories: ${categories.join(', ') || 'Various'}
- Plans & Pricing:
${planSummary || '- Free plan available; Paid plans with more features'}
- Features: AI cover letter generator, AI resume analysis, career coach chatbot, smart job recommendations, resume classifier for recruiters
- Users can be: job seekers or recruiters
- Seekers: browse jobs, apply, save jobs, get AI recommendations
- Recruiters: post jobs, manage applications, classify resumes with AI`;
}
function buildUserContext(user, profile, appliedCount, savedCount) {
    if (!user)
        return '';
    return `=== YOUR DATA ===
Your name: ${user.name || 'Not set'}
Your email: ${user.email}
Your role: ${user.role || 'seeker'}
Your plan: ${user.plan || 'free_seeker'}
Applications submitted: ${appliedCount}
Saved jobs: ${savedCount}
${profile?.skills?.length ? `Your skills: ${profile.skills.join(', ')}` : ''}
${profile?.experience?.length ? `Experience entries: ${profile.experience.length}` : ''}
${profile?.education?.length ? `Education entries: ${profile.education.length}` : ''}
${profile?.bio ? `Bio: ${profile.bio}` : ''}`;
}
// ==================== Chat History ====================
export function createChatHistoryHandler(chatCollection) {
    return async (req, res) => {
        try {
            const userId = req.user?.sub;
            if (!userId)
                return sendError(res, 'Unauthorized', 401);
            const history = await chatCollection
                .find({ userId })
                .sort({ createdAt: -1 })
                .limit(100)
                .toArray();
            return sendSuccess(res, history);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to fetch history';
            return sendError(res, message);
        }
    };
}
export function createChatClearHandler(chatCollection) {
    return async (req, res) => {
        try {
            const userId = req.user?.sub;
            if (!userId)
                return sendError(res, 'Unauthorized', 401);
            await chatCollection.deleteMany({ userId });
            return sendSuccess(res, { message: 'Chat history cleared' });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to clear history';
            return sendError(res, message);
        }
    };
}
// ==================== Resume Classifier (Recruiter) ====================
export function createResumeClassifierHandler(seekerProfileCollection) {
    return async (req, res) => {
        try {
            const { jobTitle, jobRequirements, candidates } = req.body;
            if (!jobTitle || !jobRequirements || !Array.isArray(jobRequirements)) {
                return sendError(res, 'Job title and requirements array are required', 400);
            }
            let resumes;
            if (candidates && Array.isArray(candidates) && candidates.length > 0) {
                resumes = candidates.filter((c) => c.resumeText?.trim().length >= 20);
                if (resumes.length === 0) {
                    return sendError(res, 'Provide at least one candidate with meaningful resume text (min 20 chars)', 400);
                }
            }
            else {
                const profiles = await seekerProfileCollection
                    .find({ resumeUrl: { $exists: true, $ne: '' } })
                    .limit(50)
                    .toArray();
                resumes = profiles
                    .filter((p) => p.resumeUrl)
                    .map((p) => ({
                    userId: p.userId,
                    resumeText: p.resumeUrl || '',
                }));
            }
            if (resumes.length === 0) {
                return sendSuccess(res, { classifications: [], totalProfiles: 0 });
            }
            const classifications = await classifyResumes(jobTitle, jobRequirements, resumes);
            return sendSuccess(res, { classifications, totalProfiles: resumes.length });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to classify resumes';
            return sendError(res, message);
        }
    };
}
// ==================== AI Job Post Generator ====================
export function createGenerateJobPostHandler() {
    return async (req, res) => {
        try {
            const { description } = req.body;
            if (!description || typeof description !== 'string') {
                return sendError(res, 'Description is required', 400);
            }
            const wordCount = description.trim().split(/\s+/).length;
            if (wordCount < 20) {
                return sendError(res, `Description must be at least 20 words (you wrote ${wordCount})`, 400);
            }
            const result = await generateJobPostFromDescription(description);
            return sendSuccess(res, result);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to generate job post';
            return sendError(res, message);
        }
    };
}
