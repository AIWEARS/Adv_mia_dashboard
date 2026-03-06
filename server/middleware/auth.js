/**
 * Auth middleware disabilitato - accesso libero senza login.
 * Tutte le route sono accessibili direttamente.
 */

export function authenticateToken(req, res, next) {
  req.user = { id: 1, email: 'user@mia.it', name: 'MIA User', role: 'admin' };
  next();
}

export function authMiddleware(req, res, next) {
  req.user = { id: 1, email: 'user@mia.it', name: 'MIA User', role: 'admin' };
  next();
}


export default authenticateToken;
