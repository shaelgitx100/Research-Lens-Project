import { z } from 'zod';

export const projectSchema = z.object({
  title: z.string().trim().min(1).max(200), topic: z.string().max(300).optional(),
  description: z.string().max(5000).optional(), objectives: z.string().max(5000).optional(),
  keywords: z.array(z.string().max(100)).max(30).optional(), domain: z.string().max(150).optional(),
  status: z.enum(['Active', 'Planning', 'Completed', 'Archived']).optional(),
});
