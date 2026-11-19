import { Schema, model } from 'mongoose';

export const NODE_TYPES = ['paper', 'author', 'topic', 'keyword', 'methodology', 'dataset', 'limitation', 'gap'] as const;

const nodeSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'ResearchProject', required: true, index: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  key: { type: String, required: true, maxlength: 400 },
  label: { type: String, required: true, maxlength: 300 },
  type: { type: String, enum: NODE_TYPES, required: true },
  description: { type: String, default: '', maxlength: 2000 },
  relatedEntityId: { type: Schema.Types.ObjectId },
  isManual: { type: Boolean, default: false },
  isDemo: { type: Boolean, default: false },
});
nodeSchema.index({ projectId: 1, key: 1 }, { unique: true });
export const KnowledgeNode = model('KnowledgeNode', nodeSchema);
