import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Zap, BarChart3, Target } from 'lucide-react';
import { login as apiLogin } from '../utils/api';
import { useAuth } from '../App';

function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Se gia' autenticato, reindirizza
  if (isAuthenticated) {
    navigate('/diagnosi', { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await apiLogin(email, password);
      login(data.token, data.user);
      navigate('/diagnosi', { replace: true });
    } catch (err) {
      setError(err.message || 'Errore durante il login. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Pannello sinistro - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-mia-dark via-blue-900 to-mia-blue relative overflow-hidden">
        {/* Pattern decorativo di sfondo */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-mia-green rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-mia-yellow rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <span className="text-4xl font-bold tracking-tight">MIA</span>
            </div>
            <h1 className="text-3xl font-bold mb-4 leading-tight">
              Diagnosi Pubblicita
            </h1>
            <p className="text-lg text-blue-200 leading-relaxed max-w-md">
              Analizza, diagnostica e ottimizza le tue campagne pubblicitarie
              con intelligenza artificiale.
            </p>
          </div>

          {/* Feature highlights */}
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                <BarChart3 className="w-5 h-5 text-mia-green" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">Analisi Completa</h3>
                <p className="text-blue-200 text-sm">
                  Panoramica dettagliata di tutte le metriche delle tue campagne
                  Google Ads e Meta Ads.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                <Target className="w-5 h-5 text-mia-yellow" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">Piano d'Azione</h3>
                <p className="text-blue-200 text-sm">
                  Suggerimenti concreti con priorita' chiare per migliorare
                  le performance in 7 e 30 giorni.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                <Zap className="w-5 h-5 text-mia-red" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">Diagnosi Intelligente</h3>
                <p className="text-blue-200 text-sm">
                  Identificazione automatica dei problemi critici e delle
                  opportunita' di crescita.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pannello destro - Form di login */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-12 h-12 bg-mia-blue rounded-2xl flex items-center justify-center">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <span className="text-3xl font-bold text-mia-dark">MIA</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-mia-dark mb-2">
              Bentornato
            </h2>
            <p className="text-slate-500">
              Accedi per visualizzare la diagnosi delle tue campagne
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Campo Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@azienda.it"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-mia-blue/20 focus:border-mia-blue transition-smooth"
              />
            </div>

            {/* Campo Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Inserisci la password"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-mia-blue/20 focus:border-mia-blue transition-smooth pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-smooth"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Messaggio di errore */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm animate-fade-in">
                {error}
              </div>
            )}

            {/* Pulsante Login */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-mia-blue hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-smooth flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-mia-blue/25 hover:shadow-mia-blue/40"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Accesso in corso...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Accedi</span>
                </>
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}

export default Login;
