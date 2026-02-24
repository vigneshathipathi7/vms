import { useMutation } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch, ApiError } from '../services/api';
import { AuthUser, ElectionType } from '../types/api';
import { getHierarchyConfig } from '../utils/hierarchy';
import { DISTRICT_OPTIONS, ulbsForDistrict } from '../constants/locations';

const ELECTION_TYPES: { value: ElectionType; label: string }[] = [
  { value: 'PARLIAMENT', label: 'Parliament (Lok Sabha - MP)' },
  { value: 'ASSEMBLY', label: 'Assembly (State Legislature - MLA)' },
  { value: 'LOCAL_BODY', label: 'Local Body (Municipal/Panchayat)' },
];

const POSITIONS = [
  { value: 'MP', label: 'Member of Parliament' },
  { value: 'MLA', label: 'Member of Legislative Assembly' },
  { value: 'Mayor', label: 'Mayor' },
  { value: 'Councillor', label: 'Councillor' },
  { value: 'Chairman', label: 'Chairman' },
  { value: 'President', label: 'President' },
  { value: 'Ward Member', label: 'Ward Member' },
];

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

interface FormData {
  fullName: string;
  phone: string;
  email: string;
  // Location fields
  state: string;
  district: string;
  taluk: string;
  constituency: string;
  assemblyConstituency: string;
  // Election
  electionType: ElectionType | '';
  contestingFor: string;
  partyName: string;
  reason: string;
}

// Tamil Nadu static states (for Parliament)
const STATES = ['Tamil Nadu'];

// Tamil Nadu Parliamentary Constituencies
const PARLIAMENTARY_CONSTITUENCIES = [
  'Chennai North', 'Chennai South', 'Chennai Central', 'Sriperumbudur',
  'Kancheepuram', 'Arakkonam', 'Vellore', 'Krishnagiri', 'Dharmapuri',
  'Tiruvannamalai', 'Arani', 'Villupuram', 'Kallakurichi', 'Salem',
  'Namakkal', 'Erode', 'Tiruppur', 'Nilgiris', 'Coimbatore', 'Pollachi',
  'Dindigul', 'Karur', 'Tiruchirappalli', 'Perambalur', 'Cuddalore',
  'Chidambaram', 'Mayiladuthurai', 'Nagapattinam', 'Thanjavur', 'Sivaganga',
  'Madurai', 'Theni', 'Virudhunagar', 'Ramanathapuram', 'Thoothukudi',
  'Tirunelveli', 'Tenkasi', 'Kanyakumari',
];

// Tamil Nadu Assembly Constituency sample (a subset for demo)
const ASSEMBLY_CONSTITUENCIES_BY_DISTRICT: Record<string, string[]> = {
  'Chennai': ['Villivakkam', 'Kolathur', 'Perambur', 'Kilpauk', 'Egmore', 'Royapuram', 'Harbour', 'Chepauk-Triplicane', 'Thousand Lights', 'Anna Nagar', 'Virugambakkam', 'Saidapet', 'T. Nagar', 'Mylapore', 'Velachery', 'Sholinganallur'],
  'Coimbatore': ['Kavundampalayam', 'Coimbatore North', 'Coimbatore South', 'Singanallur', 'Kinathukadavu', 'Pollachi', 'Valparai'],
  'Tiruchirappalli': ['Lalgudi', 'Manachanallur', 'Srirangam', 'Tiruchirappalli West', 'Tiruchirappalli East', 'Thiruverumbur', 'Thuraiyur', 'Perambalur', 'Kunnam', 'Ariyalur'],
  'Madurai': ['Madurai East', 'Madurai West', 'Madurai Central', 'Madurai South', 'Madurai North', 'Melur', 'Sholavandan', 'Usilampatti'],
};

