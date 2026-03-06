let app;
try {
  const mod = await import('../server/index.js');
  app = mod.default;
} catch (err) {
  // Se il server non si carica, restituisci l'errore per debug
  app = (req, res) => {
    res.status(500).json({
      error: 'Server failed to initialize',
      message: err.message,
      stack: err.stack
    });
  };
}

export default app;
