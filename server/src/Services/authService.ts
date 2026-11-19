import { User } from '../model/index.js';
import { hashPassword, verifyPassword } from '../Utils/passwordUtils.js';
import { generateToken } from '../Utils/generateToken.js';

export async function registerUser(input: { name: string; email: string; password: string }) {
  if (await User.exists({ email: input.email })) throw Object.assign(new Error('Account already exists.'), { status: 409 });
  const user = await User.create({ name: input.name, email: input.email, passwordHash: await hashPassword(input.password) });
  return { token: generateToken(String(user._id)), user: { id: String(user._id), name: user.name, email: user.email } };
}

export async function loginUser(input: { email: string; password: string }) {
  const user = await User.findOne({ email: input.email });
  if (!user || !await verifyPassword(input.password, user.passwordHash)) throw Object.assign(new Error('Invalid credentials.'), { status: 401 });
  return { token: generateToken(String(user._id)), user: { id: String(user._id), name: user.name, email: user.email } };
}
