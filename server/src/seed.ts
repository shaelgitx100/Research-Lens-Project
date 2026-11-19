import { connectDB } from './Config/db';
import { User } from './Models/User';
import { loadDemo } from './Services/demoService';
import mongoose from 'mongoose';

/** Usage: npm run seed -- user@example.com  (loads the DEMO environment into an existing account) */
async function main() {
  const email = process.argv[2]?.toLowerCase();
  if (!email) throw new Error('Provide the email of an existing account: npm run seed -- user@example.com');
  await connectDB();
  const user = await User.findOne({ email }).select('_id');
  if (!user) throw new Error('No account found for that email. Register first.');
  console.log(await loadDemo(String(user._id)));
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
