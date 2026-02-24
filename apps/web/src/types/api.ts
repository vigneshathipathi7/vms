export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUB_USER';

export type ElectionType = 'LOCAL_BODY' | 'ASSEMBLY' | 'PARLIAMENT';

export interface Candidate {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  electionType: ElectionType;
  contestingFor: string;
  district: string;
  constituency: string;
  partyName: string | null;
  bio: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  mfaEnabled: boolean;
  candidateId: string;
  electionLevel: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  mfaRequired: boolean;
  challengeId?: string;
  expiresAt?: string;
  user?: AuthUser;
  trustedDeviceUsed?: boolean;
}

export interface CandidateInfo {
  id: string;
  fullName: string;
  email: string;
  electionType: ElectionType;
  contestingFor: string;
  state: string | null;
  district: string | null;
  constituency: string | null;
  partyName: string | null;
}

export interface MeResponse {
  user: AuthUser;
  candidate: CandidateInfo | null;
}

export interface ZoneSummary {
  id: string;
  type: 'RED' | 'GREEN' | 'ORANGE';
  name: string;
  colorHex: string;
  total: number;
  pending: number;
  voted: number;
}

export interface ZonesResponse {
  items: ZoneSummary[];
}

export interface DashboardStatsResponse {
  zones: {
    zone: {
      id: string;
      type: 'RED' | 'GREEN' | 'ORANGE';
      name: string;
      colorHex: string;
    };
    total: number;
    pending: number;
    voted: number;
  }[];
  totals: {
    total: number;
    pending: number;
    voted: number;
  };
}

export interface Voter {
  id: string;
  name: string;
  contactNumber: string;
  voterId: string;
  address: string;
  voted: boolean;
  createdAt: string;
  updatedAt: string;
  // Dynamic hierarchy fields - usage depends on electionType
  state?: string;
  constituency?: string;
  assemblyConstituency?: string;
  talukId?: string;
  villageId?: string;
  wardId: string;
  zoneId: string;
  addedByUserId: string;
  // Relations - optional based on electionType
  taluk?: {
    id: string;
    name: string;
  };
  village?: {
    id: string;
    name: string;
  };
  ward?: {
    id: string;
    wardNumber: string;
  };
  zone: {
    id: string;
    type: 'RED' | 'GREEN' | 'ORANGE';
    name: string;
    colorHex: string;
  };
  addedBy: {
    id: string;
    username: string;
  };
}

export interface VotersResponse {
  items: Voter[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ZoneVotersResponse extends VotersResponse {
  zone: {
    id: string;
    type: 'RED' | 'GREEN' | 'ORANGE';
    name: string;
    colorHex: string;
  };
}

export interface SubUsersResponse {
  items: {
    id: string;
    username: string;
    fullName: string | null;
    phone: string | null;
    email: string | null;
    managedVillageId: string | null;
    managedWardId: string | null;
    managedVillage: { id: string; name: string } | null;
    managedWard: { id: string; wardNumber: string } | null;
    createdAt: string;
    votersAddedCount: number;
  }[];
}

export interface UserProfile {
  id: string;
  username: string;
  role: UserRole;
  mfaEnabled: boolean;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  officeAddress: string | null;
  electionLevel: string | null;
  constituencyName: string | null;
  positionContesting: string | null;
  partyName: string | null;
  profilePhoto: string | null;
  bio: string | null;
  managedVillageId: string | null;
  managedWardId: string | null;
  managedVillage: { id: string; name: string } | null;
  managedWard: { id: string; wardNumber: string } | null;
  talukId: string | null;
  villageId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileResponse {
  item: UserProfile;
}

export interface VoterFilterOptionsResponse {
  wardNumbers: string[];
  addresses?: string[];
  streetNames: string[];
  addedByUsers: {
    id: string;
    username: string;
  }[];
}

export interface AuditVoterAdditionsResponse {
  items: {
    userId: string;
    username: string;
    role: UserRole;
    votersAddedCount: number;
    lastAddedAt: string | null;
  }[];
  totals: {
    users: number;
    votersAdded: number;
  };
}

// Access Request Types
export type AccessRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AccessRequest {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  district: string;
  constituency: string;
  requestedTaluks: string[];
  electionType: ElectionType;
  contestingFor: string;
  partyName: string | null;
  bio: string | null;
  reason: string | null;
  status: AccessRequestStatus;
  adminNotes: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  candidateId: string | null;
  reviewedBy: {
    id: string;
    username: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccessRequestsResponse {
  items: AccessRequest[];
}

export interface AccessRequestResponse {
  item: AccessRequest;
}

export interface CreateAccessRequestPayload {
  fullName: string;
  phone: string;
  email: string;
  district: string;
  constituency: string;
  requestedTaluks: string[];  // Array of taluk IDs
  electionType: ElectionType;
  contestingFor: string;
  partyName?: string;
  reason?: string;
  bio?: string;
}

export interface CreateAccessRequestResponse {
  id: string;
  message: string;
}

export interface AccessRequestStatsResponse {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

// Location Types
export interface Taluk {
  id: string;
  name: string;
  district: string;
}

export interface TaluksByDistrictResponse {
  district: string;
  taluks: Taluk[];
}

export interface Village {
  id: string;
  name: string;
  talukId: string;
}

export interface Ward {
  id: string;
  wardNumber: string;
  villageId: string;
}

