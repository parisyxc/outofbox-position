import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const daily = defineCollection({
  // src/generated/daily is written by scripts/sync.mjs from reports/DATE/DATE.md.
  loader: glob({ pattern: '????-??-??.md', base: './src/generated/daily' }),
  schema: z.object({
    date: z.coerce.date(),
    headline: z.string().optional(),
    summary: z.string().default(''),
    focus: z.array(z.string()).default([]),
    watch: z.array(z.string()).default([]),
    picks: z
      .array(z.object({ ticker: z.string(), price: z.number(), score: z.number(), plan: z.string() }))
      .default([]),
    docx: z.array(z.string()).default([]),
    lang: z.enum(['en', 'zh']).default('en'),
  }),
});

export const collections = { daily };
