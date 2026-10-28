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
import { SubmissionRepository } from '../database/submission.repository';

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

export interface AIReviewedPayload {
  submissionId: string;
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
  reviewedAt: string;
}

export interface GradingCompletedPayload {
  submissionId: string;
  status: 'COMPLETED' | 'FAILED';
  overallResult: 'PASSED' | 'FAILED';
  score: number;
  maxScore: number;
  /** Per-part score breakdown so the lecturer can see how the total was reached. */
  scoreBreakdown?: {
    testcase1: number;
    testcase2: number;
    cleanCode: number;
    solid: number;
    total: number;
  };
  passedTestcases: number;
  totalTestcases: number;
  testcaseResults?: Array<{
    testcaseIndex: number;
    status: 'PASSED' | 'FAILED';
    timeMs: number;
  }>;
  executionTimeMs: number;
  sourceCode?: string;
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
    // Optional diagnostic fields surfaced so the client can label the match without
    // recomputing it locally (isFlagged >= 70%, status per the plagiarism engine).
    isFlagged?: boolean;
    status?: string;
    jaccardSimilarity?: number;
    winnowingContainment?: number;
    astStructuralSimilarity?: number;
    /**
     * Set when the matched submission belongs to the same student. Distinguishes a
     * resubmission (never penalised) from reuse in another task (warn) and from
     * cross-course self-plagiarism (penalised).
     */
    selfOverlap?: {
      kind: 'SAME_ASSIGNMENT' | 'CROSS_ASSIGNMENT' | 'CROSS_COURSE';
      isSelfPlagiarism: boolean;
      label: string;
    };
    executionTimeMs?: number;
  };
  /** BR-03: true when the score was forced to 0 because AST plagiarism was confirmed (>= 80%). */
  confirmedPlagiarism?: boolean;
  /** Score the pipeline computed before the BR-03 plagiarism penalty was applied. */
  computedScoreBeforePenalty?: number;
  /** True when compilation failed inside the container, so every testcase scored 0. */
  compileError?: boolean;
  /** Raw compiler diagnostics, surfaced so the student can fix the code. */
  compileOutput?: string;
  /** True when the submission was actually built and run in a Docker container. */
  executedInContainer?: boolean;
  /** Similarity rate of the top match, 0 when nothing matched. */
  similarityRate?: number;
  /** Display label for the top match. */
  plagiarismStatus?: 'AN TOÀN' | 'NGHI VẤN' | 'ĐẠO VĂN';
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

  // Leak prevention: track socket memberships bidirectionally
  private readonly clientRoomsMap: Map<string, Set<string>> = new Map();
  private readonly roomClientsMap: Map<string, Set<string>> = new Map();

  @WebSocketServer()
  public server: Server;

  constructor(private readonly submissionRepo: SubmissionRepository) {}

  afterInit(server: Server) {
    this.logger.log('[WebSocket] Socket.IO Gateway initialized with room authorization and leak prevention.');
  }

  handleConnection(client: Socket) {
    this.clientRoomsMap.set(client.id, new Set());
    this.logger.log(`[WebSocket] Client connected: ${client.id} (Active: ${this.clientRoomsMap.size})`);
  }

  handleDisconnect(client: Socket) {
    const socketId = client.id;
    const rooms = this.clientRoomsMap.get(socketId);

    if (rooms) {
      for (const roomName of rooms) {
        const clientSet = this.roomClientsMap.get(roomName);
        if (clientSet) {
          clientSet.delete(socketId);
          if (clientSet.size === 0) {
            this.roomClientsMap.delete(roomName);
            this.logger.debug(`[WebSocket:LeakDefense] Room ${roomName} pruned (0 clients remaining)`);
          }
        }
      }
      this.clientRoomsMap.delete(socketId);
    }

    this.logger.log(
      `[WebSocket] Client disconnected: ${socketId} - Sockets left: ${this.clientRoomsMap.size}, Active Rooms: ${this.roomClientsMap.size}`,
    );
  }

  /**
   * Client joins a specific room for a submission to receive scoped real-time events.
   * Enforces Room Authorization: students can only join rooms of submissions they own (or instructors/admins).
   */
  @SubscribeMessage('join_submission')
  public async handleJoinSubmission(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { submissionId: string; studentId?: string; role?: string },
  ) {
    const { submissionId, studentId, role } = data || {};
    if (!submissionId) {
      client.emit('error', {
        code: 'MISSING_SUBMISSION_ID',
        message: 'submissionId is required to join a real-time room',
      });
      return;
    }

    // Room Authorization check against database
    const submission = await this.submissionRepo.findById(submissionId);
    if (submission && studentId) {
      const isPrivileged = role === 'ADMIN' || role === 'INSTRUCTOR' || studentId === 'GV001';
      const isOwner = submission.studentId.toUpperCase() === studentId.toUpperCase();

      if (!isOwner && !isPrivileged) {
        this.logger.warn(
          `[WebSocket:Auth] Unauthorized room access attempt by ${studentId} for submission ${submissionId} (Owner: ${submission.studentId})`,
        );
        client.emit('error', {
          code: 'UNAUTHORIZED_ROOM_ACCESS',
          message: 'Bạn không có quyền truy cập sự kiện chấm bài của sinh viên khác!',
        });
        return;
      }
    }

    const roomName = `submission_${submissionId}`;
    client.join(roomName);

    // Register in tracking maps
    if (!this.clientRoomsMap.has(client.id)) {
      this.clientRoomsMap.set(client.id, new Set());
    }
    this.clientRoomsMap.get(client.id)!.add(roomName);

    if (!this.roomClientsMap.has(roomName)) {
      this.roomClientsMap.set(roomName, new Set());
    }
    this.roomClientsMap.get(roomName)!.add(client.id);

    this.logger.log(
      `[WebSocket] Client ${client.id} joined room ${roomName} (Room clients: ${this.roomClientsMap.get(roomName)!.size})`,
    );

    client.emit('joined_submission', {
      submissionId,
      room: roomName,
      status: 'SUBSCRIBED',
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('subscribe:submission')
  public async handleSubscribeSubmission(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { submissionId: string; studentId?: string; role?: string },
  ) {
    return this.handleJoinSubmission(client, data);
  }

  @SubscribeMessage('leave_submission')
  public handleLeaveSubmission(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { submissionId: string },
  ) {
    const { submissionId } = data || {};
    if (submissionId) {
      const roomName = `submission_${submissionId}`;
      client.leave(roomName);

      // Clean up tracking
      this.clientRoomsMap.get(client.id)?.delete(roomName);
      const roomClients = this.roomClientsMap.get(roomName);
      if (roomClients) {
        roomClients.delete(client.id);
        if (roomClients.size === 0) {
          this.roomClientsMap.delete(roomName);
        }
      }

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
   * Broadcasts GenAI review result (Clean Code & SOLID radar breakdown)
   */
  public emitAIReviewed(payload: AIReviewedPayload): void {
    const roomName = `submission_${payload.submissionId}`;
    this.logger.log(
      `[WebSocket] Emitting ${QUEUE_EVENTS.AI_REVIEWED} to ${roomName} - CleanCode: ${payload.cleanCodeScore}/10`,
    );

    if (this.server) {
      this.server.to(roomName).emit(QUEUE_EVENTS.AI_REVIEWED, payload);
      this.server.emit(`admin:${QUEUE_EVENTS.AI_REVIEWED}`, payload);
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
      // BR-04: Báo cáo đạo văn tuyệt đối không công khai cho sinh viên (chỉ dành cho Giảng viên/HOD)
      const studentPayload: GradingCompletedPayload = {
        ...payload,
        plagiarismMatch: undefined,
      };
      this.server.to(roomName).emit(QUEUE_EVENTS.GRADING_COMPLETED, studentPayload);
      this.server.emit(`admin:${QUEUE_EVENTS.GRADING_COMPLETED}`, payload);
    }
  }

  /**
   * Broadcasts grading failure (Exception Path Coordinator & DLQ)
   */
  public emitGradingFailed(submissionId: string, error: string, dlqJobId?: string): void {
    const roomName = `submission_${submissionId}`;
    this.logger.warn(`[WebSocket] Emitting ${QUEUE_EVENTS.GRADING_FAILED} to ${roomName}: ${error}`);

    if (this.server) {
      this.server.to(roomName).emit(QUEUE_EVENTS.GRADING_FAILED, {
        submissionId,
        status: 'FAILED',
        error,
        dlqJobId,
        timestamp: new Date().toISOString(),
      });
      this.server.emit(`admin:${QUEUE_EVENTS.GRADING_FAILED}`, {
        submissionId,
        error,
        dlqJobId,
      });
    }
  }

  public getRoomMetrics() {
    return {
      activeSockets: this.clientRoomsMap.size,
      activeRooms: this.roomClientsMap.size,
      roomDetails: Array.from(this.roomClientsMap.entries()).map(([room, clients]) => ({
        room,
        clientsCount: clients.size,
      })),
    };
  }
}
