import { Types } from 'mongoose';
import { Notification } from '../Models/Notification';
import { User } from '../Models/User';

type NType = 'paperAnalyzed' | 'gapIdentified' | 'reportGenerated' | 'projectUpdated' | 'libraryUpdated' | 'importFailed';

export async function notify(ownerId: string | Types.ObjectId, type: NType, message: string, link = '') {
  try {
    const u = await User.findById(ownerId).select('preferences').lean();
    if (u && u.preferences?.notifications?.[type] === false) return;
    await Notification.create({ ownerId, type, message, link });
  } catch {
    /* notifications are best effort */
  }
}
