import { useState } from 'react';
import type { ReactNode, FormEvent } from 'react';
import { Eye, EyeOff, Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { inputClass } from './ui/field';

/**
 * One sign-in card for every staff portal. Each portal keeps its own role colour
 * (doctor = blue, admin = purple); layout, labels and error handling are shared.
 */
export function StaffSignIn({
  title,
  subtitle,
  icon,
  accent,
  idLabel,
  idType = 'text',
  idAutoComplete = 'username',
  error,
  onSubmit,
  onBack,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  accent: 'blue' | 'purple';
  idLabel: string;
  idType?: 'text' | 'email';
  idAutoComplete?: string;
  error?: string;
  onSubmit: (id: string, password: string) => Promise<void> | void;
  onBack: () => void;
}) {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const a = accent === 'blue'
    ? { iconBg: 'bg-blue-50 text-blue-700', btn: 'bg-blue-600 hover:bg-blue-700', ring: 'focus:border-blue-600 focus:ring-blue-600/20' }
    : { iconBg: 'bg-purple-50 text-purple-700', btn: 'bg-purple-600 hover:bg-purple-700', ring: 'focus:border-purple-600 focus:ring-purple-600/20' };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit(id, password);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={onBack}
          className="tap mb-4 -ml-2 inline-flex items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to home
        </button>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-elevated">
          <div className="flex items-center gap-3">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${a.iconBg}`}>{icon}</span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
              <p className="text-sm text-slate-500">{subtitle}</p>
            </div>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="staff-id" className="text-sm font-semibold text-slate-700">{idLabel}</label>
              <input
                id="staff-id"
                type={idType}
                autoComplete={idAutoComplete}
                value={id}
                onChange={e => setId(e.target.value)}
                required
                autoFocus
                className={`${inputClass} ${a.ring}`}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="staff-password" className="text-sm font-semibold text-slate-700">Password</label>
              <div className="relative">
                <input
                  id="staff-password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  aria-invalid={!!error}
                  aria-describedby={error ? 'staff-error' : undefined}
                  className={`${inputClass} ${a.ring} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShow(s => !s)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                >
                  {show ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                </button>
              </div>
            </div>

            {error && (
              <p id="staff-error" role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || !id.trim() || !password}
              className={`h-12 w-full inline-flex items-center justify-center gap-2 rounded-xl text-base font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${a.btn}`}
            >
              {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
