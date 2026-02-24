import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { getApiBase } from '../services/api';

export function LocationsSettingsPage() {
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);

            // Extract authorization token from cookie if needed, or rely on browser passing it
            // the apiService `apiFetch` currently only works with JSON bodies by default unless we modify it.
            // We will do a raw fetch to /api/locations/upload-csv here.

            const res = await fetch(`${getApiBase()}/locations/upload-csv`, {
                method: 'POST',
                body: formData,
                credentials: 'include',
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Failed to upload CSV');
            }

            return res.json();
        },
        onSuccess: (data) => {
            setSuccessMsg(
                `Success! Uploaded ${data.insertedDistricts} districts, ${data.insertedLocalBodies} areas/panchayats, and ${data.insertedWards} villages/wards!`,
            );
            setErrorMsg('');
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            queryClient.invalidateQueries({ queryKey: ['locations'] });
        },
        onError: (err: Error) => {
            setErrorMsg(err.message);
            setSuccessMsg('');
        },
        onSettled: () => {
            setIsUploading(false);
        },
    });

    const handleUpload = (e: React.FormEvent) => {
        e.preventDefault();
        if (!fileInputRef.current?.files?.[0]) {
            setErrorMsg('Please select a valid CSV file.');
            return;
        }
        setIsUploading(true);
        setErrorMsg('');
        setSuccessMsg('');
        uploadMutation.mutate(fileInputRef.current.files[0]);
    };

    return (
        <section className="mx-auto max-w-2xl space-y-6">
            <div>
                <h2 className="text-2xl font-semibold">Location Setup</h2>
                <p className="mt-1 text-sm text-slate-600">
                    Upload a database of Village Panchayats, Municipalities, Corporations, or Areas.
                    Our system is flexible enough to accommodate any structure!
                </p>
            </div>

            <div className="rounded-xl border bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-medium text-slate-900">Import CSV File</h3>

                <div className="mb-4 rounded bg-blue-50 p-4 text-sm text-blue-800">
                    <strong>CSV Format Requirements:</strong>
                    <ul className="mt-2 list-inside list-disc space-y-1">
                        <li>Column 1: <code>District</code> (e.g. "Kanchipuram")</li>
                        <li>Column 2: <code>LocalBodyName</code> (e.g. "Sriperumbudur Village Panchayat")</li>
                        <li>Column 3: <code>WardsCount</code> (Number of wards/villages to auto-generate. Minimum: 1)</li>
                    </ul>
                </div>

                <form onSubmit={handleUpload} className="space-y-4">
                    <input
                        type="file"
                        accept=".csv"
                        ref={fileInputRef}
                        className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-md file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
                        disabled={isUploading}
                    />

                    <button
                        type="submit"
                        disabled={isUploading}
                        className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50"
                    >
                        {isUploading ? 'Uploading & Processing...' : 'Upload Database'}
                    </button>
                </form>

                {successMsg && <p className="mt-4 text-sm font-medium text-green-700">{successMsg}</p>}
                {errorMsg && <p className="mt-4 text-sm font-medium text-red-600">{errorMsg}</p>}
            </div>
        </section>
    );
}
