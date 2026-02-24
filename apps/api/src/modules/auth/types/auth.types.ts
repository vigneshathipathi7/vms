export type UserRoleValue = 'ADMIN' | 'SUB_USER';

export type ElectionTypeValue = 'LOCAL_BODY' | 'ASSEMBLY' | 'PARLIAMENT';

export interface AccessTokenPayload {
  sub: string;
  username: string;
  role: UserRoleValue;
  candidateId: string;
}

export interface RefreshTokenPayload extends AccessTokenPayload {
  jti: string;
  type: 'refresh';
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: UserRoleValue;
  mfaEnabled: boolean;
  candidateId: string;
}

// Sub-user ward access context
export interface SubUserWardAccess {
  wardIds: string[];
}
