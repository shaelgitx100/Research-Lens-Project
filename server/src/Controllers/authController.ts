import { asyncHandler } from '../Utils/asyncHandler.js';
import { loginSchema, registerSchema } from '../Validators/authValidator.js';
import { loginUser, registerUser } from '../Services/authService.js';
import { User } from '../model/index.js';

export const register = asyncHandler(async (req, res) => res.status(201).json(await registerUser(registerSchema.parse(req.body))));
export const login = asyncHandler(async (req, res) => res.json(await loginUser(loginSchema.parse(req.body))));
export const currentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).select('name email role createdAt');
  if (!user) return res.status(404).json({ error: 'Account not found.' });
  return res.json({ user });
});
