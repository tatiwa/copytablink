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

test("detects Jira key from path segment when host contains jira", () => {
  const url = "https://jira.company.com/browse/PROJ-123";
  assert.equal(detectJiraIssueKey(url), "PROJ-123");
});

test("detects Jira key from query string when host contains jira", () => {
  const url = "https://jira.company.com/issues/?selectedIssue=PROJ-456";
  assert.equal(detectJiraIssueKey(url), "PROJ-456");
});

test("ignores Jira-like patterns when host lacks jira", () => {
  const url = "https://docs.example.com/page";
  assert.equal(detectJiraIssueKey(url), null);
});

test("ignores Jira-like IDs inside URL when no explicit title", () => {
  const url = "https://docs.example.com/reference/PROJ-321";
  assert.equal(detectJiraIssueKey(url), null);
});

test("buildLinkPayload keeps plain formatting when detection is skipped", () => {
  const url = "https://docs.example.com/reference/PROJ-654";
  const title = url;
  const { html, text } = buildLinkPayload(title, url);
  assert.equal(html, `<a href="https://docs.example.com/reference/PROJ-654">${url}</a>`);
  assert.equal(text, `${url} (${url})`);
});
