import { Schema, model } from 'mongoose';

const projectSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    topic: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, trim: true, maxlength: 4000, default: '' },
    objectives: { type: [String], default: [] },
    keywords: { type: [String], default: [] },
    domain: { type: String, trim: true, maxlength: 80, default: '' },
    status: { type: String, enum: ['planning', 'collecting', 'analyzing', 'reviewing', 'completed'], default: 'planning' },
    isDemo: { type: Boolean, default: false },
    guided: { type: Boolean, default: false },
  },
  { timestamps: true }
);
projectSchema.index({ ownerId: 1, createdAt: -1 });
export const ResearchProject = model('ResearchProject', projectSchema);
