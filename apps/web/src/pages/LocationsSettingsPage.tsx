import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../services/api';

interface LocationStats {
    districts: number;
    taluks: number;
    villages: number;
    wards: number;
    assemblyConstituencies: number;
    parliamentaryConstituencies: number;
}

/**
 * LocationsSettingsPage - READ-ONLY VIEWER
 * 
 * Master geographic data is immutable and cannot be modified via UI.
 * All updates must be done via official import scripts.
 */
export function LocationsSettingsPage() {
    const statsQuery = useQuery({
        queryKey: ['locations', 'stats'],
        queryFn: () => apiFetch<LocationStats>('/locations/stats'),
    });

    const stats = statsQuery.data;

    return (
        <section className="mx-auto max-w-2xl space-y-6">
            <div>
                <h2 className="text-2xl font-semibold">Location Data</h2>
                <p className="mt-1 text-sm text-slate-600">
                    Tamil Nadu geographic master data. This data is read-only and managed by the system administrator.
                </p>
            </div>

            {/* Read-Only Notice */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                    <svg className="h-5 w-5 text-amber-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m4-10V5a2 2 0 00-2-2H8a2 2 0 00-2 2v2m10 0h2a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h2" />
                    </svg>
                    <div>
                        <h3 className="font-medium text-amber-800">Master Data (Read-Only)</h3>
                        <p className="mt-1 text-sm text-amber-700">
                            Geographic data is managed centrally and cannot be modified through the application interface.
                            Contact your system administrator for any data corrections.
                        </p>
                    </div>
                </div>
            </div>

            {/* Statistics */}
            <div className="rounded-xl border bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-medium text-slate-900">Data Summary</h3>
                
                {statsQuery.isLoading ? (
                    <div className="animate-pulse space-y-3">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="h-8 bg-slate-100 rounded"></div>
                        ))}
                    </div>
                ) : statsQuery.error ? (
                    <p className="text-red-600 text-sm">Failed to load statistics</p>
                ) : stats ? (
                    <div className="grid grid-cols-2 gap-4">
                        <StatCard label="Districts" value={stats.districts} expected={38} />
                        <StatCard label="Taluks" value={stats.taluks} expected={226} />
                        <StatCard label="Villages" value={stats.villages} />
                        <StatCard label="Wards" value={stats.wards} />
                        <StatCard label="Assembly Constituencies" value={stats.assemblyConstituencies} expected={234} />
                        <StatCard label="Parliamentary Constituencies" value={stats.parliamentaryConstituencies} expected={39} />
                    </div>
                ) : null}
            </div>

            {/* Data Source */}
            <div className="rounded-xl border bg-white p-6 shadow-sm">
                <h3 className="mb-3 text-lg font-medium text-slate-900">Data Source</h3>
                <ul className="space-y-2 text-sm text-slate-600">
                    <li className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                        Election Commission of India (ECI)
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                        Tamil Nadu State Election Commission
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                        Government of Tamil Nadu Official Datasets
                    </li>
                </ul>
            </div>
        </section>
    );
}

function StatCard({ label, value, expected }: { label: string; value: number; expected?: number }) {
    const isComplete = expected ? value >= expected : true;
    
    return (
        <div className="rounded-lg border bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
            <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</span>
                {expected && (
                    <span className={`text-xs ${isComplete ? 'text-green-600' : 'text-amber-600'}`}>
                        {isComplete ? '✓' : `of ${expected}`}
                    </span>
                )}
            </div>
        </div>
    );
}
