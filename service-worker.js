const copyLinkHelpers = createCopyLinkHelpers();

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id || !tab.url) {
    console.error("No active tab to copy.");
    return;
  }

  try {
    const explicitTitle = (tab.title || "").trim();
    const displayTitle = explicitTitle || tab.url;
    const { html, text } = copyLinkHelpers.buildLinkPayload(displayTitle, tab.url);

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: copyLinkPayloadToClipboard,
      args: [html, text],
      world: "ISOLATED",
    });
  } catch (error) {
    console.error("Failed to write to clipboard", error);
  }
});

async function copyLinkPayloadToClipboard(html, text) {
  try {
    // Focus is often required for the Clipboard API to work
    window.focus();

    if (navigator.clipboard && "write" in navigator.clipboard && window.ClipboardItem) {
      const htmlBlob = new Blob([html], { type: "text/html" });
      const textBlob = new Blob([text], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": htmlBlob,
          "text/plain": textBlob,
        }),
      ]);
      return; // Success
    }
  } catch (error) {
    console.error("Rich text copy failed, falling back to plain text:", error);
  }

  // Fallback to plain text if rich text failed or wasn't supported
  if (navigator.clipboard && "writeText" in navigator.clipboard) {
    await navigator.clipboard.writeText(text);
  } else {
    throw new Error("Clipboard API is unavailable in this page.");
  }
}

function createCopyLinkHelpers() {
  function buildLinkPayload(currentTitle, currentUrl) {
    const issueKey = detectJiraIssueKey(currentUrl);

    if (issueKey) {
      const suffixTitle = normalizeJiraTitle(currentTitle, issueKey);
      const separator = suffixTitle ? " " : "";
      const htmlTitle = suffixTitle ? separator + escapeHtml(suffixTitle) : "";
      const plainTitle = suffixTitle ? separator + suffixTitle : "";

      return {
        html: `<a href="${escapeAttribute(currentUrl)}">${escapeHtml(issueKey)}</a>${htmlTitle}`,
        text: `${issueKey}${plainTitle} (${currentUrl})`,
      };
    }

    return {
      html: `<a href="${escapeAttribute(currentUrl)}">${escapeHtml(currentTitle)}</a>`,
      text: `${currentTitle} (${currentUrl})`,
    };
  }

  // Stricter Jira key detection: only Jira-like hosts + strict KEY_RE
  function detectJiraIssueKey(currentUrl) {
    const KEY_RE = /\b([A-Z]{2,10}-\d{1,6})\b/;
    let parsed;
    try {
      parsed = new URL(currentUrl);
    } catch {
      parsed = null;
    }

    if (parsed) {
      const host = parsed.hostname.toLowerCase();
      const hostLooksLikeJira = host.includes("jira");

      if (hostLooksLikeJira) {
        const pathMatch = parsed.pathname.match(KEY_RE);
        if (pathMatch) return pathMatch[1];

        if (parsed.search) {
          const queryValues = Array.from(parsed.searchParams.values()).join(" ");
          const queryMatch = queryValues.match(KEY_RE);
          if (queryMatch) return queryMatch[1];
        }
      }
    }

    return null;
  }

  function normalizeJiraTitle(currentTitle, issueKey) {
    if (!currentTitle) return "";
    let cleanedTitle = currentTitle.replace(/\s*[-|:]?\s*Jira.*$/i, "");
    const issueKeyPattern = new RegExp(`^\\s*\\[?${issueKey}\\]?\\s*[-:|]?\\s*`, "i");
    cleanedTitle = cleanedTitle.replace(issueKeyPattern, "");
    return cleanedTitle.trim();
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (char) => {
      switch (char) {
        case "&": return "&amp;";
        case "<": return "&lt;";
        case ">": return "&gt;";
        case '"': return "&quot;";
        case "'": return "&#39;";
        default: return char;
      }
    });
  }

  function escapeAttribute(value) {
    return value.replace(/["']/g, (char) => (char === '"' ? "&quot;" : "&#39;"));
  }

  return {
    buildLinkPayload,
    detectJiraIssueKey,
    normalizeJiraTitle,
    escapeHtml,
    escapeAttribute,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    createCopyLinkHelpers,
  };
}
