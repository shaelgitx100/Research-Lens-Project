import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendPasswordResetEmail } = vi.hoisted(() => ({
  sendPasswordResetEmail: vi.fn(),
}));
vi.mock('../Services/email.service.js', () => ({ sendPasswordResetEmail }));

import User from '../Models/User.js';
import { resetPassword } from '../Controllers/auth.controller.js';

describe('password reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates the stored password hash and clears the selected reset credentials', async () => {
    const user = {
      name: 'Researcher',
      email: 'researcher@example.test',
      passwordHash: 'old-hash',
      role: 'researcher' as const,
      institution: '',
      bio: '',
      preferences: { theme: 'dark', notifications: {} },
      resetTokenHash: 'token-hash',
      resetTokenExpiresAt: new Date(Date.now() + 60_000),
    };
    const document = new User(user);
    const query = User.findOne();
    const findOneSpy = vi.spyOn(User, 'findOne').mockReturnValue(query);
    const select = vi.spyOn(query, 'select');
    vi.spyOn(query, 'exec').mockResolvedValue(document);
    const save = vi.spyOn(document, 'save').mockResolvedValue(document);
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    await resetPassword(
      { params: { token: 'reset-token' }, body: { password: 'a-secure-password' } },
      response,
    );

    expect(findOneSpy).toHaveBeenCalledWith({
      resetTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      resetTokenExpiresAt: { $gt: expect.any(Date) },
    });
    expect(select).toHaveBeenCalledWith('+resetTokenHash +resetTokenExpiresAt');
    expect(document.passwordHash).not.toBe('old-hash');
    expect(document.resetTokenHash).toBeUndefined();
    expect(document.resetTokenExpiresAt).toBeUndefined();
    expect(save).toHaveBeenCalledOnce();
    expect(response.json).toHaveBeenCalledWith({ message: 'Password successfully reset.' });
  });
});
