import multer from 'multer';
import { env } from '../Config/env';
import { AppError } from '../Utils/AppError';

export const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const okMime = file.mimetype === 'application/pdf';
    const okExt = /\.pdf$/i.test(file.originalname);
    if (!okMime || !okExt) return cb(new AppError(400, 'Only PDF files are supported'));
    cb(null, true);
  },
});
