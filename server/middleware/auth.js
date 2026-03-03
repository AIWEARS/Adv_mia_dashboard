import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'mia-diagnosi-secret-key-2024-change-in-production';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: true, message: 'Token di autenticazione mancante' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: true, message: 'Token non valido o scaduto' });
  }
}

export default authenticateToken;
