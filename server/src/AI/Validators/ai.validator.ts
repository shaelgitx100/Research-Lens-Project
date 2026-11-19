import { z } from 'zod';

export const aiFeatureRequestSchema = z.object({
  paperId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid paper identifier.').optional(),
  paperIds: z.array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid paper identifier.')).min(1).max(20).optional(),
  projectId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid project identifier.').optional(),
  saveResult: z.boolean().optional(),
  topic: z.string().trim().min(1).max(1000).optional(),
  question: z.string().trim().min(1).max(4000).optional(),
  context: z.string().trim().min(1).max(30000).optional(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(4000),
  })).max(20).optional(),
}).strict().refine(
  (value) => Boolean(value.paperId || value.paperIds?.length || value.projectId || value.topic || value.context || value.question || value.messages?.length),
  'Provide a paper, project, topic, question, conversation, or context.',
);

export type AiFeatureRequestInput = z.infer<typeof aiFeatureRequestSchema>;

export function validateAiFeatureRequest(input: unknown) {
  return aiFeatureRequestSchema.safeParse(input);
}
