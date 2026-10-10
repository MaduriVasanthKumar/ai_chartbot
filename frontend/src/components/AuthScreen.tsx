import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, LockKeyhole, Mail, Sparkles, UserRound } from 'lucide-react';
import type { AuthUser } from '../types';

interface AuthScreenProps {
  onAuthenticated: (user: AuthUser) => void;
  onLogin: (email: string, password: string) => Promise<AuthUser>;
  onRegister: (email: string, password: string, displayName: string) => Promise<AuthUser>;
}

export function AuthScreen({ onAuthenticated, onLogin, onRegister }: AuthScreenProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (isRegistering && password.length < 8) {
      setError('Your password must contain at least 8 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const user = isRegistering
        ? await onRegister(email, password, displayName)
        : await onLogin(email, password);
      onAuthenticated(user);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-8 relative overflow-hidden">
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-violet-600/20 blur-3xl" />
      <div className="absolute -bottom-40 -right-24 w-[30rem] h-[30rem] rounded-full bg-indigo-600/15 blur-3xl" />

      <section className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-xl shadow-violet-500/25 mb-4">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">EduMate <span className="text-violet-400">AI</span></h1>
          <p className="text-slate-400 text-sm mt-2">Your personal learning workspace</p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl shadow-black/30 p-6 sm:p-8 backdrop-blur-xl">
          <div className="mb-6">
            <h2 className="text-xl font-semibold">{isRegistering ? 'Create your account' : 'Welcome back'}</h2>
            <p className="text-sm text-slate-400 mt-1">
              {isRegistering ? 'Start a personalized study journey.' : 'Sign in to continue learning.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
              <label className="block">
                <span className="text-xs font-medium text-slate-300">Display name</span>
                <div className="relative mt-1.5">
                  <UserRound className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="How should we call you?"
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 pl-10 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                    maxLength={80}
                  />
                </div>
              </label>
            )}

            <label className="block">
              <span className="text-xs font-medium text-slate-300">Email address</span>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 pl-10 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-300">Password</span>
              <div className="relative mt-1.5">
                <LockKeyhole className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={isRegistering ? 'At least 8 characters' : 'Enter your password'}
                  autoComplete={isRegistering ? 'new-password' : 'current-password'}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 pl-10 pr-11 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </label>

            {error && (
              <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition-all"
            >
              {isSubmitting ? 'Please wait…' : isRegistering ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800 text-center text-sm text-slate-400">
            {isRegistering ? 'Already have an account?' : 'New to EduMate AI?'}{' '}
            <button
              type="button"
              onClick={() => { setIsRegistering((value) => !value); setError(''); }}
              className="text-violet-300 hover:text-violet-200 font-medium"
            >
              {isRegistering ? 'Sign in' : 'Create an account'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">Your study data is scoped to your account.</p>
      </section>
    </main>
  );
}
