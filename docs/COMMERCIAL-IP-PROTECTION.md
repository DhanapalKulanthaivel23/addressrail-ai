# Commercial source protection and public-demo separation

**Status as of 18 October 2026: partial separation. This repository is still PUBLIC; `DhanapalKulanthaivel23/addressrail-network-core` is PRIVATE.**
Do not interpret this document as private-repository migration or deletion of any published source.

## Immediate owner action

1. Keep the existing `addressrail-network-core` repository private. Confirm visibility and access controls before adding any private implementation.
2. Review the existing private core and its integration with the public SaaS through the authenticated API boundary. Preserve current functionality, branches, tags and CI; do not copy private source into the public repository.
3. Review full history for accidentally committed credentials, test data or proprietary third-party code. Revoke/rotate any exposed credentials. Removing a file in a later commit does not remove its older public revisions or existing clones.
4. Review contributor, AI-generated and employer-assignment rights, dependency licences, trademarks and third-party scheme specifications with qualified counsel before claiming exclusive ownership of all content.
5. Any further source separation requires its own compatibility review. Preserve the existing public URLs, Pages site, Payment Studio, Academy, first-party links and working APIs; do not delete source as part of this documentation change. **Do not use a shallow deletion as proof that old source is no longer publicly available.** Where appropriate, create a new clean public demo repository without copying sensitive Git history and then archive the old repo after links and user access are reviewed.
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

The private network core exists, while the public repository still contains its existing demo and SaaS code and history. Separation is partial. No software source, first-party link or public URL is deleted by this change.
