import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

// ISO 8601 datetime: YYYY-MM-DDTHH:MM (timezone assumed UTC)
const isoDateTime = z.string().regex(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
  'Date must be in ISO 8601 format: YYYY-MM-DDTHH:MM (e.g. 2026-04-12T09:00)'
);

const blog = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    date: isoDateTime,
    tags: z.array(z.string()),
    excerpt: z.string(),
  }),
});

export const collections = { blog };