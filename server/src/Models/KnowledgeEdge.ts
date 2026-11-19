import { Schema, model } from 'mongoose';

const edgeSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'ResearchProject', required: true, index: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sourceNodeId: { type: Schema.Types.ObjectId, ref: 'KnowledgeNode', required: true },
  targetNodeId: { type: Schema.Types.ObjectId, ref: 'KnowledgeNode', required: true },
  relationshipType: { type: String, required: true, maxlength: 60 },
  evidencePaperIds: [{ type: Schema.Types.ObjectId, ref: 'Paper' }],
  description: { type: String, default: '', maxlength: 1500 },
  isManual: { type: Boolean, default: false },
  isDemo: { type: Boolean, default: false },
});
export const KnowledgeEdge = model('KnowledgeEdge', edgeSchema);
