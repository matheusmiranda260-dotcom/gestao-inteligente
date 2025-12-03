import React, { useState } from 'react';
import MSMLogo from './MSMLogo';
import { UserIcon } from './icons';

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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 msm-gradient opacity-95"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent"></div>

      {/* Animated Circles */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-[#FF8C00] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#FF8C00] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>

      {/* Login Card */}
      <div className="max-w-md w-full glass p-10 rounded-3xl shadow-2xl text-center animate-slide-up border border-white/40 relative z-10">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <MSMLogo size="lg" showText={true} />
        </div>

        <h2 className="text-2xl font-bold text-white mb-2 font-display drop-shadow-md">Bem-vindo de volta</h2>
        <p className="text-white/80 mb-8 text-sm font-medium">Acesse o Sistema de Gestão de Produção</p>

        <form onSubmit={handleSubmit} className="text-left space-y-5">
          <div className="group">
            <label className="block text-white/90 text-xs font-semibold uppercase tracking-wider mb-2 ml-1" htmlFor="username">
              Usuário
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserIcon className="h-5 w-5 text-white/60 group-focus-within:text-[#FF8C00] transition-colors" />
              </div>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/30 focus:border-[#FF8C00] focus:ring-4 focus:ring-[#FF8C00]/20 outline-none transition-all duration-200 bg-white/90 backdrop-blur-sm font-medium text-[#0F3F5C] placeholder-slate-400"
                required
                placeholder="Digite seu usuário"
              />
            </div>
          </div>

          <div className="group">
            <label className="block text-white/90 text-xs font-semibold uppercase tracking-wider mb-2 ml-1" htmlFor="password">
              Senha
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white/60 group-focus-within:text-[#FF8C00] transition-colors" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/30 focus:border-[#FF8C00] focus:ring-4 focus:ring-[#FF8C00]/20 outline-none transition-all duration-200 bg-white/90 backdrop-blur-sm font-medium text-[#0F3F5C] placeholder-slate-400"
                required
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 p-3 rounded-lg flex items-center animate-fade-in backdrop-blur-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-red-700 text-sm font-medium">{error}</p>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-[#FF8C00] to-[#FFA333] hover:from-[#E67E00] hover:to-[#FF8C00] text-white font-bold py-4 px-4 rounded-xl shadow-lg shadow-[#FF8C00]/30 hover:shadow-[#FF8C00]/50 transform hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FF8C00] text-lg"
          >
            Entrar no Sistema
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/20">
          <p className="text-xs text-white/70 font-medium">
            &copy; {new Date().getFullYear()} MSM Indústria. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;