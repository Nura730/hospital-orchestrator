/**
 * @file LoginPage.jsx
 * Sign-in for the three MediOrchestra roles (Admin, Doctor, OT Manager): one-click demo buttons
 * using the seeded backend accounts, or email + password with a role selector.
 */

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { Activity, ShieldCheck, Stethoscope, Scissors, Lock, Mail, ArrowRight, Loader2, Radar, Brain, Zap } from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';
import { ROLES, DEFAULT_USERS, ROLE_HOME, isRouteAllowed } from '../utils/roles.js';

const ROLE_OPTIONS = [
  { key: 'admin', role: ROLES.ADMIN, label: 'Hospital Admin', hint: 'Command Center, simulator, discharge planning', icon: ShieldCheck },
  { key: 'doctor', role: ROLES.DOCTOR, label: 'Doctor', hint: 'Your patients, predictions, discharges', icon: Stethoscope },
  { key: 'ot_manager', role: ROLES.OT_MANAGER, label: 'OT Manager', hint: 'Theatres, post-op beds, ICU overflow', icon: Scissors },
];

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const loginAsDemo = useAuthStore((s) => s.loginAsDemo);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);

  const [selected, setSelected] = useState('admin');
  const [email, setEmail] = useState(DEFAULT_USERS.admin.backendEmail);
  const [password, setPassword] = useState('');
  const [pendingDemo, setPendingDemo] = useState(null);

  const goHome = (role) => {
    const from = location.state?.from?.pathname;
    navigate(from && from !== '/' && isRouteAllowed(role, from) ? from : ROLE_HOME[role] || '/', { replace: true });
  };

  const pickRole = (key) => {
    setSelected(key);
    setEmail(DEFAULT_USERS[key].backendEmail);
    setPassword('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const role = DEFAULT_USERS[selected].role;
    const result = await login({ email, password, role });
    if (result.success) goHome(useAuthStore.getState().role || role);
  };

  const handleDemo = async (key) => {
    setPendingDemo(key);
    setSelected(key);
    const result = await loginAsDemo(key);
    setPendingDemo(null);
    if (result.success) goHome(useAuthStore.getState().role || DEFAULT_USERS[key].role);
  };

  return (
    <div className="min-h-screen w-screen flex bg-cream-100 text-ink-900">
      {/* Left: what the product does */}
      <section className="hidden lg:flex flex-col justify-between w-[46%] p-12 bg-gradient-to-br from-royal-900 via-royal-700 to-royal-500 text-white relative overflow-hidden">
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-white/5" aria-hidden="true" />
        <div className="absolute -left-16 bottom-10 w-72 h-72 rounded-full bg-white/5" aria-hidden="true" />

        <div className="flex items-center gap-3 relative">
          <div className="w-11 h-11 rounded-xl bg-white text-royal-500 flex items-center justify-center shadow-lg">
            <Activity className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">MediOrchestra</h1>
            <p className="text-xs text-white/70 tracking-wide uppercase">Predictive Flow Intelligence</p>
          </div>
        </div>

        <div className="space-y-6 relative max-w-lg">
          <h2 className="text-3xl font-extrabold leading-snug">See what will happen, and act on it, before the bottleneck forms.</h2>
          <p className="text-sm text-white/80 leading-relaxed">
            Every action becomes an event, events drive state, and state drives the screen. Bottlenecks are predicted 60–90 minutes ahead and the right person is notified with one-tap actions.
          </p>
          <ul className="space-y-3 text-sm">
            {[
              [Radar, 'Live hospital map and state updated in seconds'],
              [Brain, 'Forecasts, bottleneck root cause and what-if simulation from your own history'],
              [Zap, 'Explainable AI reports: what is happening, why, and what to do'],
            ].map(([Icon, text]) => (
              <li key={text} className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </span>
                <span className="text-white/90 pt-1">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-white/60 relative">We close the loop between prediction and action in under 60 seconds.</p>
      </section>

      {/* Right: sign in */}
      <main className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          <div>
            <div className="lg:hidden flex items-center gap-2.5 mb-6">
              <div className="w-9 h-9 rounded-xl bg-royal-500 text-white flex items-center justify-center">
                <Activity className="w-5 h-5" aria-hidden="true" />
              </div>
              <span className="font-bold text-base text-royal-900">MediOrchestra</span>
            </div>
            <h2 className="text-2xl font-extrabold text-royal-900 tracking-tight">Sign in</h2>
            <p className="text-xs text-ink-500 mt-1">Choose your role. The demo buttons use the seeded accounts.</p>
          </div>

          {/* One-click demo roles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="group" aria-label="Quick demo login">
            {ROLE_OPTIONS.map((r) => {
              const Icon = r.icon;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => handleDemo(r.key)}
                  disabled={loading}
                  className={clsx(
                    'rounded-2xl border-2 p-3 text-left transition-colors bg-cream-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-royal-500 disabled:opacity-60',
                    selected === r.key ? 'border-royal-500 shadow-soft' : 'border-cream-200 hover:border-royal-500/40'
                  )}
                >
                  <span className="flex items-center justify-between">
                    <span className="w-8 h-8 rounded-lg bg-royal-100 text-royal-500 flex items-center justify-center">
                      {pendingDemo === r.key ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Icon className="w-4 h-4" aria-hidden="true" />}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-ink-500" aria-hidden="true" />
                  </span>
                  <span className="block text-xs font-bold text-royal-900 mt-2">{r.label}</span>
                  <span className="block text-[10px] text-ink-500 leading-snug mt-0.5">{r.hint}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-ink-500" aria-hidden="true">
            <span className="flex-1 h-px bg-cream-200" /> or sign in with email <span className="flex-1 h-px bg-cream-200" />
          </div>

          {error && (
            <div role="alert" className="p-3 rounded-xl bg-[#D64545]/10 border border-[#D64545]/30 text-[#B02E2E] text-xs font-medium">
              {typeof error === 'string' && error !== '[object Object]' ? error : 'Sign-in failed. Check the role, email and password.'}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 flow-card-pad">
            <fieldset>
              <legend className="text-xs font-semibold text-ink-900 mb-1.5">Role</legend>
              <div className="inline-flex w-full rounded-xl bg-cream-100 p-1 border border-cream-200">
                {ROLE_OPTIONS.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => pickRole(r.key)}
                    aria-pressed={selected === r.key}
                    className={clsx('flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-colors', selected === r.key ? 'bg-royal-500 text-white' : 'text-ink-500 hover:text-royal-500')}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="login-email" className="text-xs font-semibold text-ink-900">
                Email
              </label>
              <div className="relative mt-1">
                <Mail className="w-4 h-4 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                <input id="login-email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="flow-input !pl-9 !py-2.5" />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="text-xs font-semibold text-ink-900">
                Password
              </label>
              <div className="relative mt-1">
                <Lock className="w-4 h-4 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                <input id="login-password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="flow-input !pl-9 !py-2.5" />
              </div>
              <p className="text-[10px] text-ink-500 mt-1">
                Demo password for this role: <code className="font-mono">{DEFAULT_USERS[selected].demoPassword}</code>
              </p>
            </div>

            <button type="submit" disabled={loading} className="flow-btn-primary w-full !py-2.5 !text-sm">
              {loading && !pendingDemo ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : null}
              Sign in as {ROLE_OPTIONS.find((r) => r.key === selected).label}
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

export default LoginPage;
