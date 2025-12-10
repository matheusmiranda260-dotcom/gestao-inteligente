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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#020F18]">
      {/* Tech Background Effects */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#1A5A7D_0%,#0A2A3D_50%,#020F18_100%)]"></div>
        <div className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'linear-gradient(#00E5FF 1px, transparent 1px), linear-gradient(90deg, #00E5FF 1px, transparent 1px)',
            backgroundSize: '50px 50px',
            maskImage: 'linear-gradient(to bottom, white, transparent)'
          }}>
        </div>
      </div>

      {/* Animated Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00E5FF] rounded-full mix-blend-screen filter blur-[100px] opacity-20 animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#FF8C00] rounded-full mix-blend-screen filter blur-[100px] opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>

      {/* Login Card */}
      <div className="max-w-md w-full glass-dark p-10 rounded-3xl shadow-2xl text-center animate-slide-up relative z-10 border border-white/10 backdrop-blur-xl">
        {/* Logo Area */}
        <div className="mb-8 flex flex-col items-center justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-[#00E5FF] blur-xl opacity-20 rounded-full"></div>
            <MSMLogo size="lg" showText={true} />
          </div>
        </div>

        <h2 className="text-3xl font-bold text-white mb-2 font-display tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
          Bem-vindo de volta
        </h2>
        <p className="text-[#94A3B8] mb-8 text-sm font-medium">
          Acesse o Sistema de Gestão de Produção
        </p>

        <form onSubmit={handleSubmit} className="text-left space-y-6">
          <div className="group">
            <label className="block text-[#00E5FF] text-xs font-bold uppercase tracking-widest mb-2 ml-1" htmlFor="username">
              Usuário
            </label>
            <div className="relative group-focus-within:transform group-focus-within:-translate-y-1 transition-transform duration-300">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                <UserIcon className="h-5 w-5 text-slate-400 group-focus-within:text-[#FF8C00] transition-colors duration-300" />
              </div>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-xl border border-white/10 bg-white/5 focus:bg-white/10 focus:border-[#FF8C00] focus:ring-1 focus:ring-[#FF8C00] outline-none transition-all duration-300 text-white placeholder-slate-500 shadow-inner"
                required
                placeholder="Digite seu usuário"
              />
            </div>
          </div>

          <div className="group">
            <label className="block text-[#00E5FF] text-xs font-bold uppercase tracking-widest mb-2 ml-1" htmlFor="password">
              Senha
            </label>
            <div className="relative group-focus-within:transform group-focus-within:-translate-y-1 transition-transform duration-300">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 group-focus-within:text-[#FF8C00] transition-colors duration-300" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-xl border border-white/10 bg-white/5 focus:bg-white/10 focus:border-[#FF8C00] focus:ring-1 focus:ring-[#FF8C00] outline-none transition-all duration-300 text-white placeholder-slate-500 shadow-inner"
                required
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center animate-fade-in backdrop-blur-md">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400 mr-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-red-200 text-sm font-medium">{error}</p>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className="btn-secondary w-full py-4 text-lg shadow-[0_4px_20px_rgba(255,140,0,0.4)] hover:shadow-[0_6px_30px_rgba(255,140,0,0.6)] border border-white/10"
            >
              Entrar no Sistema
            </button>
          </div>
        </form>

        <div className="mt-10 pt-6 border-t border-white/5">
          <p className="text-xs text-slate-500 font-medium">
            &copy; {new Date().getFullYear()} MSM Indústria. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;