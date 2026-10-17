# Commercial source protection and public-demo separation

**Status: planning and owner action required. This repository is still PUBLIC.**
Do not interpret this document as private-repository migration or deletion of any published source.

## Immediate owner action

1. In GitHub, create a **private** repository named `addressrail-ai-core` under your account. Ensure visibility reads **Private** before transferring anything.
2. Make a trusted complete copy of the current source including Git history into that private repository. Confirm branches, tags, access controls, actions/secrets and CI. Do not publish a new repository while copying.
3. Review full history for accidentally committed credentials, test data or proprietary third-party code. Revoke/rotate any exposed credentials. Removing a file in a later commit does not remove its older public revisions or existing clones.
4. Review contributor, AI-generated and employer-assignment rights, dependency licences, trademarks and third-party scheme specifications with qualified counsel before claiming exclusive ownership of all content.
5. After verifying the private copy, configure the existing public repository as a **demo-only** repo: remove proprietary engines from the current tree, keep browser-only synthetic demonstrations, sample API contracts, instructions and legally distributable test fixtures. **Do not use a shallow deletion as proof that old source is no longer publicly available.** Where appropriate, create a new clean public demo repository without copying sensitive Git history and then archive the old repo after links and user access are reviewed.
6. Lock private-core access to named collaborators using minimum GitHub roles; require PR review and CI. Use dedicated service accounts and external secrets rather than storing keys in Git.
7. Reconfigure Pages and workflows so the public demo never bundles private source or calls internal APIs without authentication, tenant authorization and rate limiting.

## Ownership, licensing and confidentiality

No root open-source licence was observed on 17 October 2026. Absence of an explicit licence generally does *not* grant third parties permission to reuse original copyrighted source, although GitHub's platform terms allow normal viewing and forking. This document is **not itself a software licence**, and it does not retroactively revoke permissions or recover copies already publicly downloaded.

Copyright in original source belongs to its actual rightsholder(s), which can depend on employment, contributor and third-party agreements. Product ideas, general banking workflows and technical concepts are not necessarily protected by software copyright.

Treat any proprietary algorithms, private models and commercial configuration as confidential only *after* restricting distribution. Secrets committed in this public repository must be considered compromised and rotated.

## Proposed layout

| Public demo (intentionally distributable) | Private commercial core |
| --- | --- |
| GitHub Pages/browser-only synthetic examples | Scheme-specific proprietary validation/rule libraries |
| Product information, coverage disclaimers | Commercial AI prompts, scoring and orchestration |
| SDK interface examples and mocked responses | Back-end Java/Go/Python services and Kafka internals |
| Safely licensed synthetic fixtures | Tenant-specific deployment and commercial integrations |

The current repository is not yet partitioned according to this plan. No software source has been deleted by this change.
