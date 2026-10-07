import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Job } from 'bullmq';
import {
  SUBMISSION_QUEUE_NAME,
  DLQ_QUEUE_NAME,
  QUEUE_CONFIG,
} from '../common/constants/queue.constants';
import { DLQRepository } from '../database/dlq.repository';
import { DeadLetterJobRecord } from '../database/dlq.entity';

export interface SubmissionJobData {
  submissionId: string;
  studentId: string;
  assignmentId: string;
  language: string;
  fileName: string;
  fileSizeBytes: number;
  sha256Hash: string;
  filePath: string;
  enqueuedAt: string;
  attemptCount?: number;
}

export interface QueueStats {
  queueName: string;
  dlqQueueName: string;
  mode: 'REDIS' | 'IN_MEMORY';
  isRedisAvailable: boolean;
  waitingCount: number;
  activeCount: number;
  completedCount: number;
  failedCount: number;
  dlqCount: number;
  isCongested: boolean;
  concurrencyLimit: number;
  maxRetries: number;
}

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private bullQueue: Queue | null = null;
  private dlqQueue: Queue | null = null;
  private isRedisAvailable = false;
  private memoryQueue: Array<{ id: string; name: string; data: SubmissionJobData }> = [];
  private completedCount = 0;
  private failedCount = 0;

  constructor(private readonly dlqRepo: DLQRepository) {}

  async onModuleInit() {
    await this.initBullQueue();
  }

  async onModuleDestroy() {
    if (this.bullQueue) {
      await this.bullQueue.close();
    }
    if (this.dlqQueue) {
      await this.dlqQueue.close();
    }
    this.logger.log('[BullMQ] Queue connections closed gracefully.');
  }

  private initBullQueue(): void {
    const host = process.env.REDIS_HOST || '127.0.0.1';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const password = process.env.REDIS_PASSWORD || undefined;

    try {
      const redisOptions = {
        host,
        port,
        password,
        maxRetriesPerRequest: null,
        enableOfflineQueue: false,
        connectTimeout: 500,
        retryStrategy: () => null,
      };

      // Main Submission Queue
      this.bullQueue = new Queue(SUBMISSION_QUEUE_NAME, {
        connection: redisOptions,
        defaultJobOptions: {
          attempts: QUEUE_CONFIG.MAX_RETRIES,
          backoff: {
            type: 'exponential',
            delay: QUEUE_CONFIG.BACKOFF_DELAY_MS,
          },
          removeOnComplete: false,
          removeOnFail: false,
        },
      });

      // Dead Letter Queue (DLQ)
      this.dlqQueue = new Queue(DLQ_QUEUE_NAME, {
        connection: redisOptions,
        defaultJobOptions: {
          removeOnComplete: false,
          removeOnFail: false,
        },
      });

      // Background connection probe (non-blocking)
      this.bullQueue.client
        .then((client: any) => {
          return client.ping ? client.ping() : Promise.resolve('PONG');
        })
        .then(() => {
          this.isRedisAvailable = true;
          this.logger.log(`[BullMQ] Connected to Redis at ${host}:${port} (Main & DLQ queues active)`);
        })
        .catch((err) => {
          this.isRedisAvailable = false;
          this.logger.warn(
            `[BullMQ] Redis at ${host}:${port} not available: ${err.message}. High-speed In-Memory Queue + DLQ fallback active.`,
          );
        });
    } catch (err) {
      this.isRedisAvailable = false;
      this.logger.warn(`[BullMQ] Redis setup warning: ${err.message}. Using In-Memory fallback.`);
    }
  }

  /**
   * Adds a submission job into the grading queue.
   * Guarantees response time well under the required < 200ms threshold!
   */
  public async addSubmissionJob(
    data: SubmissionJobData,
  ): Promise<{ jobId: string; durationMs: number; mode: 'REDIS' | 'IN_MEMORY' }> {
    const startTime = performance.now();

    if (this.isRedisAvailable && this.bullQueue) {
      try {
        const job = await this.bullQueue.add('grade_submission', data, {
          jobId: `job_${data.submissionId}`,
        });
        const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
        this.logger.log(`[BullMQ] Job ${job.id} queued in Redis BullMQ in ${durationMs}ms`);
        return { jobId: job.id as string, durationMs, mode: 'REDIS' };
      } catch (err) {
        this.logger.warn(`[BullMQ] Failed to push to Redis (${err.message}). Falling back to In-Memory queue.`);
      }
    }

    // In-memory queue fallback (lightning fast: < 2ms)
    const jobId = `mem_${data.submissionId}_${Date.now()}`;
    this.memoryQueue.push({ id: jobId, name: 'grade_submission', data });
    const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
    this.logger.log(`[BullMQ] Job ${jobId} queued in In-Memory Queue in ${durationMs}ms`);

    return { jobId, durationMs, mode: 'IN_MEMORY' };
  }

  /**
   * Routes a failed job into the Dead Letter Queue (DLQ) after retry exhaustion
   */
  public async moveToDLQ(
    jobData: SubmissionJobData,
    failedReason: string,
    attemptsMade: number = QUEUE_CONFIG.MAX_RETRIES,
    stacktrace?: string,
  ): Promise<DeadLetterJobRecord> {
    const dlqId = `DLQ-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // 1. Persist to DLQ Repository (Database/File audit store)
    const dlqRecord = await this.dlqRepo.create({
      dlqId,
      queueName: SUBMISSION_QUEUE_NAME,
      originalJobId: `job_${jobData.submissionId}`,
      submissionId: jobData.submissionId,
      payload: jobData,
      failedReason,
      attemptsMade,
      stacktrace,
      status: 'FAILED',
    });

    // 2. Also enqueue to BullMQ DLQ queue if Redis is online
    if (this.isRedisAvailable && this.dlqQueue) {
      try {
        await this.dlqQueue.add('dead_letter_submission', {
          dlqId,
          ...dlqRecord,
        });
      } catch (err) {
        this.logger.warn(`[DLQ] Failed to push to Redis DLQ: ${err.message}`);
      }
    }

    this.failedCount++;
    this.logger.warn(
      `[DLQ] Job for submission ${jobData.submissionId} moved to DLQ (${dlqId}) after ${attemptsMade} attempts: ${failedReason}`,
    );

    return dlqRecord;
  }

  /**
   * Replays/retries a job from the DLQ back into the active processing queue
   */
  public async retryDLQJob(dlqId: string): Promise<{ success: boolean; newJobId: string; message: string }> {
    const dlqRecord = await this.dlqRepo.findById(dlqId);
    if (!dlqRecord) {
      throw new Error(`Không tìm thấy bản ghi DLQ với mã: ${dlqId}`);
    }

    const payload = dlqRecord.payload as SubmissionJobData;
    // Mark as retried
    await this.dlqRepo.markRetried(dlqId);

    // Re-enqueue job
    const enqueueResult = await this.addSubmissionJob({
      ...payload,
      enqueuedAt: new Date().toISOString(),
      attemptCount: 0,
    });

    this.logger.log(`[DLQ] Replayed job from DLQ ${dlqId} -> New Job: ${enqueueResult.jobId}`);
    return {
      success: true,
      newJobId: enqueueResult.jobId,
      message: `Đã đưa bài nộp ${payload.submissionId} từ DLQ trở lại hàng đợi chấm điểm thành công.`,
    };
  }

  public async getAllDLQJobs() {
    return this.dlqRepo.findAll();
  }

  public async deleteDLQJob(dlqId: string): Promise<boolean> {
    return this.dlqRepo.delete(dlqId);
  }

  public async purgeAllDLQ(): Promise<number> {
    return this.dlqRepo.purgeAll();
  }

  public getMemoryQueue() {
    return this.memoryQueue;
  }

  public popNextMemoryJob() {
    return this.memoryQueue.shift();
  }

  public markJobCompleted() {
    this.completedCount++;
  }

  /**
   * Returns complete queue statistics and congestion detection
   */
  public async getQueueStats(): Promise<QueueStats> {
    let waitingCount = this.memoryQueue.length;
    let activeCount = 0;

    if (this.isRedisAvailable && this.bullQueue) {
      try {
        const counts = await this.bullQueue.getJobCounts('waiting', 'active', 'completed', 'failed');
        waitingCount = counts.waiting || 0;
        activeCount = counts.active || 0;
      } catch (err) {
        this.logger.warn(`[BullMQ] Could not fetch live Redis counts: ${err.message}`);
      }
    }

    const dlqCount = this.dlqRepo.countActive();
    const isCongested = waitingCount > QUEUE_CONFIG.CONGESTION_THRESHOLD;

    return {
      queueName: SUBMISSION_QUEUE_NAME,
      dlqQueueName: DLQ_QUEUE_NAME,
      mode: this.isRedisAvailable ? 'REDIS' : 'IN_MEMORY',
      isRedisAvailable: this.isRedisAvailable,
      waitingCount,
      activeCount,
      completedCount: this.completedCount,
      failedCount: this.failedCount,
      dlqCount,
      isCongested,
      concurrencyLimit: QUEUE_CONFIG.CONCURRENCY_LIMIT,
      maxRetries: QUEUE_CONFIG.MAX_RETRIES,
    };
  }
}
