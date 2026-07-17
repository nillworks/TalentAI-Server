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
  company: string;
  location: string;
  type: string;
  salary?: string;
  description: string;
  requirements: string[];
  benefits: string[];
  postedBy: string;
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

export interface BlogDocument {
  _id?: any;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  tags: string[];
  createdAt: Date;
  updatedAt?: Date;
}
