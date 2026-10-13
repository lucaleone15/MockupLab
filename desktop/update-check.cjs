// macOS update check without electron-updater: the app is not signed, so it can only
// tell the user and open the download page. GitHub's "latest release" is enough for that.
const LATEST = 'https://api.github.com/repos/lucaleone15/MockupLab/releases/latest';

const parts = (v) => String(v).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);

/** True when version `a` is newer than `b` (x.y.z, an optional leading "v"). */
function isNewer(a, b) {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
}

/** The latest published version if it is newer than `current`, else null. */
async function newerRelease(current, fetchImpl = fetch) {
  const res = await fetchImpl(LATEST, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) return null;
  const { tag_name: tag, html_url: url } = await res.json();
  return tag && isNewer(tag, current) ? { version: tag.replace(/^v/, ''), url } : null;
}

module.exports = { isNewer, newerRelease };
