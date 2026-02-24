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
    <section className="mx-auto max-w-md rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Login</h2>
      <p className="mt-2 text-sm text-slate-600">Use your email and password to continue.</p>

      {errorMessage && <p className="mt-4 rounded-md bg-red-50 p-2 text-sm text-red-700">{errorMessage}</p>}

      <form className="mt-6 space-y-4" onSubmit={onLoginSubmit}>
        <label className="block">
          <span className="mb-1 block text-sm">Email</span>
          <input
            className="w-full rounded-md border px-3 py-2"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter email"
            required
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm">Password</span>
          <input
            className="w-full rounded-md border px-3 py-2"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            required
          />
        </label>

        <button
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
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
