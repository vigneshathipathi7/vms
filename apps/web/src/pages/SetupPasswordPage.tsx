import { useMutation, useQuery } from '@tanstack/react-query';
import { FormEvent, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch, ApiError } from '../services/api';
import { SetupPasswordResponse, ValidateSetupTokenResponse } from '../types/api';

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

export function SetupPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => (searchParams.get('token') ?? '').trim(), [searchParams]);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const tokenValidationQuery = useQuery({
    queryKey: ['auth', 'setup-password', 'validate', token],
    queryFn: () =>
      apiFetch<ValidateSetupTokenResponse>(
        `/auth/setup-password/validate?token=${encodeURIComponent(token)}`,
      ),
    enabled: token.length > 0,
  });

  const setupMutation = useMutation({
    mutationFn: () =>
      apiFetch<SetupPasswordResponse>('/auth/setup-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      }),
    onSuccess: (data) => {
      setErrorMessage(null);
      setSuccessMessage(data.message ?? 'Password has been set successfully.');
      setPassword('');
      setConfirmPassword('');
    },
    onError: (error) => {
      setErrorMessage(extractErrorMessage(error));
      setSuccessMessage(null);
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!token) {
      setErrorMessage('Setup token is missing from the URL.');
      return;
    }

    if (password.length < 8 || password.length > 128) {
      setErrorMessage('Password must be between 8 and 128 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setupMutation.mutate();
  }

  const tokenInvalid = tokenValidationQuery.isError;
  const tokenValid = tokenValidationQuery.data?.valid;

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
      <div className="mb-4 inline-flex rounded-xl bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
        Account Activation
      </div>
      <h2 className="text-2xl font-semibold">Set Password</h2>
      <p className="mt-2 text-sm text-slate-600">
        Create your password to activate your account.
      </p>

      {tokenValidationQuery.isLoading && (
        <p className="mt-4 text-sm text-slate-600">Validating setup link...</p>
      )}

      {tokenValid && tokenValidationQuery.data?.email && (
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          Account: <span className="font-medium">{tokenValidationQuery.data.email}</span>
        </p>
      )}

      {tokenInvalid && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          This setup link is invalid or expired.
        </p>
      )}

      {errorMessage && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>}
      {successMessage && (
        <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">{successMessage}</p>
      )}

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">New Password</span>
          <input
            className="w-full rounded-xl border px-3 py-2.5"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            maxLength={128}
            required
            disabled={tokenInvalid || !!successMessage || setupMutation.isPending}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Confirm Password</span>
          <input
            className="w-full rounded-xl border px-3 py-2.5"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={8}
            maxLength={128}
            required
            disabled={tokenInvalid || !!successMessage || setupMutation.isPending}
          />
        </label>

        <button
          className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          type="submit"
          disabled={tokenInvalid || !!successMessage || setupMutation.isPending}
        >
          {setupMutation.isPending ? 'Setting password...' : 'Set Password'}
        </button>
      </form>

      <div className="mt-4 text-center">
        <Link className="text-sm font-medium text-indigo-700 hover:text-indigo-900" to="/login">
          Back to login
        </Link>
      </div>
    </section>
  );
}
