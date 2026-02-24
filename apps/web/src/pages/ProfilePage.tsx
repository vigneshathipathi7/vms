import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { UserProfileResponse } from '../types/api';

export function ProfilePage() {
  const profileQuery = useQuery({
    queryKey: ['users', 'profile'],
    queryFn: () => apiFetch<UserProfileResponse>('/users/profile'),
  });

  if (profileQuery.isLoading) {
    return <p className="text-sm text-slate-600">Loading profile...</p>;
  }

  if (profileQuery.isError || !profileQuery.data) {
    return <p className="text-sm text-red-600">Failed to load profile.</p>;
  }

  const profile = profileQuery.data.item;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Profile</h2>
          <p className="mt-1 text-sm text-slate-600">
            Your profile details and quick actions.
          </p>
        </div>
        <Link className="rounded-md border bg-slate-50 px-3 py-1.5 text-sm font-medium" to="/profile/edit">
          Edit Profile
        </Link>
      </div>

      <article className="rounded-xl border bg-white p-6 shadow-sm">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Username</dt>
            <dd className="text-sm text-slate-900">{profile.username}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Name</dt>
            <dd className="text-sm text-slate-900">{profile.fullName ?? '-'}</dd>
          </div>
          {profile.role === 'ADMIN' && (
            <>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Election Level</dt>
                <dd className="text-sm text-slate-900">{profile.electionLevel ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Constituency/District</dt>
                <dd className="text-sm text-slate-900">{profile.constituencyName ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Standing Positon</dt>
                <dd className="text-sm text-slate-900">{profile.positionContesting ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Party Name</dt>
                <dd className="text-sm text-slate-900">{profile.partyName ?? '-'}</dd>
              </div>
            </>
          )}
        </dl>
      </article>

      <article className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold">Quick actions</h3>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white" to="/entry">
            Data Entry
          </Link>
          <Link className="rounded-md border px-4 py-2 text-sm font-medium" to="/dashboard">
            Dashboard
          </Link>
          <Link className="rounded-md border px-4 py-2 text-sm font-medium" to="/voted">
            Voted List
          </Link>
        </div>
      </article>
    </section>
  );
}
