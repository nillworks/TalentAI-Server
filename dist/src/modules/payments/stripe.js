import Stripe from 'stripe';
let _stripe = null;
export function getStripe() {
    if (_stripe)
        return _stripe;
    const apiKey = process.env.STRIPE_SECRET_KEY || '';
    if (!apiKey || apiKey.startsWith('sk_test_your')) {
        throw new Error('Stripe is not configured. Set a valid STRIPE_SECRET_KEY in your backend .env file and restart the server.');
    }
    _stripe = new Stripe(apiKey);
    return _stripe;
}
export function isStripeConfigured() {
    try {
        getStripe();
        return true;
    }
    catch {
        return false;
    }
}
