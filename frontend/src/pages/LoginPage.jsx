/**
 * @file LoginPage.jsx
 * Split-screen login interface featuring one-click demo role chips, validation, and real-time operations branding.
 */

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Activity, ShieldCheck, Stethoscope, Lock, Mail, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';
import Button from '../components/ui/Button.jsx';
import { ROLES } from '../utils/roles.js';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const login = useAuthStore((s) => s.login);
  const loginAsDemo = useAuthStore((s) => s.loginAsDemo);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);

  const [email, setEmail] = useState('admin@hospital.org');
  const [password, setPassword] = useState('password123');
  const [selectedRole, setSelectedRole] = useState(ROLES.ADMIN);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login({ email, password, role: selectedRole });
    if (result.success) {
      navigate(from, { replace: true });
    }
  };

  const handleDemoChip = async (roleKey) => {
    setSelectedRole(roleKey);
    const result = await loginAsDemo(roleKey);
    if (result.success) {
      navigate(from, { replace: true });
    }
  };

  return (
    <div className="min-h-screen w-screen flex bg-surface-base text-surface-foreground select-none">
      {/* Left Hero Panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 bg-gradient-to-br from-primary-950 via-slate-900 to-slate-950 text-white relative overflow-hidden border-r border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(13,148,136,0.18),transparent_50%)]" />

        {/* Brand */}
        <div className="flex items-center gap-3 z-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-teal-500/25">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">MediOrchestra</h1>
            <p className="text-xs text-primary-300 font-mono tracking-wide">
              AI CONTROL TOWER
            </p>
          </div>
        </div>

        {/* Central Pitch */}
        <div className="space-y-6 z-10 max-w-lg">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/20 text-primary-300 text-xs font-semibold border border-primary-500/30">
            <ShieldCheck className="w-4 h-4" /> Next-Generation Clinical Operations
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight leading-snug">
            Autonomous Resource Orchestration for Zero-Bottleneck Care.
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Real-time synchronization across 80 beds, surgical theatres, mobile telemetry equipment, and staff duty rosters with explainable AI advisory.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-2xl font-bold font-mono text-teal-400">40.6%</span>
              <p className="text-slate-400 mt-1">Average ED Wait Reduction</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-2xl font-bold font-mono text-emerald-400">85.7%</span>
              <p className="text-slate-400 mt-1">Bed Overflow Prevention</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-xs text-slate-500 z-10">
          Metropolitan Hospital Operations Command • HIPAA & HL7 FHIR Compliant
        </div>
      </div>

      {/* Right Login Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          <div className="text-left">
            <div className="lg:hidden flex items-center gap-2.5 mb-6">
              <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white">
                <Activity className="w-5 h-5 animate-pulse" />
              </div>
              <span className="font-bold text-base text-surface-foreground">MediOrchestra</span>
            </div>
            <h2 className="text-2xl font-bold text-surface-foreground tracking-tight">
              Sign In to Command Center
            </h2>
            <p className="text-xs text-surface-muted mt-1">
              Select a quick demo role or authenticate with your clinical credentials.
            </p>
          </div>

          {/* Demo Login Chips */}
          <div className="p-3.5 rounded-xl bg-surface-sunken/60 border border-surface-border">
            <span className="text-[11px] font-semibold text-surface-muted block mb-2 uppercase tracking-wider">
              One-Click Demo Roles
            </span>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={selectedRole === ROLES.ADMIN ? 'primary' : 'secondary'}
                size="xs"
                onClick={() => handleDemoChip('admin')}
              >
                Hospital Admin
              </Button>
              <Button
                variant={selectedRole === ROLES.BED_MANAGER ? 'primary' : 'secondary'}
                size="xs"
                onClick={() => handleDemoChip('bed_manager')}
              >
                Bed Manager
              </Button>
              <Button
                variant={selectedRole === ROLES.NURSE_MANAGER ? 'primary' : 'secondary'}
                size="xs"
                onClick={() => handleDemoChip('nurse_manager')}
              >
                Nurse Manager
              </Button>
              <Button
                variant={selectedRole === ROLES.DOCTOR ? 'primary' : 'secondary'}
                size="xs"
                onClick={() => handleDemoChip('doctor')}
              >
                Doctor / Surgeon
              </Button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-danger-500/10 border border-danger-500/30 text-danger-600 dark:text-danger-400 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-surface-foreground">
                Clinical Email Address
              </label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-surface-muted absolute left-3 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2.5 bg-surface-elevated text-surface-foreground border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-surface-foreground">
                  Security Password
                </label>
              </div>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-surface-muted absolute left-3 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2.5 bg-surface-elevated text-surface-foreground border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              iconRight={ArrowRight}
              className="w-full mt-2"
            >
              Sign In to MediOrchestra
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
