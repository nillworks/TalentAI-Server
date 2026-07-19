import { Router, Request, Response } from 'express';
import { Collection, Document } from 'mongodb';
import { AuthRequest } from '../../types/express.d';
import { verifyToken } from '../../middlewares/auth.middleware';
import { sendSuccess, sendError } from '../../utils/response';
import { getStripe, isStripeConfigured } from './stripe';
import { PLANS } from './planConfig';
import { PlanType } from '../../types/express.d';

export function createPaymentRoutes(
  userCollection: Collection<Document>,
  applicationCollection: Collection<Document>,
  jobCollection: Collection<Document>,
  plansCollection: Collection<Document>,
) {
  const router = Router();

  // GET /api/payments/plans — list all plans from DB (seed if empty)
  router.get('/plans', async (_req: Request, res: Response) => {
    try {
      const count = await plansCollection.countDocuments();
      if (count === 0) {
        const seed = PLANS.map((p) => ({ ...p, createdAt: new Date(), updatedAt: new Date() }));
        await plansCollection.insertMany(seed);
      }
      const plans = await plansCollection.find().sort({ role: 1, price: 1 }).toArray();
      sendSuccess(res, plans);
    } catch {
      sendSuccess(res, PLANS);
    }
  });

  // GET /api/payments/subscription — current user's plan + usage
  router.get('/subscription', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      if (!userId) return sendError(res, 'Unauthorized', 401);

      const user = await userCollection.findOne({ userId });
      if (!user) return sendError(res, 'User not found', 404);

      const planId: PlanType = user.plan || 'free_seeker';
      const plan = await plansCollection.findOne({ id: planId });
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      let usage = 0;
      let limit = 0;

      if (user.role === 'seeker' || user.role === 'admin') {
        usage = await applicationCollection.countDocuments({
          userId,
          createdAt: { $gte: startOfMonth },
        });
        limit = plan?.limits?.maxApplications || 0;
      } else if (user.role === 'recruiter') {
        usage = await jobCollection.countDocuments({
          recruiterId: userId,
          createdAt: { $gte: startOfMonth },
        });
        limit = plan?.limits?.maxJobPosts || 0;
      }

      sendSuccess(res, { plan, role: user.role, usage, limit, periodStart: startOfMonth });
    } catch {
      sendError(res, 'Failed to fetch subscription');
    }
  });

  // POST /api/payments/create-checkout — TechBazaar style: price_data inline
  router.post('/create-checkout', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
      if (!isStripeConfigured()) {
        return sendError(res, 'Stripe not configured. Set STRIPE_SECRET_KEY in .env and restart server.', 503);
      }

      const userId = req.user?.sub;
      if (!userId) return sendError(res, 'Unauthorized', 401);

      const { planId } = req.body;
      if (!planId) return sendError(res, 'planId is required', 400);

      const planDoc = await plansCollection.findOne({ id: planId as PlanType });
      if (!planDoc) return sendError(res, 'Plan not found', 404);
      if (planDoc.isFree) return sendError(res, 'Cannot checkout for free plan', 400);

      const user = await userCollection.findOne({ userId });
      if (!user) return sendError(res, 'User not found', 404);

      const origin = req.headers.origin || process.env.CLIENT_URL || 'http://localhost:3000';

      const session = await getStripe().checkout.sessions.create({
        customer_email: user.email,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: Math.round(planDoc.price * 100),
              product_data: {
                name: planDoc.name,
              },
              recurring: {
                interval: planDoc.interval === 'year' ? 'year' : 'month',
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          userId,
          planId: planDoc.id,
          planName: planDoc.name,
        },
        mode: 'subscription',
        success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/payment/cancel`,
      });

      sendSuccess(res, { url: session.url, sessionId: session.id });
    } catch (err: any) {
      sendError(res, err.message || 'Failed to create checkout session');
    }
  });

  // POST /api/payments/webhook — Stripe webhook handler
  router.post('/webhook', async (req: Request, res: Response) => {
    try {
      if (!isStripeConfigured()) {
        return res.status(503).json({ error: 'Stripe not configured' });
      }

      const sig = req.headers['stripe-signature'] as string;
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

      let event;
      try {
        event = getStripe().webhooks.constructEvent(req.body, sig, endpointSecret);
      } catch (err: any) {
        sendError(res, `Webhook signature failed: ${err.message}`, 400);
        return;
      }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as any;
        const userId = session.metadata?.userId;
        const planId = session.metadata?.planId as PlanType;

        if (userId && planId) {
          await userCollection.updateOne(
            { userId },
            {
              $set: {
                plan: planId,
                stripeSubscriptionId: session.subscription,
                updatedAt: new Date(),
              },
            },
          );
        }
      }

      if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as any;
        const user = await userCollection.findOne({ stripeSubscriptionId: subscription.id });
        if (user) {
          const fallbackPlan: PlanType = user.role === 'recruiter' ? 'recruiter_free' : 'free_seeker';
          await userCollection.updateOne(
            { userId: user.userId },
            { $set: { plan: fallbackPlan, stripeSubscriptionId: null, updatedAt: new Date() } },
          );
        }
      }

      res.json({ received: true });
    } catch {
      sendError(res, 'Webhook handler failed');
    }
  });

  // POST /api/payments/update-plan — verify from frontend and update user plan
  router.post('/update-plan', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      if (!userId) return sendError(res, 'Unauthorized', 401);

      const { planId, stripeSubscriptionId } = req.body;
      if (!planId) return sendError(res, 'planId required', 400);

      await userCollection.updateOne(
        { userId },
        { $set: { plan: planId, stripeSubscriptionId: stripeSubscriptionId || null, updatedAt: new Date() } },
      );

      sendSuccess(res, { message: 'Plan updated', planId });
    } catch (err: any) {
      sendError(res, err.message || 'Failed to update plan');
    }
  });

  // POST /api/payments/cancel — cancel current subscription
  router.post('/cancel', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      if (!userId) return sendError(res, 'Unauthorized', 401);

      const user = await userCollection.findOne({ userId });
      if (!user) return sendError(res, 'User not found', 404);

      if (!user.stripeSubscriptionId) {
        return sendError(res, 'No active subscription to cancel', 400);
      }

      await getStripe().subscriptions.cancel(user.stripeSubscriptionId);

      const fallbackPlan: PlanType = user.role === 'recruiter' ? 'recruiter_free' : 'free_seeker';
      await userCollection.updateOne(
        { userId },
        { $set: { plan: fallbackPlan, stripeSubscriptionId: null, updatedAt: new Date() } },
      );

      sendSuccess(res, { message: 'Subscription cancelled' });
    } catch (err: any) {
      sendError(res, err.message || 'Failed to cancel subscription');
    }
  });

  return router;
}
