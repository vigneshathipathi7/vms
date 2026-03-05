import { UserRole } from '../types/api';

export function roleLabel(role: UserRole): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Super Admin';
    case 'ADMIN':
      return 'MLA Candidate';
    case 'SUB_ADMIN':
      return 'Area Secretary';
    case 'SUB_USER':
      return 'Ward Member';
    case 'VOLUNTEER':
      return 'Volunteer';
    default:
      return role;
  }
}
