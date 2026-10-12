# AddressRail AI — free search discoverability

**No paid domain, advertising or SEO service is required.** All pages live on GitHub Pages.

The project includes:
- Unique keyword-relevant titles, descriptions and canonical URLs
- Crawlable HTML links to practical synthetic MT103, pacs.008, CBPR+ and ISO 20022 guides
- Open Graph previews and appropriately scoped structured data
- `web/sitemap.xml` listing the homepage and four guides
- `web/robots.txt` as a deployment template; note the host-root requirement below
- A privacy-minimising optional free visitor counter (see `docs/VISITOR-ANALYTICS.md`)

## Search Console

1. Go to https://search.google.com/search-console
2. Add URL prefix: `https://dhanapalkulanthaivel23.github.io/addressrail-ai/`
3. Choose HTML file verification and put the provided verification HTML in `web/` (do not place it at the repository root).
4. Wait for the next Pages deploy, then verify ownership.
5. Submit sitemap: `https://dhanapalkulanthaivel23.github.io/addressrail-ai/sitemap.xml`
6. Inspect one guide URL to request indexing if eligible; observe impressions and queries over subsequent weeks.

## Bing Webmaster Tools

Use https://www.bing.com/webmasters to add the same GitHub Pages URL. Import the site from Search Console if supported or verify using Bing's alternative HTML file method.

## Legitimate discoverability strategy

- Publish original tutorials and synthetic before/after examples, not keyword stuffing.
- Keep scheme-rule release information current and link to standards providers when making date-specific claims.
- Avoid promising full MT→MX conversion, banking certification, real-time MQ/Kafka integration or automated payment repair—these are not implemented.
- Share relevant articles through GitHub, professional networks and appropriate technical communities without mass posting.
- AI-driven search engines may crawl and cite open articles, but there is no guaranteed way to appear as a suggested product or on top of a result set.

## GitHub Pages robots.txt location

Google reads robots.txt only at the host root, `https://dhanapalkulanthaivel23.github.io/robots.txt`. This repository publishes under `/addressrail-ai/`, so its `/addressrail-ai/robots.txt` is not a host-wide crawler control file. Do not claim that file submits the sitemap. Submit the sitemap directly through the verified URL-prefix property in Search Console/Bing. If a user-site repository later serves the host root, a suitable root robots.txt can reference this sitemap; do not modify an unrelated repository for this task.

Source: https://developers.google.com/crawling/docs/robots-txt/create-robots-txt

Verification status on 12 October 2026: account sign-in and ownership verification pending. No sitemap submission confirmed yet.
