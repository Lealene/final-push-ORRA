import config from '@app/eslint-config/base';

export default [
  ...config,
  {
    ignores: [
      '**/.next/**',
      '**/.turbo/**',
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/next-env.d.ts',
      'apps/backend/src/payload-types.ts',
      'apps/backend/src/payload-generated-schema.ts',
      'apps/backend/src/app/(payload)/admin/importMap.js',
      'pnpm-lock.yaml',
    ],
  },
];
