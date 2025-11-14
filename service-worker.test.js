const test = require("node:test");
const assert = require("node:assert/strict");

global.chrome = {
  action: {
    onClicked: {
      addListener: () => {},
    },
  },
  scripting: {
    executeScript: () => {},
  },
};

const { createCopyLinkHelpers } = require("./service-worker.js");

const { detectJiraIssueKey, buildLinkPayload } = createCopyLinkHelpers();

test("detects Jira key from Jira Cloud path segment", () => {
  const url = "https://company.atlassian.net/browse/PROJ-123";
  assert.equal(detectJiraIssueKey(url, "Some Title"), "PROJ-123");
});

test("detects Jira key from Jira Cloud query string", () => {
  const url = "https://company.atlassian.net/issues/?selectedIssue=PROJ-456";
  assert.equal(detectJiraIssueKey(url, "Some Title"), "PROJ-456");
});

test("falls back to explicit title when host is not Jira", () => {
  const url = "https://docs.example.com/page";
  const title = "[PROJ-789] Spec draft";
  assert.equal(detectJiraIssueKey(url, title), "PROJ-789");
});

test("ignores Jira-like IDs inside URL when no explicit title", () => {
  const url = "https://docs.example.com/reference/PROJ-321";
  assert.equal(detectJiraIssueKey(url, null), null);
});

test("buildLinkPayload keeps plain formatting when detection is skipped", () => {
  const url = "https://docs.example.com/reference/PROJ-654";
  const title = url;
  const { html, text } = buildLinkPayload(title, url, false);
  assert.equal(html, `<a href="https://docs.example.com/reference/PROJ-654">${url}</a>`);
  assert.equal(text, `${url} (${url})`);
});
