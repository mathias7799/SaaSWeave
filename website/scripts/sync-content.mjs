// Mirrors repo-owned Markdown (the .agents development guides, the agent
// skills, and a couple of operational runbooks) into the VitePress site at
// build time. The originals stay the single source of truth; the generated
// copies are git-ignored and regenerated on every dev/build run.
//
// Relative links are rewritten so they resolve on the site:
//   - a link to another mirrored doc  -> its site route
//   - a link to anything else in repo -> an absolute github.com URL

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const websiteDir = resolve(fileURLToPath(new URL('..', import.meta.url)))
const repoRoot = resolve(websiteDir, '..')
const REPO = 'mathias7799/SaaSWeave'
const BRANCH = 'main'

/** @type {{src: string, dest: string, stripFrontmatter?: boolean}[]} */
const manifest = [
  // .agents development guides
  ['.agents/workflow.md', 'develop/workflow.md'],
  ['.agents/vite-plus.md', 'develop/vite-plus.md'],
  ['.agents/typescript.md', 'develop/typescript.md'],
  ['.agents/testing.md', 'develop/testing.md'],
  ['.agents/core.md', 'develop/core.md'],
  ['.agents/environment-variables.md', 'develop/environment-variables.md'],
  ['.agents/auth.md', 'develop/auth.md'],
  ['.agents/orpc.md', 'develop/orpc.md'],
  ['.agents/api-fetching-patterns.md', 'develop/api-fetching-patterns.md'],
  ['.agents/logging.md', 'develop/logging.md'],
  ['.agents/media-storage.md', 'develop/media-storage.md'],
  ['.agents/end-to-end-features.md', 'develop/end-to-end-features.md'],
  ['.agents/tanstack-patterns.md', 'develop/tanstack-patterns.md'],
  ['.agents/zustand.md', 'develop/zustand.md'],
  ['.agents/ui.md', 'develop/ui.md'],
  ['.agents/i18n.md', 'develop/i18n.md'],
  ['.agents/seo.md', 'develop/seo.md'],
  // Reference docs behind the agent skills. The SKILL.md wrappers themselves
  // are agent-activation scaffolding and are intentionally not mirrored.
  ['.agents/skills/feature-plan/references/feature-building.md', 'develop/skills/feature-building.md'],
  ['.agents/skills/redis-workers-cache/references/redis-cache-jobs.md', 'develop/skills/redis-cache-jobs.md'],
  // operational runbooks
  ['docs/LOCAL-STACK.md', 'guide/local-stack.md'],
  ['docs/SSO-TESTING.md', 'guide/sso-testing.md'],
  // runnable app READMEs
  ['apps/web/README.md', 'reference/apps/web.md'],
  ['apps/server/README.md', 'reference/apps/server.md'],
  ['apps/worker/README.md', 'reference/apps/worker.md'],
  // shared package READMEs
  ['packages/core/README.md', 'reference/packages/core.md'],
  ['packages/env/README.md', 'reference/packages/env.md'],
  ['packages/db/README.md', 'reference/packages/db.md'],
  ['packages/app/README.md', 'reference/packages/app.md'],
  ['packages/jobs/README.md', 'reference/packages/jobs.md'],
  ['packages/auth/README.md', 'reference/packages/auth.md'],
  ['packages/api/README.md', 'reference/packages/api.md'],
  ['packages/cache/README.md', 'reference/packages/cache.md'],
  ['packages/logger/README.md', 'reference/packages/logger.md'],
  ['packages/observability/README.md', 'reference/packages/observability.md'],
  ['packages/mailer/README.md', 'reference/packages/mailer.md'],
  ['packages/i18n/README.md', 'reference/packages/i18n.md'],
  ['packages/ui/README.md', 'reference/packages/ui.md'],
  ['packages/seo/README.md', 'reference/packages/seo.md'],
].map(([src, dest, stripFrontmatter]) => ({ src, dest, stripFrontmatter }))

// Map absolute source path -> site route, so cross-references between mirrored
// docs point at the site rather than github.
const routeOf = new Map()
for (const { src, dest } of manifest) {
  const route = '/' + dest.replace(/\.md$/, '')
  routeOf.set(resolve(repoRoot, src), route)
}

function githubUrl(absPath) {
  const rel = relative(repoRoot, absPath).split('\\').join('/')
  const kind = existsSync(absPath) && statSync(absPath).isDirectory() ? 'tree' : 'blob'
  return `https://github.com/${REPO}/${kind}/${BRANCH}/${rel}`
}

const LINK_RE = /(!?\[[^\]]*\])\(([^)\s]+)(\s+"[^"]*")?\)/g

function rewriteLinks(content, srcAbs) {
  const srcDir = dirname(srcAbs)
  return content.replace(LINK_RE, (whole, text, target, title = '') => {
    if (/^(https?:|mailto:|tel:|#|\/)/.test(target)) return whole
    const hashIndex = target.indexOf('#')
    const path = hashIndex === -1 ? target : target.slice(0, hashIndex)
    const anchor = hashIndex === -1 ? '' : target.slice(hashIndex)
    if (path === '') return whole
    const resolved = resolve(srcDir, path)
    const next = routeOf.has(resolved) ? routeOf.get(resolved) + anchor : githubUrl(resolved) + anchor
    return `${text}(${next}${title})`
  })
}

function stripYamlFrontmatter(content) {
  if (!content.startsWith('---')) return content
  const end = content.indexOf('\n---', 3)
  if (end === -1) return content
  const after = content.indexOf('\n', end + 1)
  return content.slice(after + 1).replace(/^\s+/, '')
}

// Remove previously generated output so dropped/renamed sources do not leave
// stale pages behind. We own everything under develop/ except the authored
// index.md, the generated reference/apps and reference/packages dirs, and the
// two mirrored guide runbooks.
const developDir = join(websiteDir, 'develop')
if (existsSync(developDir)) {
  for (const entry of readdirSync(developDir)) {
    if (entry === 'index.md') continue
    rmSync(join(developDir, entry), { recursive: true, force: true })
  }
}
for (const staleDir of ['reference/apps', 'reference/packages']) {
  rmSync(join(websiteDir, staleDir), { recursive: true, force: true })
}
for (const stale of ['guide/local-stack.md', 'guide/sso-testing.md']) {
  rmSync(join(websiteDir, stale), { force: true })
}

let written = 0
for (const { src, dest, stripFrontmatter } of manifest) {
  const srcAbs = resolve(repoRoot, src)
  if (!existsSync(srcAbs)) {
    console.warn(`[sync-content] skipped missing source: ${src}`)
    continue
  }
  let body = readFileSync(srcAbs, 'utf8')
  if (stripFrontmatter) body = stripYamlFrontmatter(body)
  body = rewriteLinks(body, srcAbs)

  const banner =
    `> [!TIP]\n` +
    `> This page mirrors [\`${src}\`](${githubUrl(srcAbs)}) from the repository. ` +
    `Edit it at the source, not here.\n\n`

  const frontmatter = `---\neditLink: false\n---\n\n`
  const out = frontmatter + banner + body

  const destAbs = join(websiteDir, dest)
  mkdirSync(dirname(destAbs), { recursive: true })
  writeFileSync(destAbs, out, 'utf8')
  written += 1
}

// Clean stale output only under the generated roots we own.
console.log(`[sync-content] wrote ${written} page(s) into website/develop and website/guide`)
