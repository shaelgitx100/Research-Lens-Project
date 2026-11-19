import { Schema, model } from 'mongoose';

const themeSchema = new Schema(
  {
    themeId: { type: String, required: true },
    title: { type: String, required: true, maxlength: 200 },
    paperIds: [{ type: Schema.Types.ObjectId, ref: 'Paper' }],
    summary: { type: String, default: '', maxlength: 6000 },
    summaryOrigin: { type: String, enum: ['sourceDerived', 'userWritten', 'aiSuggested'], default: 'userWritten' },
    notes: { type: String, default: '', maxlength: 6000 },
  },
  { _id: false }
);

const reviewSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'ResearchProject', required: true },
    themes: { type: [themeSchema], default: [] },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);
reviewSchema.index({ projectId: 1, ownerId: 1 }, { unique: true });
export const LiteratureReview = model('LiteratureReview', reviewSchema);
