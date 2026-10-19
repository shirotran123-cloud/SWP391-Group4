import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiAIService, isPureTextModel, pickBestTextModel } from '../services/gemini-ai.service';

/**
 * The exam-generation service is the most failure-prone part of the UI: it depends on an
 * external API and must degrade predictably. These tests pin the pure helpers exactly and the
 * network paths with a stubbed `fetch`, so no real key or network is ever needed.
 */

describe('isPureTextModel', () => {
  it('accepts a plain Gemini text model', () => {
    expect(isPureTextModel('gemini-2.0-flash')).toBe(true);
    expect(isPureTextModel('models/gemini-1.5-pro')).toBe(true);
  });

  it('rejects an embedding model', () => {
    expect(isPureTextModel('text-embedding-004')).toBe(false);
  });

  it('rejects a text-to-speech model', () => {
    expect(isPureTextModel('gemini-2.0-flash-tts')).toBe(false);
  });

  it('rejects an image or vision-only model', () => {
    expect(isPureTextModel('imagen-3.0')).toBe(false);
  });

  it('rejects a non-Gemini model name', () => {
    expect(isPureTextModel('gpt-4o')).toBe(false);
  });

  it('rejects an empty name', () => {
    expect(isPureTextModel('')).toBe(false);
  });

  it('rejects a non-string argument', () => {
    expect(isPureTextModel(undefined as any)).toBe(false);
    expect(isPureTextModel(null as any)).toBe(false);
  });
});

describe('pickBestTextModel', () => {
  it('prefers gemini-2.0-flash when available', () => {
    expect(pickBestTextModel(['gemini-1.5-pro', 'gemini-2.0-flash'])).toBe('gemini-2.0-flash');
  });

  it('falls back to a sensible default for an empty list', () => {
    expect(pickBestTextModel([])).toBe('gemini-2.0-flash');
  });

  it('strips the models/ prefix', () => {
    expect(pickBestTextModel(['models/gemini-2.0-flash'])).toBe('gemini-2.0-flash');
  });

  it('ignores unsupported models when picking', () => {
    const picked = pickBestTextModel(['text-embedding-004', 'gemini-1.5-flash']);
    expect(picked).toBe('gemini-1.5-flash');
  });
});

describe('GeminiAIService.extractRequestedCount', () => {
  it('reads a plain number', () => {
    expect(GeminiAIService.extractRequestedCount('sinh 5 testcase')).toBe(5);
  });

  it('reads a number written before the word "test"', () => {
    expect(GeminiAIService.extractRequestedCount('tạo 7 test case')).toBe(7);
  });

  it('reads a Vietnamese number phrase', () => {
    expect(GeminiAIService.extractRequestedCount('cần 4 bộ testcase')).toBe(4);
  });

  it('returns null when no count is mentioned', () => {
    expect(GeminiAIService.extractRequestedCount('làm bài về sắp xếp')).toBeNull();
  });

  it('handles an empty prompt', () => {
    expect(GeminiAIService.extractRequestedCount('')).toBeNull();
  });

  it('does not return an absurd count', () => {
    const n = GeminiAIService.extractRequestedCount('sinh 9999 testcase');
    expect(n === null || n <= 100).toBe(true);
  });
});

describe('GeminiAIService.generateAssignment (network paths)', () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    (globalThis as any).fetch = realFetch;
  });

  const VALID_EXAM = {
    title: 'Đề kiểm thử',
    description: 'mô tả',
    problemStatement: 'đề',
    timeLimitMs: 2000,
    memoryLimitMb: 512,
    testCases: [{ input: '1 2', output: '3', weight: 1, isHidden: false }],
    rubric: [{ criterion: 'Đúng', maxScore: 10, description: 'ok' }],
    starterCode: 'stub',
    referenceSolution: 'ref',
  };

  it('returns the parsed exam when the API answers with JSON', async () => {
    (globalThis as any).fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(VALID_EXAM) }] } }],
      }),
      text: async () => '',
    }));

    const result = await GeminiAIService.generateAssignment('fake-key', {
      courseName: 'SWP391',
      courseCode: 'SWP391',
      topicPrompt: 'sắp xếp',
    } as any);

    expect(result.title).toBe('Đề kiểm thử');
    expect(result.testCases.length).toBe(1);
    expect(typeof result.latencyMs).toBe('number');
  });

  it('refuses to run without an API key', async () => {
    await expect(
      GeminiAIService.generateAssignment('', {
        courseName: 'SWP391',
        courseCode: 'SWP391',
        topicPrompt: 'x',
      } as any),
    ).rejects.toThrow();
  });

  it('surfaces a readable error when the API rejects the key', async () => {
    (globalThis as any).fetch = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'API_KEY_INVALID' } }),
      text: async () => JSON.stringify({ error: { message: 'API_KEY_INVALID' } }),
    }));

    await expect(
      GeminiAIService.generateAssignment('bad-key', {
        courseName: 'SWP391',
        courseCode: 'SWP391',
        topicPrompt: 'x',
      } as any),
    ).rejects.toThrow(/API_KEY_INVALID|API key|không/i);
  });

  it('strips a markdown code fence around the JSON', async () => {
    (globalThis as any).fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          { content: { parts: [{ text: '```json\n' + JSON.stringify(VALID_EXAM) + '\n```' }] } },
        ],
      }),
      text: async () => '',
    }));

    const result = await GeminiAIService.generateAssignment('fake-key', {
      courseName: 'SWP391',
      courseCode: 'SWP391',
      topicPrompt: 'x',
    } as any);
    expect(result.title).toBe('Đề kiểm thử');
  });

  it('fails clearly when every model returns empty content', async () => {
    (globalThis as any).fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '' }] } }] }),
      text: async () => '',
    }));

    await expect(
      GeminiAIService.generateAssignment('fake-key', {
        courseName: 'SWP391',
        courseCode: 'SWP391',
        topicPrompt: 'x',
      } as any),
    ).rejects.toThrow();
  });
});
