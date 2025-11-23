import React, { useState } from 'react';
import { LogoFull } from './Logo';
import { UserIcon, LockClosedIcon } from './icons';

interface LoginProps {
  onLogin: (username: string, password: string) => void;
  error: string | null;
}

const Login: React.FC<LoginProps> = ({ onLogin, error }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(username, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-slate-50 via-primary-50 to-white p-4">
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10"></div>

      <div className="max-w-md w-full glass p-8 rounded-2xl shadow-xl text-center animate-slide-up border border-white/60">
        <div className="flex justify-center mb-8">
          <div className="p-3 bg-primary-50 rounded-full shadow-inner">
            <LogoFull iconClassName="h-12 w-12 text-primary-600" textClassName="text-3xl font-bold text-slate-800 ml-2" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-slate-800 mb-2 font-display">Bem-vindo de volta</h2>
        <p className="text-slate-500 mb-8 text-sm">Acesse o sistema de Gestão Inteligente</p>

        <form onSubmit={handleSubmit} className="text-left space-y-5">
          <div className="group">
            <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-2 ml-1" htmlFor="username">
              Usuário
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserIcon className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
              </div>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all duration-200 bg-white/50 focus:bg-white font-medium text-slate-700 placeholder-slate-400"
                required
                placeholder="gestor"
              />
            </div>
          </div>

          <div className="group">
            <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-2 ml-1" htmlFor="password">
              Senha
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all duration-200 bg-white/50 focus:bg-white font-medium text-slate-700 placeholder-slate-400"
                required
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 p-3 rounded-lg flex items-center animate-fade-in">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-red-600 text-sm font-medium">{error}</p>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 transform hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Entrar no Sistema
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100/50">
          <p className="text-xs text-slate-400 font-medium">
            &copy; {new Date().getFullYear()} MSM Indústria. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;