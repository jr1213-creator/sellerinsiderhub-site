import { createInvestorHandler } from '../lib/investor-auth.mjs';

// Static literals are required by Netlify's build-time config parser.
// These routes serve protected pages/assets or clear a session. They never
// verify a submitted password; login has its own stricter platform limit.
export const config = {
  path: [
    '/partners/investors',
    '/partners/investors/*',
    '/.netlify/functions/investor-portal',
    '/.netlify/functions/investor-portal/*',
  ],
  excludedPath: ['/partners/investors/login'],
  preferStatic: false,
  rateLimit: {
    action: 'rate_limit',
    windowLimit: 120,
    windowSize: 60,
    aggregateBy: ['ip', 'domain'],
  },
};

export default createInvestorHandler();
