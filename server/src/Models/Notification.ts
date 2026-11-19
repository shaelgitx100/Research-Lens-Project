import { Schema, model } from 'mongoose';

const notificationSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['paperAnalyzed', 'gapIdentified', 'reportGenerated', 'projectUpdated', 'libraryUpdated', 'importFailed'],
      required: true,
    },
    message: { type: String, required: true, maxlength: 400 },
    link: { type: String, default: '', maxlength: 200 },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);
notificationSchema.index({ ownerId: 1, createdAt: -1 });
export const Notification = model('Notification', notificationSchema);
