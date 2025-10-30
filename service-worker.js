chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id || !tab.url) {
    console.error("No active tab to copy.");
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: copyLinkToClipboard,
      args: [tab.title ?? tab.url, tab.url],
      world: "MAIN",
    });
  } catch (error) {
    console.error("Failed to write to clipboard", error);
  }
});

async function copyLinkToClipboard(title, url) {
  if (!url) {
    throw new Error("Tab URL is missing.");
  }

  const safeTitle = (title || url).trim();
  const { html, text } = buildLinkPayload(safeTitle, url);

  if (navigator.clipboard && "write" in navigator.clipboard && window.ClipboardItem) {
    const htmlBlob = new Blob([html], { type: "text/html" });
    const textBlob = new Blob([text], { type: "text/plain" });
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": htmlBlob,
        "text/plain": textBlob,
      }),
    ]);
  } else if (navigator.clipboard && "writeText" in navigator.clipboard) {
    await navigator.clipboard.writeText(text);
  } else {
    throw new Error("Clipboard API is unavailable in this page.");
  }

  function buildLinkPayload(currentTitle, currentUrl) {
    const issueKey = detectJiraIssueKey(currentUrl, currentTitle);

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
  function detectJiraIssueKey(currentUrl, currentTitle) {
    const KEY_RE = /\b([A-Z]{2,10}-\d{1,6})\b/;
    let parsed;
    try {
      parsed = new URL(currentUrl);
    } catch {
      parsed = null;
    }

    if (parsed) {
      const host = parsed.hostname.toLowerCase();
      const hostLooksLikeJira =
        /(^|\.)jira\./i.test(host) ||
        host.endsWith(".atlassian.net") ||
        host === "atlassian.net";

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

    if (currentTitle) {
      const titleMatch = currentTitle.toUpperCase().match(KEY_RE);
      if (titleMatch) return titleMatch[1];
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
}
