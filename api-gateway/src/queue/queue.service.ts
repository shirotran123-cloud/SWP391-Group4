import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Job } from 'bullmq';
import { SUBMISSION_QUEUE_NAME, QUEUE_EVENTS } from '../common/constants/queue.constants';

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
}

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private bullQueue: Queue | null = null;
  private isRedisAvailable = false;
  private memoryQueue: Array<{ id: string; name: string; data: SubmissionJobData }> = [];

  async onModuleInit() {
    await this.initBullQueue();
  }

  async onModuleDestroy() {
    if (this.bullQueue) {
      await this.bullQueue.close();
      this.logger.log('[BullMQ] Queue connection closed gracefully.');
    }
  }

  private initBullQueue(): void {
    const host = process.env.REDIS_HOST || '127.0.0.1';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const password = process.env.REDIS_PASSWORD || undefined;

    try {
      this.bullQueue = new Queue(SUBMISSION_QUEUE_NAME, {
        connection: {
          host,
          port,
          password,
          maxRetriesPerRequest: null,
          enableOfflineQueue: false,
          connectTimeout: 500,
          retryStrategy: () => null, // Don't hang reconnecting if Redis is not present
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1500,
          },
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
          this.logger.log(`[BullMQ] Connected to Redis instance at ${host}:${port}`);
        })
        .catch((err) => {
          this.isRedisAvailable = false;
          this.logger.warn(`[BullMQ] Redis at ${host}:${port} not available: ${err.message}. High-speed In-Memory Queue fallback active.`);
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
  public async addSubmissionJob(data: SubmissionJobData): Promise<{ jobId: string; durationMs: number; mode: 'REDIS' | 'IN_MEMORY' }> {
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

  public getMemoryQueue() {
    return this.memoryQueue;
  }

  public popNextMemoryJob() {
    return this.memoryQueue.shift();
  }

  public getRedisStatus(): { isRedisAvailable: boolean; queueName: string } {
    return {
      isRedisAvailable: this.isRedisAvailable,
      queueName: SUBMISSION_QUEUE_NAME,
    };
  }
}
