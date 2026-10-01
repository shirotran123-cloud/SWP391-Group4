export type UserRole = 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';

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
