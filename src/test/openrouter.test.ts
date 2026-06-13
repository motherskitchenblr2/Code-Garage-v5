import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../../api/openrouter.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRes() {
  const res = {
    _status: 200,
    _body: null as unknown,
    status(code: number) {
      this._status = code;
      return this;
    },
    json(body: unknown) {
      this._body = body;
      return this;
    },
  };
  return res;
}

function makeReq(body: Record<string, unknown> = {}, method = 'POST') {
  return { method, body };
}

/** Build a mock fetch Response with a given ok status and JSON payload. */
function mockFetchResponse(
  payload: unknown,
  status = 200,
  ok = true,
): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(payload),
  } as unknown as Response;
}

const VALID_PARSED_BODY = JSON.stringify({
  issues: [],
  fixedCode: 'const x = 1;',
  summary: 'No issues found',
});

/** Minimal valid request body that passes all validation gates. */
const VALID_BODY = {
  code: 'const x = 1;',
  language: 'typescript',
};

// ---------------------------------------------------------------------------
// Tests focused on the typed response.json() result (PR change: line 118)
// ---------------------------------------------------------------------------

describe('handler – response.json() typed result (choices / usage access)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    process.env['OPENROUTER_API_KEY'] = 'test-key';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env['OPENROUTER_API_KEY'];
  });

  // -------------------------------------------------------------------------
  // Successful response shapes
  // -------------------------------------------------------------------------

  it('returns 200 with parsed data when choices and full usage are present', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({
        choices: [{ message: { content: VALID_PARSED_BODY } }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      }),
    );

    const req = makeReq(VALID_BODY);
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    const body = res._body as Record<string, unknown>;
    expect(body['tokensUsed']).toBe(30);
    expect(body['promptTokens']).toBe(10);
    expect(body['completionTokens']).toBe(20);
  });

  it('falls back to prompt_tokens + completion_tokens when total_tokens is absent', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({
        choices: [{ message: { content: VALID_PARSED_BODY } }],
        usage: { prompt_tokens: 15, completion_tokens: 25 },
      }),
    );

    const req = makeReq(VALID_BODY);
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    const body = res._body as Record<string, unknown>;
    expect(body['tokensUsed']).toBe(40); // 15 + 25
    expect(body['promptTokens']).toBe(15);
    expect(body['completionTokens']).toBe(25);
  });

  it('defaults all token counts to 0 when usage is absent from the response', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({
        choices: [{ message: { content: VALID_PARSED_BODY } }],
        // no usage field
      }),
    );

    const req = makeReq(VALID_BODY);
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    const body = res._body as Record<string, unknown>;
    expect(body['tokensUsed']).toBe(0);
    expect(body['promptTokens']).toBe(0);
    expect(body['completionTokens']).toBe(0);
  });

  it('defaults all token counts to 0 when usage fields are individually absent', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({
        choices: [{ message: { content: VALID_PARSED_BODY } }],
        usage: {}, // empty usage object
      }),
    );

    const req = makeReq(VALID_BODY);
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    const body = res._body as Record<string, unknown>;
    expect(body['tokensUsed']).toBe(0);
    expect(body['promptTokens']).toBe(0);
    expect(body['completionTokens']).toBe(0);
  });

  it('uses total_tokens directly when provided, ignoring the computed sum', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({
        choices: [{ message: { content: VALID_PARSED_BODY } }],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 999 },
      }),
    );

    const req = makeReq(VALID_BODY);
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    const body = res._body as Record<string, unknown>;
    expect(body['tokensUsed']).toBe(999); // total_tokens takes precedence
  });

  // -------------------------------------------------------------------------
  // Empty / missing content in choices
  // -------------------------------------------------------------------------

  it('returns 500 "Empty model response" when choices array is empty', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({
        choices: [],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    );

    const req = makeReq(VALID_BODY);
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(500);
    const body = res._body as Record<string, unknown>;
    expect(body['error']).toBe('Empty model response');
  });

  it('returns 500 "Empty model response" when choices key is absent', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    );

    const req = makeReq(VALID_BODY);
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(500);
    const body = res._body as Record<string, unknown>;
    expect(body['error']).toBe('Empty model response');
  });

  it('returns 500 "Empty model response" when message.content is undefined', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({
        choices: [{ message: {} }], // content absent
        usage: {},
      }),
    );

    const req = makeReq(VALID_BODY);
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(500);
    const body = res._body as Record<string, unknown>;
    expect(body['error']).toBe('Empty model response');
  });

  it('returns 500 "Empty model response" when choices[0].message is undefined', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({
        choices: [{}], // no message key
        usage: {},
      }),
    );

    const req = makeReq(VALID_BODY);
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(500);
    const body = res._body as Record<string, unknown>;
    expect(body['error']).toBe('Empty model response');
  });

  // -------------------------------------------------------------------------
  // Non-OK upstream response — data still typed, passed through to caller
  // -------------------------------------------------------------------------

  it('proxies upstream error status and typed data when response.ok is false', async () => {
    const errorPayload = {
      choices: [],
      error: { message: 'Invalid API key' },
    };
    vi.mocked(fetch).mockResolvedValue(mockFetchResponse(errorPayload, 401, false));

    const req = makeReq(VALID_BODY);
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(401);
    const body = res._body as Record<string, unknown>;
    expect(body['error']).toBe('OpenRouter error');
    expect(body['details']).toEqual(errorPayload);
  });

  it('proxies 429 rate-limit upstream error with typed data', async () => {
    const errorPayload = { choices: [] };
    vi.mocked(fetch).mockResolvedValue(mockFetchResponse(errorPayload, 429, false));

    const req = makeReq(VALID_BODY);
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(429);
    const body = res._body as Record<string, unknown>;
    expect(body['error']).toBe('OpenRouter error');
  });

  // -------------------------------------------------------------------------
  // JSON parsing of model content (exercises choices[0].message.content)
  // -------------------------------------------------------------------------

  it('returns 500 "Model did not return valid JSON" when content is not JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({
        choices: [{ message: { content: 'this is plain text, not JSON' } }],
        usage: {},
      }),
    );

    const req = makeReq(VALID_BODY);
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(500);
    const body = res._body as Record<string, unknown>;
    expect(body['error']).toBe('Model did not return valid JSON');
    expect(body['raw']).toBe('this is plain text, not JSON');
  });

  it('extracts JSON from markdown code block when content is markdown-wrapped', async () => {
    const innerJson = JSON.stringify({
      issues: [],
      fixedCode: 'let y = 2;',
      summary: 'All good',
    });
    const markdownContent = `\`\`\`json\n${innerJson}\n\`\`\``;

    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({
        choices: [{ message: { content: markdownContent } }],
        usage: { prompt_tokens: 8, completion_tokens: 12, total_tokens: 20 },
      }),
    );

    const req = makeReq(VALID_BODY);
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    const body = res._body as Record<string, unknown>;
    expect(body['summary']).toBe('All good');
    expect(body['tokensUsed']).toBe(20);
  });

  it('returns 500 when markdown block contains invalid JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({
        choices: [{ message: { content: '```json\n{broken json\n```' } }],
        usage: {},
      }),
    );

    const req = makeReq(VALID_BODY);
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(500);
    const body = res._body as Record<string, unknown>;
    expect(body['error']).toBe('Model did not return valid JSON');
  });

  // -------------------------------------------------------------------------
  // fetch() itself throws (network error)
  // -------------------------------------------------------------------------

  it('returns 500 "Server error" when fetch throws a network error', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network failure'));

    const req = makeReq(VALID_BODY);
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(500);
    const body = res._body as Record<string, unknown>;
    expect(body['error']).toBe('Server error');
    expect(body['details']).toBe('Network failure');
  });

  // -------------------------------------------------------------------------
  // Boundary / regression: partial usage combinations
  // -------------------------------------------------------------------------

  it('correctly computes tokensUsed when only completion_tokens is provided', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({
        choices: [{ message: { content: VALID_PARSED_BODY } }],
        usage: { completion_tokens: 7 }, // no prompt_tokens, no total_tokens
      }),
    );

    const req = makeReq(VALID_BODY);
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    const body = res._body as Record<string, unknown>;
    // promptTokens defaults to 0, so tokensUsed = 0 + 7
    expect(body['promptTokens']).toBe(0);
    expect(body['completionTokens']).toBe(7);
    expect(body['tokensUsed']).toBe(7);
  });

  it('attaches modelUsed to the response', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({
        choices: [{ message: { content: VALID_PARSED_BODY } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    );

    const req = makeReq({ ...VALID_BODY, model: 'mistralai/mistral-7b-instruct:free' });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    const body = res._body as Record<string, unknown>;
    expect(body['modelUsed']).toBe('mistralai/mistral-7b-instruct:free');
  });
});