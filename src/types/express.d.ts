import { Request } from 'express';

export interface AuthUser {
  sub: string;
  role: 'admin' | 'recruiter' | 'seeker';
  email?: string;
  name?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export interface JobDocument {
  _id?: any;
  title: string;
  companyName: string;
  companyLogo?: string;
  category: string;
  jobType: string;
  location: string;
  salaryMin: number;
  salaryMax: number;
  deadline?: string;
  shortDescription: string;
  fullDescription: string;
  requirements: string[];
  benefits?: string[];
  postedBy: string;
  recruiterId?: string;
  recruiterName?: string;
  recruiterImage?: string;
  recruiterEmail?: string;
  status: 'pending' | 'approved' | 'rejected';
  applicationCount: number;
  createdAt: Date;
  updatedAt?: Date;
}

export interface ApplicationDocument {
  _id?: any;
  jobId: string;
  userId: string;
  resumeUrl?: string;
  coverLetter?: string;
  status: 'pending' | 'reviewed' | 'accepted' | 'rejected';
  createdAt: Date;
  updatedAt?: Date;
}

export interface SavedJobDocument {
  _id?: any;
  jobId: string;
  userId: string;
  createdAt: Date;
}

export interface UserDocument {
  _id?: any;
  userId: string;
  name: string;
  email: string;
  role: 'seeker' | 'recruiter' | 'admin';
  isBlocked: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export interface RecruiterRequestDocument {
  _id?: any;
  userId: string;
  name: string;
  email: string;
  company: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt?: Date;
}

export interface SeekerProfileDocument {
  _id?: any;
  userId: string;
  phone?: string;
  bio?: string;
  location?: string;
  resumeUrl?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  githubUrl?: string;
  skills?: string[];
  education?: {
    institution: string;
    degree: string;
    field: string;
    startDate?: string;
    endDate?: string;
  }[];
  experience?: {
    company: string;
    position: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }[];
  createdAt: Date;
  updatedAt?: Date;
}

export interface RecruiterProfileDocument {
  _id?: any;
  userId: string;
  companyName: string;
  companyLogo?: string;
  companyWebsite?: string;
  companyDescription?: string;
  companyLocation?: string;
  industry?: string;
  companySize?: string;
  phone?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface BlogDocument {
  _id?: any;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorImage?: string;
  authorRole?: string;
  tags: string[];
  createdAt: Date;
  updatedAt?: Date;
}
