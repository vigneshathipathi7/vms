import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, ApiError } from '../services/api';
import { AuthUser, LoginResponse, LoginPayload } from '../types/api';

function extractErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.payload && typeof error.payload === 'object') {
    const value = (error.payload as { message?: unknown }).message;
    if (typeof value === 'string') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.join(', ');
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Request failed';
}

export function LoginPage({ user }: { user: AuthUser | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [navigate, user]);

  const loginMutation = useMutation({
    mutationFn: (payload: LoginPayload) =>
      apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      setErrorMessage(null);
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      navigate('/');
    },
    onError: (error) => {
      setErrorMessage(extractErrorMessage(error));
    },
  });

  function onLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loginMutation.mutate({ email, password });
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-4 inline-flex rounded-xl bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
        Secure Access
      </div>
      <h2 className="text-2xl font-semibold">Welcome back</h2>
      <p className="mt-2 text-sm text-slate-600">Use your registered email and password to continue.</p>

      {errorMessage && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>}

      <form className="mt-6 space-y-4" onSubmit={onLoginSubmit}>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Email</span>
          <input
            className="w-full rounded-xl border px-3 py-2.5"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter email"
            required
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Password</span>
          <input
            className="w-full rounded-xl border px-3 py-2.5"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            required
          />
        </label>

        <button
          className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
          type="submit"
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? 'Signing in...' : 'Continue'}
        </button>

        <p className="mt-4 text-center text-sm text-slate-600">
          Don't have credentials?{' '}
          <a href="/signup" className="font-medium text-blue-700 hover:underline">
            Request Access
          </a>
        </p>
      </form>
    </section>
  );
}
