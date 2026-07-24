import { withPayload } from '@payloadcms/next/withPayload';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@app/api-contracts'],
  // Next.js 16.2 — forward browser console to the dev terminal so AI agents
  // (and humans tailing the terminal) catch client-side errors without
  // opening DevTools. Errors are forwarded by default; `true` forwards all.
  logging: {
    browserToTerminal: true,
  },
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    };

    return webpackConfig;
  },
};

export default withPayload(nextConfig, { devBundleServerPackages: false });
