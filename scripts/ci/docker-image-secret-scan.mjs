#!/usr/bin/env node
/**
 * Scan a built Docker image history/config for secret-like strings.
 * Usage: node scripts/ci/docker-image-secret-scan.mjs <image-ref>
 */
import { execSync } from "node:child_process";

const image = process.argv[2];
if (!image) {
  console.error("Usage: node scripts/ci/docker-image-secret-scan.mjs <image-ref>");
  process.exit(1);
}

const patterns = [
  /BETTER_AUTH_SECRET=[^ \n]+/i,
  /DATABASE_URL=postgres(ql)?:\/\/[^:]+:[^@]+@/i,
  /STRIPE_SECRET_KEY=sk_(live|test)_[a-zA-Z0-9]+/i,
  /STRIPE_WEBHOOK_SECRET=whsec_[a-zA-Z0-9]+/i,
  /MINIO_SECRET_ACCESS_KEY=(?!minioadmin|changeme|replace)[a-zA-Z0-9+/=]{8,}/i,
  /RESEND_API_KEY=re_[a-zA-Z0-9]+/i,
  /GOOGLE_CLIENT_SECRET=[a-zA-Z0-9_-]{10,}/i,
  /GITHUB_CLIENT_SECRET=[a-zA-Z0-9_]{10,}/i
];

const history = execSync(`docker history --no-trunc --format '{{.CreatedBy}}' ${image}`, {
  encoding: "utf8"
});
const inspect = execSync(`docker image inspect ${image} --format '{{json .Config.Env}}'`, {
  encoding: "utf8"
});
const blob = `${history}\n${inspect}`;
const hits = [];

for (const pattern of patterns) {
  const match = blob.match(pattern);
  if (match) hits.push(`${pattern}: ${match[0].slice(0, 80)}`);
}

if (hits.length > 0) {
  console.error(`Secret scan failed for ${image}:`);
  for (const h of hits) console.error(`  - ${h}`);
  process.exit(1);
}

console.log(`Secret scan passed for ${image}.`);