export function SignupPage({ user }: { user: AuthUser | null }) {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    phone: '',
    email: '',
    state: '',
    district: '',
    taluk: '',
    constituency: '',
    assemblyConstituency: '',
    electionType: '',
    contestingFor: '',
    partyName: '',
    reason: '',
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Get hierarchy config based on election type
  const hierarchyConfig = useMemo(() => {
    if (!formData.electionType) return null;
    return getHierarchyConfig(formData.electionType);
  }, [formData.electionType]);

  // Get ULBs (Taluks) for selected district
  const taluks = useMemo(() => {
    if (!formData.district) return [];
    return ulbsForDistrict(formData.district);
  }, [formData.district]);

  // Get assembly constituencies for selected district
  const assemblyConstituencies = useMemo(() => {
    if (!formData.district) return [];
    return ASSEMBLY_CONSTITUENCIES_BY_DISTRICT[formData.district] || [];
  }, [formData.district]);

  // Reset location fields when election type changes
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      state: '',
      district: '',
      taluk: '',
      constituency: '',
      assemblyConstituency: '',
    }));
  }, [formData.electionType]);

  // Reset dependent fields when district changes
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      taluk: '',
      constituency: prev.electionType === 'ASSEMBLY' ? '' : prev.constituency,
      assemblyConstituency: '',
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.district]);

  // If user is already logged in, redirect to dashboard
  if (user) {
    navigate('/');
    return null;
  }

  const signupMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiFetch<{ id: string; message: string }>('/access-requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setErrorMessage(null);
      setSubmitted(true);
    },
    onError: (error) => {
      setErrorMessage(extractErrorMessage(error));
    },
  });

  function handleChange(field: keyof FormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    
    if (!formData.electionType) {
      setErrorMessage('Please select an election type');
      return;
    }

    // Validate required fields based on election type
    if (formData.electionType === 'LOCAL_BODY') {
      if (!formData.district) {
        setErrorMessage('Please select a district');
        return;
      }
      if (!formData.taluk) {
        setErrorMessage('Please select a taluk/ULB');
        return;
      }
    } else if (formData.electionType === 'ASSEMBLY') {
      if (!formData.district) {
        setErrorMessage('Please select a district');
        return;
      }
      if (!formData.constituency) {
        setErrorMessage('Please select an assembly constituency');
        return;
      }
    } else if (formData.electionType === 'PARLIAMENT') {
      if (!formData.state) {
        setErrorMessage('Please select a state');
        return;
      }
      if (!formData.constituency) {
        setErrorMessage('Please select a parliamentary constituency');
        return;
      }
    }

    const payload: Record<string, unknown> = {
      fullName: formData.fullName,
      phone: formData.phone,
      email: formData.email,
      electionType: formData.electionType,
      contestingFor: formData.contestingFor,
      partyName: formData.partyName || undefined,
      reason: formData.reason || undefined,
    };

    // Add location fields based on election type
    if (formData.electionType === 'LOCAL_BODY') {
      payload.district = formData.district;
      payload.taluk = formData.taluk;
    } else if (formData.electionType === 'ASSEMBLY') {
      payload.district = formData.district;
      payload.constituency = formData.constituency;
    } else if (formData.electionType === 'PARLIAMENT') {
      payload.state = formData.state;
      payload.constituency = formData.constituency;
      if (formData.assemblyConstituency) {
        payload.assemblyConstituency = formData.assemblyConstituency;
      }
    }

    signupMutation.mutate(payload);
  }

  if (submitted) {
    return (
      <section className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-8 w-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-slate-900">Request Submitted!</h2>
          <p className="mt-3 text-slate-600">
            Your access request has been submitted successfully. Our team will review your
            application and send login credentials to your email once approved.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            This usually takes 1-2 business days.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-medium text-white"
          >
            Back to Login
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-4 inline-flex rounded-xl bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
        Access Request
      </div>
      <h2 className="text-2xl font-semibold">Request Access</h2>
      <p className="mt-2 text-sm text-slate-600">
        Fill in your details below to request access to the Voter Management System. Once approved,
        you will receive login credentials via email.
      </p>

      {errorMessage && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>
      )}

      <form className="mt-6 space-y-6" onSubmit={onSubmit}>
        {/* Personal Information */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Personal Information
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm">Full Name *</span>
              <input
                className="w-full rounded-xl border px-3 py-2.5"
                type="text"
                value={formData.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                placeholder="Enter your full name"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm">Phone Number *</span>
              <input
                className="w-full rounded-xl border px-3 py-2.5"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="+91 98765 43210"
                required
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm">Email Address *</span>
              <input
                className="w-full rounded-xl border px-3 py-2.5"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
          </div>
        </div>

        {/* Election Type Selection - FIRST */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Election Type
          </h3>
          <label className="block">
            <span className="mb-1 block text-sm">Select Election Type *</span>
            <select
              className="w-full rounded-xl border px-3 py-2.5"
              value={formData.electionType}
              onChange={(e) => handleChange('electionType', e.target.value as ElectionType)}
              required
            >
              <option value="">Select Type</option>
              {ELECTION_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Location Information - Dynamic based on election type */}
        {formData.electionType && hierarchyConfig && (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-700 uppercase tracking-wide">
              Location Details
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* State - for Parliament elections */}
              {hierarchyConfig.showState && (
                <label className="block">
                  <span className="mb-1 block text-sm">{hierarchyConfig.stateLabel} *</span>
                  <select
                    className="w-full rounded-xl border px-3 py-2.5"
                    value={formData.state}
                    onChange={(e) => handleChange('state', e.target.value)}
                    required
                  >
                    <option value="">Select State</option>
                    {STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {/* District - for Local Body and Assembly */}
              {hierarchyConfig.showDistrict && (
                <label className="block">
                  <span className="mb-1 block text-sm">District *</span>
                  <select
                    className="w-full rounded-xl border px-3 py-2.5"
                    value={formData.district}
                    onChange={(e) => handleChange('district', e.target.value)}
                    required
                  >
                    <option value="">Select District</option>
                    {DISTRICT_OPTIONS.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {/* Taluk/ULB - for Local Body */}
              {hierarchyConfig.showTaluk && formData.district && (
                <label className="block">
                  <span className="mb-1 block text-sm">Taluk/ULB *</span>
                  <select
                    className="w-full rounded-xl border px-3 py-2.5"
                    value={formData.taluk}
                    onChange={(e) => handleChange('taluk', e.target.value)}
                    required
                  >
                    <option value="">Select Taluk/ULB</option>
                    {taluks.map((taluk) => (
                      <option key={taluk} value={taluk}>
                        {taluk}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {/* Assembly Constituency - for Assembly elections */}
              {formData.electionType === 'ASSEMBLY' && formData.district && (
                <label className="block">
                  <span className="mb-1 block text-sm">{hierarchyConfig.constituencyLabel} *</span>
                  <select
                    className="w-full rounded-xl border px-3 py-2.5"
                    value={formData.constituency}
                    onChange={(e) => handleChange('constituency', e.target.value)}
                    required
                  >
                    <option value="">Select Constituency</option>
                    {assemblyConstituencies.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {/* Parliamentary Constituency - for Parliament elections */}
              {formData.electionType === 'PARLIAMENT' && formData.state && (
                <label className="block">
                  <span className="mb-1 block text-sm">{hierarchyConfig.constituencyLabel} *</span>
                  <select
                    className="w-full rounded-xl border px-3 py-2.5"
                    value={formData.constituency}
                    onChange={(e) => handleChange('constituency', e.target.value)}
                    required
                  >
                    <option value="">Select Constituency</option>
                    {PARLIAMENTARY_CONSTITUENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </div>
        )}

        {/* Candidate Details */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Candidate Details
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm">Contesting For *</span>
              <select
                className="w-full rounded-xl border px-3 py-2.5"
                value={formData.contestingFor}
                onChange={(e) => handleChange('contestingFor', e.target.value)}
                required
              >
                <option value="">Select Position</option>
                {POSITIONS.map((pos) => (
                  <option key={pos.value} value={pos.value}>
                    {pos.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm">Party Name</span>
              <input
                className="w-full rounded-xl border px-3 py-2.5"
                type="text"
                value={formData.partyName}
                onChange={(e) => handleChange('partyName', e.target.value)}
                placeholder="Optional - Independent if not applicable"
              />
            </label>
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block">
            <span className="mb-1 block text-sm">Why do you need access?</span>
            <textarea
              className="w-full rounded-xl border px-3 py-2.5"
              rows={3}
              value={formData.reason}
              onChange={(e) => handleChange('reason', e.target.value)}
              placeholder="Briefly describe your requirements (optional)"
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/login" className="text-sm text-slate-600 hover:text-slate-900">
            Already have credentials? Login
          </Link>
          <button
            className="w-full rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50 sm:w-auto"
            type="submit"
            disabled={signupMutation.isPending}
          >
            {signupMutation.isPending ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </form>
    </section>
  );
}
