import config from '@app/eslint-config/nextjs';

export default [
  ...config,
  {
    ignores: [
      '.next/**',
      'src/payload-types.ts',
      'src/payload-generated-schema.ts',
      'next-env.d.ts',
    ],
  },
];
