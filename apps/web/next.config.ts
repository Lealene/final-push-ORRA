import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@app/api-contracts', '@app/ui'],
  // Next.js 16.2 — forward browser console to the dev terminal so AI agents
  // (and humans tailing the terminal) catch client-side errors without
  // opening DevTools. Errors are forwarded by default; `true` forwards all.
  logging: {
    browserToTerminal: true,
  },
};

export default nextConfig;
