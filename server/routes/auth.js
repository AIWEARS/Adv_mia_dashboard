import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'mia-diagnosi-secret-key-2024-change-in-production';

// Utenti demo (in produzione: database con password cifrate)
const DEMO_USERS = [
  {
    id: 1,
    email: 'demo@itsmia.it',
    password: 'mia2024',
    name: 'MIA Team',
    role: 'admin'
  }
];

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: true,
      message: 'Inserisci email e password.'
    });
  }

  const user = DEMO_USERS.find(
    u => u.email === email && u.password === password
  );

  if (!user) {
    return res.status(401).json({
      error: true,
      message: 'Email o password errata.'
    });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  });
});

// GET /api/auth/me - Verifica token e ritorna dati utente
router.get('/me', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: true, message: 'Non autenticato' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role
    });
  } catch {
    res.status(403).json({ error: true, message: 'Token scaduto o non valido' });
  }
});

export default router;
