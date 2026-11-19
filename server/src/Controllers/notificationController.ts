import { Notification } from '../Models/Notification';
import { asyncHandler } from '../Utils/asyncHandler';

export const list = asyncHandler(async (req, res) => {
  const [items, unread] = await Promise.all([
    Notification.find({ ownerId: req.user!.id }).sort({ createdAt: -1 }).limit(30).lean(),
    Notification.countDocuments({ ownerId: req.user!.id, read: false }),
  ]);
  res.json({ notifications: items.map((n: any) => ({ ...n, id: String(n._id) })), unread });
});

export const markRead = asyncHandler(async (req, res) => {
  const filter: any = { ownerId: req.user!.id };
  if (req.body.ids?.length) filter._id = { $in: req.body.ids };
  await Notification.updateMany(filter, { read: true });
  res.json({ ok: true });
});
