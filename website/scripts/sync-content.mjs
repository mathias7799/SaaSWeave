// Mirrors repo-owned Markdown (the .agents development guides, the agent
// skills, and a couple of operational runbooks) into the VitePress site at
// build time. The originals stay the single source of truth; the generated
// copies are git-ignored and regenerated on every dev/build run.
//
// Relative links are rewritten so they resolve on the site:
//   - a link to another mirrored doc  -> its site route
//   - a link to anything else in repo -> an absolute github.com URL

import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
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
  ['.agents/choice-flows.md', 'develop/choice-flows.md'],
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
  // agent skills (strip the YAML frontmatter; the body has its own heading)
  ['.agents/skills/feature-plan/SKILL.md', 'develop/skills/feature-plan.md', true],
  ['.agents/skills/redis-workers-cache/SKILL.md', 'develop/skills/redis-workers-cache.md', true],
  // operational runbooks
  ['docs/LOCAL-STACK.md', 'guide/local-stack.md'],
  ['docs/SSO-TESTING.md', 'guide/sso-testing.md'],
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
