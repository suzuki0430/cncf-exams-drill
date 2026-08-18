import assert from "node:assert/strict";
import test from "node:test";

/** Renders the built application through its local worker entry point. */
async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the exam library and product metadata", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>CNCF Exams Drill<\/title>/i);
  assert.match(html, /Build confidence/);
  assert.match(html, /Cilium Certified Associate/);
  assert.match(html, /Full practice/);
  assert.match(html, /Review/);
});

test("does not ship starter, authentication, or database UI", async () => {
  const response = await render();
  const html = await response.text();

  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
  assert.doesNotMatch(html, /Sign in with ChatGPT/i);
  assert.doesNotMatch(html, /react-loading-skeleton/i);
});
