import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { UserRepository } from '../database/user.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRecord, UserRole } from '../database/user.entity';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly userRepo: UserRepository) {}

  public async createUser(dto: CreateUserDto): Promise<UserRecord> {
    const existingById = await this.userRepo.findById(dto.userId);
    if (existingById) {
      throw new ConflictException(`Người dùng với mã ${dto.userId} đã tồn tại!`);
    }

    const existingByEmail = await this.userRepo.findByEmail(dto.email);
    if (existingByEmail) {
      throw new ConflictException(`Email ${dto.email} đã được đăng ký trong hệ thống!`);
    }

    const record = await this.userRepo.create({
      userId: dto.userId,
      email: dto.email,
      fullName: dto.fullName,
      role: dto.role || 'STUDENT',
      passwordHash: dto.password ? `hashed_${dto.password}` : 'hashed_default',
      avatarUrl: dto.avatarUrl,
      isActive: true,
    });

    this.logger.log(`[UsersService] Created user ${record.userId} (${record.role})`);
    return record;
  }

  public async getAllUsers(role?: UserRole): Promise<UserRecord[]> {
    return this.userRepo.findAll(role);
  }

  public async getUserById(userId: string): Promise<UserRecord> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundException(`Không tìm thấy người dùng với ID: ${userId}`);
    }
    return user;
  }

  public async getUserByEmail(email: string): Promise<UserRecord | null> {
    return this.userRepo.findByEmail(email);
  }

  public async updateUser(userId: string, dto: UpdateUserDto): Promise<UserRecord> {
    await this.getUserById(userId);

    if (dto.email) {
      const existingEmail = await this.userRepo.findByEmail(dto.email);
      if (existingEmail && existingEmail.userId !== userId) {
        throw new ConflictException(`Email ${dto.email} đã thuộc về người dùng khác!`);
      }
    }

    const updated = await this.userRepo.update(userId, dto);
    this.logger.log(`[UsersService] Updated user ${userId}`);
    return updated!;
  }

  public async deleteUser(userId: string): Promise<{ success: boolean; message: string }> {
    await this.getUserById(userId);
    const success = await this.userRepo.delete(userId);
    this.logger.log(`[UsersService] Deleted user ${userId}`);
    return { success, message: `Đã xóa người dùng ${userId} thành công.` };
  }
}
