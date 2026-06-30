import 'dotenv/config';
import { defineConfig } from '@prisma/config';

export default defineConfig({
  migrations: {
    // tsx handles the ESM/TypeScript conversion automatically
    seed: 'npx tsx ./prisma/seed.ts',
  },
  datasource: {
    url: process.env.DIRECT_URL!, 
  },
});