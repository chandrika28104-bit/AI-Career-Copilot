import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";
import analyzeHandler from "./analyze.js";

async function callHandler({ method = "POST", body, headers = {} } = {}) {
  const req = Readable.from([]);
  req.method = method;
  req.headers = headers;
  if (body !== undefined) req.body = body;

  const responseHeaders = {};
  const res = {
    setHeader(name, value) {
      responseHeaders[name.toLowerCase()] = value;
    },
    end(value) {
      this.body = value;
    },
  };
  await analyzeHandler(req, res);
  return { status: res.statusCode, headers: responseHeaders, body: JSON.parse(res.body) };
}

const validInputs = {
  resume:
    "Software engineer with five years of experience building reliable web applications, APIs, and automated test suites for enterprise customers.",
  jobDescription:
    "We are hiring a software engineer with experience in TypeScript, cloud services, API design, observability, and collaboration with product teams.",
};

test("rejects methods other than POST", async () => {
  const result = await callHandler({ method: "GET" });
  assert.equal(result.status, 405);
  assert.equal(result.headers.allow, "POST");
});

test("rejects missing and short resume inputs", async () => {
  const result = await callHandler({
    body: { resume: "short", jobDescription: validInputs.jobDescription },
  });
  assert.equal(result.status, 400);
  assert.match(result.body.error, /at least 50 characters/);
});

test("rejects malformed JSON", async () => {
  const result = await callHandler({ body: "{" });
  assert.equal(result.status, 400);
});

test("returns a clear setup error when the Gemini key is absent", async () => {
  const priorKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const result = await callHandler({ body: validInputs });
    assert.equal(result.status, 503);
    assert.match(result.body.error, /GEMINI_API_KEY/);
    assert.equal(result.headers["cache-control"], "no-store");
  } finally {
    if (priorKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = priorKey;
  }
});

test("sends the request to Gemini server-side and normalizes the result", async () => {
  const priorKey = process.env.GEMINI_API_KEY;
  const priorFetch = globalThis.fetch;
  let capturedRequest;
  process.env.GEMINI_API_KEY = "test-server-key";
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    ats_score: 115,
                    summary: "Strong relevant experience.",
                    strengths: ["Relevant experience"],
                    missing_keywords: ["Observability"],
                    improvements: ["Add a measurable result."],
                  }),
                },
              ],
            },
          },
        ],
      }),
    };
  };

  try {
    const result = await callHandler({ body: validInputs });
    assert.equal(result.status, 200);
    assert.equal(result.body.ats_score, 100);
    assert.equal(result.body.summary, "Strong relevant experience.");
    assert.equal(result.body.missing_keywords[0], "Observability");
    assert.equal(capturedRequest.options.headers["x-goog-api-key"], "test-server-key");
    assert.doesNotMatch(capturedRequest.url, /test-server-key/);
    const sentBody = JSON.parse(capturedRequest.options.body);
    assert.match(sentBody.contents[0].parts[0].text, /Software engineer/);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = priorKey;
  }
});

test("rejects oversized input before contacting Gemini", async () => {
  const result = await callHandler({
    body: { resume: "r".repeat(70_000), jobDescription: validInputs.jobDescription },
  });
  assert.equal(result.status, 413);
});
