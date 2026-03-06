import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createUser, findUserByEmail, findUserById } from '../models/userModel.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '1h';

function buildTokenPayload(user) {
  return {
    sub: user.id,
    email: user.email,
  };
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email и пароль обязательны' });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'Пароль должен быть длиннее 8 символов' });
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return res.status(409).json({ message: 'Пользователь с таким email уже существует' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await createUser({ email, passwordHash, displayName: name });

  const token = signToken(buildTokenPayload(user));

  return res.status(201).json({
    token,
    user,
  });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email и пароль обязательны' });
  }

  const user = await findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ message: 'Неверный email или пароль' });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    return res.status(401).json({ message: 'Неверный email или пароль' });
  }

  const token = signToken(buildTokenPayload(user));

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
  });
});

router.get('/me', authenticate, async (req, res) => {
  const profile = await findUserById(req.user.sub);

  if (!profile) {
    return res.status(404).json({ message: 'Пользователь не найден' });
  }

  return res.json({ user: profile });
});

export default router;
