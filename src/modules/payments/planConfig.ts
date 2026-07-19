import { PlanType, PlanLimits } from '../../types/express.d';

export interface PlanConfig {
  id: PlanType;
  name: string;
  description: string;
  price: number;
  priceLabel: string;
  interval: 'month' | 'year';
  role: 'seeker' | 'recruiter';
  features: string[];
  limits: {
    maxApplications?: number;
    maxJobPosts?: number;
  };
  stripePriceId: string;
  isFree: boolean;
}

export const PLANS: PlanConfig[] = [
  {
    id: 'free_seeker',
    name: 'Free Seeker',
    description: 'Perfect for getting started with your job search',
    price: 0,
    priceLabel: 'Free',
    interval: 'month',
    role: 'seeker',
    features: [
      '5 job applications per month',
      'Basic profile',
      'Browse all jobs',
      'AI career coach (limited)',
    ],
    limits: { maxApplications: 5 },
    stripePriceId: '',
    isFree: true,
  },
  {
    id: 'pro_seeker',
    name: 'Pro Seeker',
    description: 'Supercharge your job search with unlimited applications',
    price: 9.99,
    priceLabel: '$9.99/mo',
    interval: 'month',
    role: 'seeker',
    features: [
      '50 job applications per month',
      'Advanced profile with portfolio',
      'Priority in search results',
      'AI resume analyzer',
      'AI career coach (unlimited)',
      'Application tracking dashboard',
    ],
    limits: { maxApplications: 50 },
    stripePriceId: process.env.STRIPE_PRO_SEEKER_PRICE_ID || '',
    isFree: false,
  },
  {
    id: 'recruiter_free',
    name: 'Free Recruiter',
    description: 'Start posting jobs and finding talent',
    price: 0,
    priceLabel: 'Free',
    interval: 'month',
    role: 'recruiter',
    features: [
      '5 job posts per month',
      'Basic applicant tracking',
      'Company profile',
      'Candidate search',
    ],
    limits: { maxJobPosts: 5 },
    stripePriceId: '',
    isFree: true,
  },
  {
    id: 'pro_recruiter',
    name: 'Pro Recruiter',
    description: 'Full power recruiting with unlimited job posts',
    price: 29.99,
    priceLabel: '$29.99/mo',
    interval: 'month',
    role: 'recruiter',
    features: [
      '50 job posts per month',
      'Advanced applicant tracking',
      'Featured company profile',
      'AI-powered candidate matching',
      'Analytics dashboard',
      'Priority support',
      'Bulk resume screening',
    ],
    limits: { maxJobPosts: 50 },
    stripePriceId: process.env.STRIPE_PRO_RECRUITER_PRICE_ID || '',
    isFree: false,
  },
];

export const getPlanById = (id: PlanType): PlanConfig | undefined => {
  return PLANS.find((p) => p.id === id);
};

export const getPlansByRole = (role: 'seeker' | 'recruiter'): PlanConfig[] => {
  return PLANS.filter((p) => p.role === role);
};

export const getPlanLimits = (planId: PlanType): PlanLimits => {
  const plan = getPlanById(planId);
  return plan?.limits || {};
};
