import { Injectable, BadRequestException, ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TestCaseRepository } from '../database/test-case.repository';
import { AssignmentRepository } from '../database/assignment.repository';
import { TestCaseRecord } from '../database/test-case.entity';
import { CreateTestCaseDto } from './dto/create-test-case.dto';
import { UpdateTestCaseDto } from './dto/update-test-case.dto';
import { ReplaceTestCasesDto } from './dto/replace-test-cases.dto';

@Injectable()
export class TestCasesService {
  private readonly logger = new Logger(TestCasesService.name);

  constructor(
    private readonly testCaseRepo: TestCaseRepository,
    private readonly assignmentRepo: AssignmentRepository,
  ) {}

  private normalizeWeight(weight?: number): number | undefined {
    if (typeof weight === 'number' && weight > 10 && weight <= 100) {
      return Number((weight / 10).toFixed(2));
    }
    return weight;
  }

  private validateFields(inputData?: string, expectedOutput?: string, weight?: number, timeLimitMs?: number): void {
    if (inputData !== undefined && typeof inputData !== 'string') {
      throw new BadRequestException('Dữ liệu đầu vào (input_data) phải là định dạng chuỗi!');
    }
    if (expectedOutput !== undefined && (typeof expectedOutput !== 'string' || expectedOutput.trim().length === 0)) {
      throw new BadRequestException('Kết quả mong đợi (expected_output) không được để trống!');
    }
    if (weight !== undefined && (typeof weight !== 'number' || Number.isNaN(weight) || !(weight > 0 && weight <= 10))) {
      throw new BadRequestException('Trọng số (weight) phải trong khoảng (0, 10]!');
    }
    if (timeLimitMs !== undefined && (typeof timeLimitMs !== 'number' || Number.isNaN(timeLimitMs) || !(timeLimitMs >= 100 && timeLimitMs <= 30000))) {
      throw new BadRequestException('Giới hạn thời gian (time_limit_ms) phải trong khoảng [100, 30000]!');
    }
  }

  public async create(dto: CreateTestCaseDto): Promise<TestCaseRecord> {
    const assignment = await this.assignmentRepo.findById(dto.assignmentId);
    if (!assignment) {
      throw new NotFoundException(`Không tìm thấy bài tập với ID: ${dto.assignmentId}`);
    }
    // Tự động chuẩn hóa trọng số nếu truyền dạng tỷ lệ phần trăm (ví dụ: 30% -> 3.0, 35% -> 3.5)
    dto.weight = this.normalizeWeight(dto.weight);
    this.validateFields(dto.inputData, dto.expectedOutput, dto.weight, dto.timeLimitMs);
    const duplicate = await this.testCaseRepo.findDuplicate(dto.assignmentId, dto.inputData, dto.expectedOutput);
    if (duplicate) {
      throw new ConflictException('Test case với input và expected output này đã tồn tại cho bài tập!');
    }
    const record = await this.testCaseRepo.create({
      testCaseId: randomUUID(),
      assignmentId: dto.assignmentId,
      inputData: dto.inputData,
      expectedOutput: dto.expectedOutput,
      isHidden: dto.isHidden ?? false,
      weight: dto.weight ?? 1.0,
      timeLimitMs: dto.timeLimitMs ?? 2000,
    });
    const allForAssignment = await this.testCaseRepo.listByAssignment(dto.assignmentId);
    await this.assignmentRepo.update(dto.assignmentId, { testcasesCount: allForAssignment.length });
    this.logger.log(`[TestCasesService] Created test case ${record.testCaseId} for ${record.assignmentId}`);
    return record;
  }

  public async replaceForAssignment(assignmentId: string, dto: ReplaceTestCasesDto): Promise<TestCaseRecord[]> {
    const assignment = await this.assignmentRepo.findById(assignmentId);
    if (!assignment) {
      throw new NotFoundException(`Không tìm thấy bài tập với ID: ${assignmentId}`);
    }

    const seenPairs = new Set<string>();
    const preparedItems = dto.testCases.map((tc) => {
      const normalizedWeight = this.normalizeWeight(tc.weight);
      this.validateFields(tc.inputData, tc.expectedOutput, normalizedWeight, tc.timeLimitMs);
      const pairKey = `${tc.inputData}\u0000${tc.expectedOutput}`;
      if (seenPairs.has(pairKey)) {
        throw new ConflictException('Danh sách có test case bị trùng lặp input và expected output!');
      }
      seenPairs.add(pairKey);
      return {
        testCaseId: randomUUID(),
        inputData: tc.inputData,
        expectedOutput: tc.expectedOutput,
        isHidden: tc.isHidden ?? false,
        weight: normalizedWeight ?? 1.0,
        timeLimitMs: tc.timeLimitMs ?? assignment.timeLimitMs ?? 2000,
      };
    });

    const saved = await this.testCaseRepo.replaceForAssignment(assignmentId, preparedItems);
    await this.assignmentRepo.update(assignmentId, { testcasesCount: saved.length });
    this.logger.log(`[TestCasesService] Atomically replaced ${saved.length} test cases for ${assignmentId}`);
    return saved;
  }

  public async listByAssignment(assignmentId: string, includeHidden: boolean): Promise<any[]> {
    const assignment = await this.assignmentRepo.findById(assignmentId);
    if (!assignment) {
      throw new NotFoundException(`Không tìm thấy bài tập với ID: ${assignmentId}`);
    }
    const list = await this.testCaseRepo.listByAssignment(assignmentId);
    return list.map((tc) => (tc.isHidden && !includeHidden ? { ...tc, expectedOutput: null } : tc));
  }

  public async getById(id: string): Promise<TestCaseRecord> {
    const tc = await this.testCaseRepo.getById(id);
    if (!tc) {
      throw new NotFoundException(`Không tìm thấy test case với ID: ${id}`);
    }
    return tc;
  }

  public async update(id: string, dto: UpdateTestCaseDto): Promise<TestCaseRecord> {
    const existing = await this.getById(id);
    dto.weight = this.normalizeWeight(dto.weight);
    this.validateFields(dto.inputData, dto.expectedOutput, dto.weight, dto.timeLimitMs);
    const nextInput = dto.inputData ?? existing.inputData;
    const nextExpected = dto.expectedOutput ?? existing.expectedOutput;
    const duplicate = await this.testCaseRepo.findDuplicate(existing.assignmentId, nextInput, nextExpected, id);
    if (duplicate) {
      throw new ConflictException('Test case với input và expected output này đã tồn tại cho bài tập!');
    }
    const updated = await this.testCaseRepo.update(id, { ...dto });
    return updated!;
  }

  public async delete(id: string): Promise<{ success: boolean }> {
    const existing = await this.getById(id);
    await this.testCaseRepo.delete(id);
    const remaining = await this.testCaseRepo.listByAssignment(existing.assignmentId);
    await this.assignmentRepo.update(existing.assignmentId, { testcasesCount: remaining.length });
    this.logger.log(`[TestCasesService] Deleted test case ${id} (remaining=${remaining.length})`);
    return { success: true };
  }
}
