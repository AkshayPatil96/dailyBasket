import type { Role } from '@grocery-delivery/types';

export interface AuthenticatedUser {
  id: string;
  role: Role;
  sessionId: string;
}
