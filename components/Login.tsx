import React, { useState } from 'react';
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
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#00050D]">

      {/* 🚀 --- RICH NEBULA BACKGROUND --- */}

      {/* 1. Nebula Layers */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-20%] w-[120%] h-[80%] bg-[radial-gradient(ellipse_at_center,_#1e3a8a_0%,_transparent_70%)] opacity-30 mix-blend-screen"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[100%] h-[100%] bg-[radial-gradient(ellipse_at_center,_#0c4a6e_0%,_transparent_70%)] opacity-20 mix-blend-screen"></div>

        {/* Vibrant Cyan Glows */}
        <div className="absolute top-[20%] right-[10%] w-96 h-96 bg-cyan-600/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[30%] left-[10%] w-80 h-80 bg-blue-600/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '3s' }}></div>
      </div>

      {/* 2. Starfield & Stardust */}
      <div className="absolute inset-0 z-0 opacity-45 pointer-events-none"
        style={{
          backgroundImage: `
               radial-gradient(1.5px 1.5px at 10% 10%, #fff, transparent),
               radial-gradient(2px 2px at 20% 40%, #fff, transparent),
               radial-gradient(1px 1px at 40% 20%, #eff, transparent),
               radial-gradient(1.5px 1.5px at 60% 80%, #fff, transparent),
               radial-gradient(2px 2px at 80% 60%, #fff, transparent),
               radial-gradient(1px 1px at 90% 30%, #fff, transparent)
             `,
          backgroundSize: '250px 250px',
          animation: 'twinkle 4s infinite ease-in-out'
        }}>
      </div>

      {/* 3. SIDE CIRCUITRY PATTERNS */}
      <div className="absolute inset-y-0 left-0 w-48 z-10 opacity-30 pointer-events-none">
        <div className="h-full w-full flex flex-col justify-around py-32 pl-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="relative">
              <div className="h-[2px] w-16 bg-gradient-to-r from-cyan-500/60 to-transparent shadow-[0_0_8px_#1e3a8a]"></div>
              <div className="h-[10px] w-[2px] bg-cyan-500/40 absolute -bottom-1 left-8"></div>
              <div className="h-[2px] w-24 bg-gradient-to-r from-cyan-500/20 to-transparent mt-3"></div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute inset-y-0 right-0 w-48 z-10 opacity-30 pointer-events-none flex flex-col items-end">
        <div className="h-full w-full flex flex-col justify-around py-32 pr-4 items-end">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="relative flex flex-col items-end">
              <div className="h-[2px] w-16 bg-gradient-to-l from-cyan-500/60 to-transparent shadow-[0_0_8px_#1e3a8a]"></div>
              <div className="h-[10px] w-[2px] bg-cyan-500/40 absolute -bottom-1 right-8"></div>
              <div className="h-[2px] w-24 bg-gradient-to-l from-cyan-500/20 to-transparent mt-3"></div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Moving Scanlines / Grid */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none animate-grid-flow"
        style={{
          backgroundImage: 'linear-gradient(rgba(34, 211, 238, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 211, 238, 0.1) 1px, transparent 1px)',
          backgroundSize: '100px 100px'
        }}>
      </div>
      <div className="absolute inset-0 z-0 opacity-[0.05] pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full animate-scanline bg-gradient-to-b from-transparent via-cyan-400 to-transparent"></div>
      </div>

      {/* 🛡️ --- MAIN INTERFACE --- */}
      <div className="relative z-20 w-full max-w-xl p-6 flex flex-col items-center">

        {/* HUD Frame Container */}
        <div className="relative w-full max-w-md">

          {/* OUTER AMBIENT GLOW */}
          <div className="absolute -inset-10 bg-cyan-500/5 rounded-[60px] blur-[100px] pointer-events-none"></div>

          {/* FRAME BORDERS & BACKGROUND */}
          <div className="absolute -top-3 -bottom-3 -left-3 -right-3 border border-cyan-500/10 rounded-[44px] pointer-events-none"></div>
          <div className="absolute inset-0 border border-white/5 rounded-[32px] pointer-events-none bg-[#020B1A]/85 backdrop-blur-3xl shadow-2xl"></div>

          {/* TOP GLOW ACCENT */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-[3px] bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_20px_#22d3ee]"></div>

          {/* CONTENT BOX */}
          <div className="relative p-10 flex flex-col items-center">

            {/* LOGO AREA - Final Intensive Version */}
            <div className="mb-4 relative flex flex-col items-center">
              {/* Dark base for blending */}
              <div className="absolute inset-0 bg-[#020B1A] rounded-full blur-[15px] transform scale-75"></div>
              {/* Intense Cyan Halo */}
              <div className="absolute inset-0 bg-cyan-400/40 blur-[50px] rounded-full animate-pulse transition-all duration-1000"></div>

              <img
                src="/logo-msm-intensified.png"
                alt="MSM Logo"
                className="relative z-10 w-64 h-64 object-contain transition-transform duration-700 hover:scale-105"
                style={{
                  maskImage: 'radial-gradient(circle, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 70%)',
                  WebkitMaskImage: 'radial-gradient(circle, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 70%)',
                  filter: 'drop-shadow(0 0 20px rgba(34, 211, 238, 0.6)) contrast(1.15) saturate(1.1)'
                }}
              />
            </div>

            {/* WELCOME SECTION */}
            <div className="text-center mb-10 w-full">
              <h2 className="text-3xl font-black text-white tracking-wide mb-1.5 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">Bem-vindo de volta</h2>
              <p className="text-slate-400 text-xs font-bold tracking-tight opacity-70">Acesse o Sistema de Gestão de Produção</p>
            </div>

            {/* FORM FIELDS */}
            <form onSubmit={handleSubmit} className="w-full space-y-7">
              <div className="space-y-2 group">
                <label className="text-cyan-400 text-[10px] font-black uppercase tracking-[0.35em] ml-1 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full inline-block shadow-[0_0_10px_#22d3ee]"></span>
                  USUÁRIO
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-cyan-300 transition-colors">
                    <UserIcon className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    autoComplete="off"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-[#0A1628]! rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/40 transition-all text-white! placeholder:text-slate-600 font-black text-lg custom-input"
                    placeholder="Digite seu usuário"
                  />
                </div>
              </div>

              <div className="space-y-2 group">
                <label className="text-cyan-400 text-[10px] font-black uppercase tracking-[0.35em] ml-1 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full inline-block shadow-[0_0_10px_#22d3ee]"></span>
                  SENHA
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-cyan-300 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-[#0A1628]! rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/40 transition-all text-white! placeholder:text-slate-600 font-black text-lg custom-input"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-900/10 border border-red-500/40 p-3 rounded-lg flex items-center gap-3 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <p className="text-red-400 text-xs font-black tracking-tight">{error}</p>
                </div>
              )}

              <button
                type="submit"
                className="w-full relative group p-[2px] rounded-xl overflow-hidden focus:outline-none transition-all hover:shadow-[0_0_25px_rgba(34,211,238,0.4)]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-700 via-cyan-500 to-blue-700 bg-[length:200%_auto] animate-gradient-spin"></div>
                <div className="relative py-4 bg-[#020B1A]/80 backdrop-blur-md rounded-[10px] flex items-center justify-center transition-all duration-300 group-hover:bg-transparent">
                  <span className="text-white font-black tracking-[0.25em] text-sm uppercase drop-shadow-lg">Entrar no Sistema</span>
                </div>
              </button>
            </form>

            {/* COPYRIGHT FOOTER */}
            <div className="mt-14 text-center">
              <p className="text-[10px] text-slate-600 font-bold tracking-widest opacity-50 uppercase">
                &copy; {new Date().getFullYear()} MSM Indústria. Todos os direitos reservados.
              </p>
            </div>
          </div>

          {/* BOTTOM ACCENT */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-48 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent"></div>
        </div>
      </div>

      <style jsx>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.05); }
        }
        @keyframes scanline {
          0% { transform: translateY(-100%); opacity: 0; }
          40% { opacity: 0.6; }
          60% { opacity: 0.6; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        @keyframes grid-flow {
          from { background-position: 0 0; }
          to { background-position: 100px 100px; }
        }
        @keyframes gradient-spin {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        /* Force Input Styling */
        .custom-input {
          background-color: #0A1628 !important;
          color: white !important;
          border: 1px solid rgba(30, 41, 59, 0.8) !important;
        }

        .custom-input:focus {
          background-color: #0F172A !important;
          border-color: #06b6d4 !important;
          box-shadow: 0 0 15px rgba(6, 182, 212, 0.3) !important;
        }

        /* Autofill overrides for browsers */
        .custom-input:-webkit-autofill,
        .custom-input:-webkit-autofill:hover, 
        .custom-input:-webkit-autofill:focus, 
        .custom-input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px #0A1628 inset !important;
          -webkit-text-fill-color: white !important;
          caret-color: white !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>
    </div>
  );
};

export default Login;