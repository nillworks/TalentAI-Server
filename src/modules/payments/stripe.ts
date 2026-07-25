import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;

  const apiKey = process.env.STRIPE_SECRET_KEY || '';
  if (!apiKey || apiKey.startsWith('sk_test_your')) {
    throw new Error(
      'Stripe is not configured. Set a valid STRIPE_SECRET_KEY in your backend .env file and restart the server.',
    );
  }

  _stripe = new Stripe(apiKey);

  return _stripe;
}

export function isStripeConfigured(): boolean {
  try {
    getStripe();
    return true;
  } catch {
    return false;
  }
}
