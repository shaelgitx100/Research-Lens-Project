import mongoose, { Schema } from 'mongoose';

const citationSchema = new Schema({
  paperId: { type: Schema.Types.ObjectId, ref: 'Paper', required: true, index: true },
  citedPaperId: { type: Schema.Types.ObjectId, ref: 'Paper', index: true },
  style: { type: String, default: 'APA' }, formattedText: { type: String, required: true },
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
}, { timestamps: true });

export const Citation = mongoose.models.Citation || mongoose.model('Citation', citationSchema);
export default Citation;
