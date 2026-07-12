# Security policy

## Reporting a vulnerability

Do not report security vulnerabilities in public issues, discussions, pull requests, or chat.

Use GitHub's private vulnerability reporting for this repository:

1. Open the repository's **Security** tab.
2. Select **Advisories** and **Report a vulnerability**.
3. Include the affected component and revision, prerequisites, reproduction steps or proof of
   concept, impact, and any suggested mitigation.

If private vulnerability reporting is unavailable, contact a repository maintainer privately through
their GitHub profile and request a secure reporting channel. Do not include exploit details in the
initial public-facing message.

We aim to acknowledge complete reports within three business days. Triage and remediation timing
depends on severity, reproducibility, affected releases, and coordination needs. Please allow a
reasonable remediation and disclosure window.

## Supported versions

SaaSWeave is currently developed from `main` and has not declared a long-term support release line.
Security fixes target the latest revision. Maintainers may provide backports after stable versioned
releases exist, but older commits should be treated as unsupported unless a release notice says
otherwise.

## Disclosure

Please coordinate public disclosure with maintainers. A security advisory should credit reporters
who want attribution and document affected versions, impact, fixes, and upgrade guidance. Reports
that require social engineering, destructive testing, privacy violations, or access to data that is
not yours are not acceptable testing methods.

## Deployment responsibility

This repository includes application security controls, but operators remain responsible for TLS,
network policy, secrets, provider credentials, database and object-store access, backups, monitoring,
security updates, and incident response. Review environment templates and
[`docs/PRODUCTION-OPERATIONS.md`](docs/PRODUCTION-OPERATIONS.md) before a public deployment.
