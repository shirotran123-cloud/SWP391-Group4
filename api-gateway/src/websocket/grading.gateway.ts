import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { QUEUE_EVENTS } from '../common/constants/queue.constants';

export interface TestcaseEvaluatedPayload {
  submissionId: string;
  testcaseId: string;
  testcaseIndex: number;
  totalTestcases: number;
  status: 'PASSED' | 'FAILED' | 'TLE' | 'MLE';
  timeMs: number;
  memoryKb?: number;
  detail?: string;
  inputSnippet?: string;
  outputSnippet?: string;
  expectedSnippet?: string;
}

export interface GradingProgressPayload {
  submissionId: string;
  stepId: string;
  stepName: string;
  status: 'in_progress' | 'passed' | 'failed';
  detail?: string;
}

export interface GradingCompletedPayload {
  submissionId: string;
  status: 'COMPLETED' | 'FAILED';
  overallResult: 'PASSED' | 'FAILED';
  score: number;
  maxScore: number;
  passedTestcases: number;
  totalTestcases: number;
  executionTimeMs: number;
  aiRating?: {
    cleanCodeScore: number;
    solidScore: {
      s: number;
      o: number;
      l: number;
      i: number;
      d: number;
    };
    codeSmells: Array<{ line: number; rule: string; description: string }>;
    explanation: string;
  };
  plagiarismMatch?: {
    matchedStudentName: string;
    matchedStudentId: string;
    similarityRate: number;
    sourceCodeA: string;
    sourceCodeB: string;
    matchedTokens: Array<{ lineA: [number, number]; lineB: [number, number] }>;
  };
  completedAt: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class GradingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(GradingGateway.name);

  @WebSocketServer()
  public server: Server;

  afterInit(server: Server) {
    this.logger.log('[WebSocket] Socket.IO Gateway initialized and ready for connections.');
  }

  handleConnection(client: Socket) {
    this.logger.log(`[WebSocket] Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[WebSocket] Client disconnected: ${client.id}`);
  }

  /**
   * Client joins a specific room for a submission to receive scoped real-time events
   */
  @SubscribeMessage('join_submission')
  handleJoinSubmission(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { submissionId: string },
  ) {
    const { submissionId } = data || {};
    if (!submissionId) {
      client.emit('error', { message: 'submissionId is required to join' });
      return;
    }

    const roomName = `submission_${submissionId}`;
    client.join(roomName);
    this.logger.log(`[WebSocket] Client ${client.id} joined room ${roomName}`);

    client.emit('joined_submission', {
      submissionId,
      room: roomName,
      status: 'SUBSCRIBED',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Alias for backward compatibility / flexibility
   */
  @SubscribeMessage('subscribe:submission')
  handleSubscribeSubmission(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { submissionId: string },
  ) {
    return this.handleJoinSubmission(client, data);
  }

  @SubscribeMessage('leave_submission')
  handleLeaveSubmission(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { submissionId: string },
  ) {
    const { submissionId } = data || {};
    if (submissionId) {
      const roomName = `submission_${submissionId}`;
      client.leave(roomName);
      this.logger.log(`[WebSocket] Client ${client.id} left room ${roomName}`);
    }
  }

  /**
   * Broadcasts testcase evaluated event to student listening to submissionId
   */
  public emitTestcaseEvaluated(payload: TestcaseEvaluatedPayload): void {
    const roomName = `submission_${payload.submissionId}`;
    this.logger.log(
      `[WebSocket] Emitting ${QUEUE_EVENTS.TESTCASE_EVALUATED} to ${roomName} - TC ${payload.testcaseIndex}/${payload.totalTestcases}: ${payload.status}`,
    );

    if (this.server) {
      this.server.to(roomName).emit(QUEUE_EVENTS.TESTCASE_EVALUATED, payload);
      // Also emit to global namespace for debugging / admin dashboards
      this.server.emit(`admin:${QUEUE_EVENTS.TESTCASE_EVALUATED}`, payload);
    }
  }

  /**
   * Broadcasts granular grading step progress to client
   */
  public emitGradingProgress(payload: GradingProgressPayload): void {
    const roomName = `submission_${payload.submissionId}`;
    this.logger.log(
      `[WebSocket] Emitting ${QUEUE_EVENTS.GRADING_PROGRESS} to ${roomName} - Step: ${payload.stepName} (${payload.status})`,
    );

    if (this.server) {
      this.server.to(roomName).emit(QUEUE_EVENTS.GRADING_PROGRESS, payload);
    }
  }

  /**
   * Broadcasts final grading completion event
   */
  public emitGradingCompleted(payload: GradingCompletedPayload): void {
    const roomName = `submission_${payload.submissionId}`;
    this.logger.log(
      `[WebSocket] Emitting ${QUEUE_EVENTS.GRADING_COMPLETED} to ${roomName} - Final Score: ${payload.score}/${payload.maxScore}`,
    );

    if (this.server) {
      this.server.to(roomName).emit(QUEUE_EVENTS.GRADING_COMPLETED, payload);
      this.server.emit(`admin:${QUEUE_EVENTS.GRADING_COMPLETED}`, payload);
    }
  }

  /**
   * Broadcasts grading failure
   */
  public emitGradingFailed(submissionId: string, error: string): void {
    const roomName = `submission_${submissionId}`;
    this.logger.warn(`[WebSocket] Emitting ${QUEUE_EVENTS.GRADING_FAILED} to ${roomName}: ${error}`);

    if (this.server) {
      this.server.to(roomName).emit(QUEUE_EVENTS.GRADING_FAILED, {
        submissionId,
        status: 'FAILED',
        error,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
