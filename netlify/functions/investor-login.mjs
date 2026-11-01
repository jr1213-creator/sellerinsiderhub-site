import { createInvestorHandler } from '../lib/investor-auth.mjs';

// A custom path disables Netlify's default function URL. The handler also
// rejects aliases itself, including direct invocation in tests or rewrites.
// Native rate limiting is available on all Netlify plans. Enforcement can lag
// by up to ten seconds; it is not an account lockout or a strong-password substitute.
export const config = {
  path: '/partners/investors/login',
  preferStatic: false,
  rateLimit: {
    action: 'rate_limit',
    windowLimit: 6,
    windowSize: 60,
    aggregateBy: ['ip', 'domain'],
  },
};

export default createInvestorHandler({ mode: 'login' });
