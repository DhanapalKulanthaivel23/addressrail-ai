# AddressRail AI

A public, independent **payment-address quality demo** for synthetic ISO 20022 `pacs.008` and MT103 messages.

## Try AddressRail AI online

**[Launch the free AddressRail AI demo](https://dhanapalkulanthaivel23.github.io/addressrail-ai/)**

No registration, GitHub account or installation is required. Load a synthetic MT103 or ISO 20022 pacs.008 example, inspect address-quality findings and download a JSON report. Use only synthetic or fully anonymised test data.

Developers who want to host their own instance can follow the [deployment guide](docs/DEPLOY.md).

### What it does
- Load synthetic `pacs.008` or MT103 payment examples, or paste/upload a test message
- Find missing structured town/country fields
- Suggest conservative review-only repairs when the original text explicitly contains a comma-separated town and ISO country code
- Export a JSON report without sending data to a server
- Optionally request Gemini commentary through a separately hosted, secured backend

**Not a production system:** This is not an official Swift, ISO 20022, EPC or CBPR+ validator. MT parsing is intentionally heuristic. The demo does not transmit payments, perform sanctions screening or approve repairs.

## Running the demo locally

Open `web/index.html` with a browser. It loads `web/app.js`. No Python or API key is needed for local checks.
