/**
 * Application-level roles.
 *
 * `HOD` (Head of Department) is part of the SSOT role set in GEMINI.md and exists in the
 * `roles` table, but was missing from this union — so it could not be assigned through the
 * API and no HOD account could ever be created. `LECTURER` is accepted as an alias of
 * `INSTRUCTOR` because the SQL `roles` table uses `LECTURER` while the app uses `INSTRUCTOR`.
 */
export type UserRole = 'STUDENT' | 'INSTRUCTOR' | 'ADMIN' | 'HOD';

export interface UserRecord {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  passwordHash?: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
