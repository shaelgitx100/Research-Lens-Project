import mongoose, { Schema } from 'mongoose';

const researchGapSchema = new Schema({
  title: { type: String, required: true, maxlength: 300 },
  description: { type: String, required: true, maxlength: 5000 },
  category: { type: String, maxlength: 100 }, strength: { type: String, maxlength: 50 },
  projectId: { type: Schema.Types.ObjectId, index: true },
  workspaceId: { type: Schema.Types.ObjectId, index: true },
  supportingPaperIds: [{ type: Schema.Types.ObjectId, ref: 'Paper' }],
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
}, { timestamps: true });

export const ResearchGap = mongoose.models.ResearchGap || mongoose.model('ResearchGap', researchGapSchema);
export default ResearchGap;
