import * as http from "http";
import { createGenAIHub } from "./index";
import { ReviewRequest } from "./types/review.types";
import { ExamGenerateRequest } from "./types/exam.types";

const PORT = Number(process.env.PORT) || 3001;

function setCorsHeaders(res: http.ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function sendJson(res: http.ServerResponse, statusCode: number, data: unknown) {
  setCorsHeaders(res);
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function parseJsonBody<T>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        req.destroy();
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : ({} as T));
      } catch (err) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", (err) => reject(err));
  });
}

export function createServer(customHub?: ReturnType<typeof createGenAIHub>): http.Server {
  const hub = customHub || createGenAIHub();

  const server = http.createServer(async (req, res) => {
    const url = req.url || "/";
    const method = req.method?.toUpperCase() || "GET";

    if (method === "OPTIONS") {
      setCorsHeaders(res);
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      // 1. Health check & Telemetry
      if (method === "GET" && (url === "/health" || url === "/api/v1/ai/health")) {
        const statsOpenAI = hub.keyRotator.getPoolStats("openai");
        const statsGemini = hub.keyRotator.getPoolStats("gemini");
        return sendJson(res, 200, {
          status: "UP",
          subsystem: "Subsystem 3: GenAI Core & Review Hub",
          activeProvider: hub.provider.providerName,
          keyPools: {
            openai: statsOpenAI,
            gemini: statsGemini,
          },
          uptimeSeconds: Math.floor(process.uptime()),
          timestamp: new Date().toISOString(),
        });
      }

      // 2. Code Review & Clean Code/SOLID scoring (UC-09)
      if (method === "POST" && url === "/api/v1/ai/review") {
        const payload = await parseJsonBody<ReviewRequest>(req);
        if (!payload.submissionId || !payload.sourceFiles || !Array.isArray(payload.sourceFiles)) {
          return sendJson(res, 400, {
            error: "Bad Request: 'submissionId' and 'sourceFiles' array are required.",
          });
        }
        const review = await hub.codeReviewer.reviewCode(payload);
        return sendJson(res, 200, review);
      }

      // 3. Compiler & Runtime Error Explainer
      if (method === "POST" && url === "/api/v1/ai/explain-error") {
        const payload = await parseJsonBody<{
          compilerOutput: string;
          language: string;
          codeSnippet?: string;
        }>(req);

        if (!payload.compilerOutput || !payload.language) {
          return sendJson(res, 400, {
            error: "Bad Request: 'compilerOutput' and 'language' are required.",
          });
        }
        const explanation = await hub.compilerExplainer.explainError(
          payload.compilerOutput,
          payload.language,
          payload.codeSnippet
        );
        return sendJson(res, 200, explanation);
      }

      // 4. Exam & Rubric Generator (UC-08)
      if (method === "POST" && url === "/api/v1/ai/generate-exam") {
        const payload = await parseJsonBody<ExamGenerateRequest>(req);
        if (!payload.topic || !payload.courseCode || !payload.language) {
          return sendJson(res, 400, {
            error: "Bad Request: 'topic', 'courseCode', and 'language' are required.",
          });
        }
        const exam = await hub.examGenerator.generateExam(payload);
        return sendJson(res, 200, exam);
      }

      // 5. Prompt Injection Sanitizer check endpoint (R03)
      if (method === "POST" && url === "/api/v1/ai/sanitize") {
        const payload = await parseJsonBody<{ code: string; maxChars?: number }>(req);
        if (typeof payload.code !== "string") {
          return sendJson(res, 400, { error: "Bad Request: 'code' string is required." });
        }
        const sanitized = hub.promptSanitizer.sanitize(payload.code, payload.maxChars);
        return sendJson(res, 200, sanitized);
      }

      // 404 Route Not Found
      return sendJson(res, 404, {
        error: "Route Not Found",
        path: url,
        method,
      });
    } catch (err: any) {
      console.error(`[Server Error] ${method} ${url}:`, err);
      return sendJson(res, 500, {
        error: "Internal Server Error",
        message: err.message || "An unexpected error occurred in GenAI Hub",
      });
    }
  });

  return server;
}

if (require.main === module) {
  const hub = createGenAIHub();
  const server = createServer(hub);
  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`  AITA GenAI Core & Review Hub REST Server`);
    console.log(`  Listening on: http://localhost:${PORT}`);
    console.log(`  Provider:     ${hub.provider.providerName}`);
    console.log(`======================================================\n`);
  });
}