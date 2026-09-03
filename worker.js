// v2ray-download/src/index.ts
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/") {
      try {
        const release = await fetchRelease(env);
        const asset = findWindowsAsset(release, env.ASSET_PATTERN, env.ASSET_EXCLUDE);
        if (!asset) {
          return html(renderError("No Windows Build", "Could not find a compatible Windows download in the latest release."), 500);
        }
        return html(renderPage(env, release.tag_name, "/download/windows"), 200);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        console.error(`Error loading release: ${msg}`);
        return html(renderError("Unable to Load", msg), 502);
      }
    }
    if (path === "/download/windows") {
      try {
        const release = await fetchRelease(env);
        const asset = findWindowsAsset(release, env.ASSET_PATTERN, env.ASSET_EXCLUDE);
        if (!asset) {
          return new Response("No compatible Windows x64 asset found", { status: 404 });
        }
        const proxyUrl = `https://${env.GITHUB_PROXY}/${asset.browser_download_url}`;
        return Response.redirect(proxyUrl, 302);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        console.error(`Download redirect error: ${msg}`);
        return new Response("Download unavailable: " + msg, { status: 502 });
      }
    }
    if (path === "/api/release") {
      try {
        const release = await fetchRelease(env);
        const asset = findWindowsAsset(release, env.ASSET_PATTERN, env.ASSET_EXCLUDE);
        return Response.json({
          version: release.tag_name,
          asset_name: asset ? asset.name : null,
          original_url: asset ? asset.browser_download_url : null,
          proxy_url: asset ? `https://${env.GITHUB_PROXY}/${asset.browser_download_url}` : null
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        return Response.json({ error: msg }, { status: 500 });
      }
    }
    return html(renderError("404 Not Found", "The page you are looking for does not exist."), 404);
  }
};
var CACHE_TTL = 1800;
var GITHUB_API = "https://api.github.com";
function getGithubApiUrl(owner, repo) {
  return `${GITHUB_API}/repos/${owner}/${repo}/releases/latest`;
}
function findWindowsAsset(release, pattern, exclude) {
  const regex = new RegExp(pattern, "i");
  const excludeRegex = exclude ? new RegExp(exclude, "i") : null;
  for (const asset of release.assets) {
    if (regex.test(asset.name)) {
      if (excludeRegex && excludeRegex.test(asset.name)) continue;
      return asset;
    }
  }
  return null;
}
async function fetchRelease(env) {
  const url = getGithubApiUrl(env.GITHUB_REPO_OWNER, env.GITHUB_REPO_NAME);
  const cacheUrl = new Request(`https://cache.internal/release/${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}`);
  const cache = caches.default;
  try {
    const cached = await cache.match(cacheUrl);
    if (cached) {
      return await cached.json();
    }
  } catch (e) {
    console.error(`Cache read error: ${e}`);
  }
  const resp = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "cloudflare-download-worker/1.0"
    }
  });
  if (!resp.ok) {
    if (resp.status === 403) {
      throw new Error("GitHub API rate limit exceeded. Please try again later.");
    }
    if (resp.status === 404) {
      throw new Error(`Repository ${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME} not found or has no releases.`);
    }
    throw new Error(`GitHub API error: ${resp.status} ${resp.statusText}`);
  }
  const release = await resp.json();
  try {
    const toCache = new Response(JSON.stringify(release), {
      headers: { "Content-Type": "application/json", "Cache-Control": `max-age=${CACHE_TTL}` }
    });
    await cache.put(cacheUrl, toCache.clone());
  } catch (e) {
    console.error(`Cache write error: ${e}`);
  }
  return release;
}
function html(body, status) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html;charset=UTF-8", "Cache-Control": status === 200 ? "public, max-age=300" : "no-store" }
  });
}
function renderPage(env, version, downloadUrl) {
  const accentColor = env.APP_NAME === "v2rayN" ? "#1a73e8" : "#7c3aed";
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${env.APP_NAME} Download</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#f5f7fa;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);padding:48px 40px;max-width:480px;width:100%;text-align:center}
.icon{width:64px;height:64px;margin:0 auto 24px;background:${accentColor};border-radius:16px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:28px;font-weight:700}
h1{font-size:28px;color:#1a1a2e;margin-bottom:8px}
.version{color:#6b7280;font-size:14px;margin-bottom:32px}
.btn{display:inline-block;padding:14px 40px;background:${accentColor};color:#fff;text-decoration:none;border-radius:12px;font-size:16px;font-weight:600;transition:all .2s;border:none;cursor:pointer}
.btn:hover{opacity:.9;transform:translateY(-1px);box-shadow:0 4px 12px ${accentColor}44}
.info{margin-top:28px;padding:16px;background:#f8fafc;border-radius:10px;font-size:13px;color:#6b7280;line-height:1.8}
.divider{margin:24px 0;border:none;border-top:1px solid #e5e7eb}
.alt-link{margin-top:4px}
.alt-link a{color:${accentColor};text-decoration:none;font-size:14px;font-weight:500}
.alt-link a:hover{text-decoration:underline}
footer{margin-top:24px;font-size:12px;color:#9ca3af}
</style>
</head>
<body>
<div class="card">
  <div class="icon">${env.APP_NAME.charAt(0)}</div>
  <h1>${env.APP_NAME}</h1>
  <p class="version">Latest: ${version} | Windows x64</p>
  <a class="btn" href="${downloadUrl}">Download for Windows</a>
  <div class="info">
    <div>Platform: Windows x64</div>
    <div>Source: GitHub Official Release</div>
  </div>
  <hr class="divider">
  <div class="alt-link">
    <a href="${env.OTHER_APP_URL}">Also available: ${env.OTHER_APP_NAME}</a>
  </div>
  <footer>Auto-updated from GitHub Releases</footer>
</div>
</body>
</html>`;
}
function renderError(title, message) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Error</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f5f7fa;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);padding:48px 40px;max-width:480px;width:100%;text-align:center}
h1{font-size:24px;color:#dc2626;margin-bottom:12px}
p{color:#6b7280;font-size:15px;line-height:1.6}
a{color:#1a73e8;text-decoration:none}
a:hover{text-decoration:underline}
</style>
</head>
<body>
<div class="card">
  <h1>${title}</h1>
  <p>${message}</p>
  <p style="margin-top:20px"><a href="/">Back to Home</a></p>
</div>
</body>
</html>`;
}
export {
  index_default as default
};
