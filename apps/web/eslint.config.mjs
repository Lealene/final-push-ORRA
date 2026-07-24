import config from '@app/eslint-config/nextjs';

export default [
  ...config,
  {
    ignores: ['.next/**', 'out/**', 'build/**', 'next-env.d.ts'],
  },
];
