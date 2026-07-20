import { GoogleGenerativeAI } from '@google/generative-ai';
function getGenAI() {
    return new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
}
const MODEL = 'gemini-3-flash-preview';
function hasGeminiKey() {
    const key = process.env.GEMINI_API_KEY || '';
    return key.length > 0 && !key.includes('your_');
}
async function tryGemini(geminiFn, errorMessage) {
    if (!hasGeminiKey()) {
        throw new Error('GEMINI_API_KEY is not set. Please add it to your .env file.');
    }
    try {
        return await geminiFn(getGenAI());
    }
    catch (err) {
        throw new Error(`${errorMessage}. Gemini: ${err?.message || 'failed'}`);
    }
}
async function streamGemini(useGemini, onError) {
    if (!hasGeminiKey()) {
        onError(new Error('GEMINI_API_KEY is not set. Please add it to your .env file.'));
        return false;
    }
    try {
        await useGemini(getGenAI());
        return true;
    }
    catch (err) {
        onError(new Error(`AI generation failed. Gemini: ${err?.message || 'failed'}`));
        return false;
    }
}
function extractJsonArray(text) {
    const match = text.match(/\[[\s\S]*\]/);
    return match ? match[0] : null;
}
function extractJsonObject(text) {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? match[0] : null;
}
const lengthMap = {
    short: '~150 words',
    medium: '~250 words',
    long: '~350 words',
};
const toneMap = {
    formal: 'Professional and formal',
    friendly: 'Warm and approachable',
    confident: 'Bold and assertive',
};
function buildCoverLetterPrompt(input) {
    return `You are an expert career coach with 15+ years of experience writing cover letters.
Task: Write a professional, personalized cover letter for the following job application.

Context:
- Job Title: ${input.jobTitle}
- Company: ${input.company}
- Job Category: ${input.category}
- Applicant Skills/Experience: ${input.skills}
- Tone: ${toneMap[input.tone]}
- Length: ${lengthMap[input.length]}

Rules:
1. Start with a strong opening paragraph mentioning the exact job title and company.
2. Naturally match the applicant's skills to typical job requirements for this category.
3. Include specific examples of how skills translate to value for the company.
4. End with a clear call-to-action expressing enthusiasm.
5. Do NOT use generic phrases like "I am writing to apply" or "I am excited to apply".
6. Do NOT include a subject line — start directly with the salutation.
7. Output ONLY the cover letter text — no titles, no labels, no metadata.

Generate the cover letter now:`;
}
export async function generateCoverLetterStream(input, onChunk, onDone, onError) {
    const prompt = buildCoverLetterPrompt(input);
    const ok = await streamGemini(async (genAI) => {
        const model = genAI.getGenerativeModel({ model: MODEL });
        const result = await model.generateContentStream(prompt);
        for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text)
                onChunk(text);
        }
    }, onError);
    if (ok)
        onDone();
}
function buildRecommendationPrompt(input, availableJobs) {
    return `You are an AI job matching expert.
Task: Analyze the user's profile and match them with the best jobs from the available listings.

User Profile:
- Skills: ${input.skills.join(', ')}
- Previously Applied: ${input.appliedJobs.map((j) => `${j.title} at ${j.company} (${j.category})`).join('; ') || 'None'}
- Saved Jobs: ${input.savedJobs.map((j) => `${j.title} at ${j.company} (${j.category})`).join('; ') || 'None'}
- Preferred Location: ${input.preferredLocation || 'Any'}
- Preferred Job Type: ${input.preferredJobType || 'Any'}

Available Jobs (JSON array):
${JSON.stringify(availableJobs.map((j) => ({ id: j._id, title: j.title, company: j.companyName, category: j.category, type: j.jobType, location: j.location, salary: `${j.salaryMin}-${j.salaryMax}`, desc: j.shortDescription })))}

Rules:
1. Return a JSON array of objects with keys: jobId, matchScore (0-100), reason.
2. Match based on: skill overlap, category relevance, location preference, job type preference.
3. Sort by matchScore descending.
4. Return max 10 results.
5. The "reason" should be a short 1-sentence explanation in natural language.
6. Return ONLY the JSON array — no markdown, no extra text.

Return the recommendations now:`;
}
export async function getJobRecommendations(input, availableJobs) {
    const prompt = buildRecommendationPrompt(input, availableJobs);
    try {
        const responseText = await tryGemini(async (genAI) => {
            const model = genAI.getGenerativeModel({ model: MODEL });
            const result = await model.generateContent(prompt);
            return result.response.text().trim();
        }, 'Failed to get recommendations');
        const json = extractJsonArray(responseText);
        return json ? JSON.parse(json) : [];
    }
    catch {
        return [];
    }
}
const emptyAnalysis = {
    score: 0, skills: [], experience: '', education: '',
    strengths: [], weaknesses: [], suggestions: [],
};
function buildResumeAnalysisPrompt(text) {
    return `You are an expert HR professional and resume reviewer.
Task: Analyze the following resume text and provide a detailed assessment.

Resume Text:
${text}

Rules:
1. Return a JSON object with these exact keys:
   - score: number (0-100, overall resume quality)
   - skills: string[] (list of identified skills)
   - experience: string (brief summary of work experience)
   - education: string (brief summary of education)
   - strengths: string[] (top 3-5 strengths)
   - weaknesses: string[] (areas that need improvement, 3-5 items)
   - suggestions: string[] (actionable improvement suggestions, 3-5 items)
2. Be specific and constructive in your assessment.
3. Return ONLY the JSON object — no markdown, no extra text.

Analyze the resume now:`;
}
export async function analyzeResumeText(text) {
    const prompt = buildResumeAnalysisPrompt(text);
    try {
        const responseText = await tryGemini(async (genAI) => {
            const model = genAI.getGenerativeModel({ model: MODEL });
            const result = await model.generateContent(prompt);
            return result.response.text().trim();
        }, 'Failed to analyze resume');
        const json = extractJsonObject(responseText);
        return json ? JSON.parse(json) : emptyAnalysis;
    }
    catch {
        return emptyAnalysis;
    }
}
// ==================== File Text Extraction ====================
export async function extractTextFromBuffer(buffer, mimetype) {
    if (mimetype === 'application/pdf') {
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse(new Uint8Array(buffer));
        const result = await parser.getText();
        return result.text || '';
    }
    if (mimetype ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const mammoth = (await import('mammoth')).default;
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
    }
    if (mimetype === 'text/plain') {
        return buffer.toString('utf-8');
    }
    throw new Error('Unsupported file type. Please upload PDF, DOCX, or TXT.');
}
export async function chatWithCareerCoachStream(messages, websiteContext, userContext, onChunk, onDone, onError) {
    const ok = await streamGemini(async (genAI) => {
        const model = genAI.getGenerativeModel({ model: MODEL });
        const history = messages.slice(0, -1).map((msg) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }],
        }));
        const systemParts = [
            'You are TalentAI\'s Career Coach — a helpful AI assistant for the TalentAI job platform.',
            'You help users with career advice, job search tips, resume help, interview prep, salary insights, and navigating the TalentAI platform.',
            'Be friendly, concise, and use markdown for formatting.',
            '',
            websiteContext,
        ];
        if (userContext) {
            systemParts.push('', userContext);
        }
        const chat = model.startChat({
            history,
            systemInstruction: { role: 'user', parts: [{ text: systemParts.join('\n') }] },
        });
        const lastMessage = messages[messages.length - 1];
        const result = await chat.sendMessageStream(lastMessage.text);
        for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text)
                onChunk(text);
        }
    }, onError);
    if (ok)
        onDone();
}
// ==================== AI Resume Classifier (Recruiter) ====================
function buildClassifierPrompt(jobTitle, jobRequirements, resumes) {
    return `You are an AI recruiter assistant.
Task: Analyze each applicant's resume against the job requirements and classify them.

Job Title: ${jobTitle}
Job Requirements: ${jobRequirements.join(', ')}

Applicants:
${resumes.map((r, i) => `--- Applicant ${i + 1} (ID: ${r.userId}) ---\n${r.resumeText}\n`).join('\n')}

Rules:
1. Return a JSON array of objects with keys: userId, tags (string[]), score (0-100).
2. Tags should be relevant skills/qualifications found (e.g., "React", "5+ years experience", "AWS certified").
3. Score represents how well the resume matches the job requirements.
4. Sort by score descending.
5. Return ONLY the JSON array — no markdown, no extra text.

Classify the resumes now:`;
}
export async function classifyResumes(jobTitle, jobRequirements, resumes) {
    const prompt = buildClassifierPrompt(jobTitle, jobRequirements, resumes);
    try {
        const responseText = await tryGemini(async (genAI) => {
            const model = genAI.getGenerativeModel({ model: MODEL });
            const result = await model.generateContent(prompt);
            return result.response.text().trim();
        }, 'Failed to classify resumes');
        const json = extractJsonArray(responseText);
        return json ? JSON.parse(json) : [];
    }
    catch {
        return [];
    }
}
// ==================== AI Job Post Generator ====================
export async function generateJobPostFromDescription(description) {
    const prompt = `You are an expert job posting assistant. Based on the following job description, generate a complete structured job posting.

Job Description:
${description}

Available categories: Technology, Design, Marketing, Finance, Education, Healthcare, Engineering, Sales, Human Resources, Other
Available job types: full-time, part-time, remote, contract

Return ONLY a valid JSON object with these exact keys:
- title: string (job title)
- companyName: string (invent a realistic company name if not mentioned)
- category: string (must be one of the available categories above)
- jobType: string (must be one of the available job types above)
- location: string (city, country)
- salaryMin: number (minimum monthly salary in BDT, realistic for the role)
- salaryMax: number (maximum monthly salary in BDT, realistic for the role)
- shortDescription: string (2-3 sentence summary for job cards)
- fullDescription: string (detailed job description, responsibilities, ideal candidate, 3-5 paragraphs)
- requirements: string[] (array of 5-8 specific skill/qualification requirements)

Do NOT include markdown formatting. Return ONLY the JSON object.`;
    const responseText = await tryGemini(async (genAI) => {
        const model = genAI.getGenerativeModel({ model: MODEL });
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    }, 'Failed to generate job post');
    const json = extractJsonObject(responseText);
    if (!json)
        throw new Error('Failed to parse generated job post');
    return JSON.parse(json);
}
