(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MinigoPublishPolicy = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const repo = "Map5233/minigo-stationery";
  const owner = Object.freeze({ login: "Map5233", id: 188739291 });
  const marker = /<!-- minigo-publish-request:v1 (\{[^\r\n]*\}) -->/g;
  function validPost(post) {
    return !!post && Number.isSafeInteger(post.pr) && post.pr > 0 &&
      /^[a-f0-9]{40}$/.test(post.sha || "") &&
      /^[a-z][a-z0-9-]*\.html$/.test(post.url || "") &&
      !["index.html", "admin.html", "post.html"].includes(post.url) &&
      typeof post.title === "string" && post.title.length > 0;
  }
  function pullState(post, pull) {
    if (!validPost(post) || !pull || pull.number !== post.pr ||
      pull.base?.repo?.full_name !== repo || pull.head?.repo?.full_name !== repo ||
      pull.base?.ref !== "main") return "invalid";
    if (pull.merged_at || pull.merged) return "merged";
    if (pull.state !== "open") return "closed";
    if (pull.draft) return "draft";
    return pull.head.sha === post.sha ? "ready" : "stale";
  }
  function requestBody(post, intent = "request") {
    if (!validPost(post) || !["request", "test"].includes(intent)) throw new Error("Invalid story");
    return "미니고 글 발행 요청\n\n글: " + post.title +
      "\n검토 PR: https://github.com/" + repo + "/pull/" + post.pr +
      "\n확인한 버전: " + post.sha +
      "\n\n이 글의 위 버전을 확인하고 발행을 요청합니다. 요청 저장만으로 즉시 발행되지는 않습니다." +
      "\n취소하려면 이 요청을 Close issue로 닫아 주세요. 내용을 바꿀 때는 기존 요청을 닫고 다시 제출해 주세요." +
      "\n요청과 글 정보는 공개 저장소에 기록됩니다. 비밀번호·개인정보는 적지 마세요." +
      "\n\n<!-- minigo-publish-request:v1 " + JSON.stringify({ repo, pr: post.pr, sha: post.sha, url: post.url, intent }) + " -->";
  }
  function issueURL(post) {
    const u = new URL("https://github.com/" + repo + "/issues/new");
    u.searchParams.set("title", "[발행 요청] " + post.title);
    u.searchParams.set("body", requestBody(post));
    return u.href;
  }
  function parseIssue(issue) {
    if (!issue || issue.pull_request || issue.user?.id !== owner.id ||
      issue.user?.login?.toLowerCase() !== owner.login.toLowerCase() ||
      issue.user?.type !== "User" || !Number.isSafeInteger(issue.number) ||
      issue.repository_url !== "https://api.github.com/repos/" + repo ||
      !issue.created_at || issue.created_at !== issue.updated_at) return null;
    const matches = [...String(issue.body || "").matchAll(marker)];
    if (matches.length !== 1) return null;
    try {
      const record = JSON.parse(matches[0][1]);
      if (record.repo !== repo || record.intent !== "request") return null;
      return record;
    } catch (_) { return null; }
  }
  function matchingRequest(issue, post, pull) {
    const record = parseIssue(issue);
    return issue?.state === "open" && pullState(post, pull) === "ready" && !!record &&
      record.pr === post.pr && record.sha === post.sha && record.url === post.url;
  }
  function storedRequest(issues, post, pull) {
    return issues.filter(i => matchingRequest(i, post, pull)).sort((a,b) => a.number - b.number)[0] || null;
  }
  function requestKey(post) { return repo + ":" + post.pr + ":" + post.sha; }
  return Object.freeze({ repo, owner, validPost, pullState, requestBody, issueURL, parseIssue, matchingRequest, storedRequest, requestKey });
});
