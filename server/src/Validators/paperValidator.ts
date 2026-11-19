import { z } from 'zod';

export const paperSchema = z.object({
  title: z.string().trim().min(1).max(500),
  authors: z.array(z.string().trim().max(200)).max(100).default([]),
  abstract: z.string().max(50_000).optional(),
  publicationYear: z.number().int().min(1500).max(2100).nullable().optional(),
  venue: z.string().max(500).optional(), doi: z.string().max(500).optional(),
  source: z.string().max(100).optional(), externalId: z.string().max(500).optional(),
  keywords: z.array(z.string().max(100)).max(100).default([]),
  publicationUrl: z.string().url().max(1000).optional(), projectId: z.string().optional(),
});
