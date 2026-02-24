import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { UserProfileResponse } from '../types/api';
import { useDistricts } from '../hooks/useLocations';

const ELECTION_LEVELS = [
    'MLA',
    'MP',
    'Mayor',
    'Councillor',
    'Panchayat President',
    'Ward Member',
];

export function EditProfilePage() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { data: districts = [] } = useDistricts();

    const [form, setForm] = useState({
        fullName: '',
        phone: '',
        electionLevel: '',
        constituencyName: '',
        positionContesting: '',
        partyName: '',
    });

    const profileQuery = useQuery({
        queryKey: ['users', 'profile'],
        queryFn: () => apiFetch<UserProfileResponse>('/users/profile'),
    });

    useEffect(() => {
        if (profileQuery.data?.item) {
            const p = profileQuery.data.item;
            setForm({
                fullName: p.fullName ?? '',
                phone: p.phone ?? '',
                electionLevel: p.electionLevel ?? '',
                constituencyName: p.constituencyName ?? '',
                positionContesting: p.positionContesting ?? '',
                partyName: p.partyName ?? '',
            });
        }
    }, [profileQuery.data]);

    const updateMutation = useMutation({
        mutationFn: () =>
            apiFetch('/users/profile', {
                method: 'PATCH',
                body: JSON.stringify(form),
            }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['users', 'profile'] });
            navigate('/profile');
        },
    });

    if (profileQuery.isLoading) {
        return <p className="text-sm text-slate-600">Loading...</p>;
    }
    if (profileQuery.isError || !profileQuery.data) {
        return <p className="text-sm text-red-600">Failed to load profile.</p>;
    }

    const role = profileQuery.data.item.role;

    function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        updateMutation.mutate();
    }

    return (
        <section className="mx-auto max-w-2xl space-y-6">
            <div>
                <h2 className="text-2xl font-semibold">Edit Profile</h2>
                <p className="mt-1 text-sm text-slate-600">Update your details and election scope.</p>
            </div>

            <form className="space-y-4 rounded-xl border bg-white p-6 shadow-sm" onSubmit={onSubmit}>
                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                        <span className="text-sm font-medium text-slate-700">Full Name</span>
                        <input
                            className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                            value={form.fullName}
                            onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                            placeholder="Full Name"
                        />
                    </label>
                    <label className="block">
                        <span className="text-sm font-medium text-slate-700">Phone Number</span>
                        <input
                            className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                            value={form.phone}
                            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                            placeholder="Primary Contact"
                        />
                    </label>
                </div>

                {role === 'ADMIN' && (
                    <div className="space-y-4 border-t pt-4">
                        <h3 className="text-lg font-medium text-slate-900">Election Details</h3>

                        <label className="block">
                            <span className="text-sm font-medium text-slate-700">Election Level</span>
                            <select
                                className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                                value={form.electionLevel}
                                onChange={(e) => setForm((prev) => ({ ...prev, electionLevel: e.target.value }))}
                            >
                                <option value="">Select Level</option>
                                {ELECTION_LEVELS.map((level) => (
                                    <option key={level} value={level}>
                                        {level}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block">
                            <span className="text-sm font-medium text-slate-700">Constituency / District Name</span>
                            <select
                                className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                                value={form.constituencyName}
                                onChange={(e) => setForm((prev) => ({ ...prev, constituencyName: e.target.value }))}
                            >
                                <option value="">Select District</option>
                                {districts.map((d: any) => (
                                    <option key={d.id} value={d.name}>
                                        {d.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block">
                                <span className="text-sm font-medium text-slate-700">Position Contesting</span>
                                <input
                                    className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                                    value={form.positionContesting}
                                    onChange={(e) => setForm((prev) => ({ ...prev, positionContesting: e.target.value }))}
                                    placeholder="e.g. Mayor"
                                />
                            </label>

                            <label className="block">
                                <span className="text-sm font-medium text-slate-700">Party Name</span>
                                <input
                                    className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                                    value={form.partyName}
                                    onChange={(e) => setForm((prev) => ({ ...prev, partyName: e.target.value }))}
                                    placeholder="Party / Independent"
                                />
                            </label>
                        </div>
                    </div>
                )}

                {role === 'SUB_USER' && (
                    <div className="space-y-4 border-t pt-4">
                        <label className="block">
                            <span className="text-sm font-medium text-slate-700">Managed Area</span>
                            <p className="mt-1 text-xs text-slate-500">Contact admin to modify your assigned area.</p>
                        </label>
                    </div>
                )}

                <div className="flex gap-3 border-t pt-4">
                    <button
                        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                        type="submit"
                        disabled={updateMutation.isPending}
                    >
                        {updateMutation.isPending ? 'Saving...' : 'Save Profile'}
                    </button>
                    <button
                        className="rounded-md border px-4 py-2 text-sm font-medium text-slate-700"
                        type="button"
                        onClick={() => navigate('/profile')}
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </section>
    );
}
