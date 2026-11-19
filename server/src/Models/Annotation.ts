import mongoose, { Schema } from 'mongoose';

const annotationSchema = new Schema({
  paperId: { type: Schema.Types.ObjectId, ref: 'Paper', required: true, index: true },
  page: { type: Number, min: 1 }, selectedText: { type: String, maxlength: 5000 },
  note: { type: String, required: true, maxlength: 10000 },
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
}, { timestamps: true });

export const Annotation = mongoose.models.Annotation || mongoose.model('Annotation', annotationSchema);
export default Annotation;
