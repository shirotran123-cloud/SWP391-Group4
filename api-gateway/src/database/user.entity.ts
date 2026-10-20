export type UserRole = 'STUDENT' | 'INSTRUCTOR' | 'LECTURER' | 'HOD' | 'ADMIN';

export interface UserRecord {
  userId: string;
  studentCode?: string;
  email: string;
  fullName: string;
  role: UserRole;
  passwordHash?: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
