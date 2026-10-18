# AddressRail AI — UK/EU and cross-border payment coverage matrix

**Updated:** 15 October 2026 · **Catalogue:** 43 synthetic educational contexts

This matrix inventories the **current browser lab**, not official payment membership, bank connectivity, certification, payment execution, scheme rulebook compliance or a complete listing of every national payment system. Categories must remain distinct: **payment schemes**, **payment systems/clearing**, **central-bank settlement infrastructure**, **messaging networks/profiles**, **tracking/confirmation overlays** and **other services**. Some catalogue labels describe systems rather than independent schemes.

## Currency behaviour

| Context | Sample currency policy | Interpretation |
| --- | --- | --- |
| UK rail or service | **GBP** | Illustrative sterling processing; not universal participant eligibility |
| EPC schemes and euro-area / SEPA contexts | **EUR** | Euro payment example; not an assertion that all national payments are in euro |
| Swedish national contexts (RIX-INST, RIX-RTGS, Swish) | **SEK** | Local Swedish-krona teaching example |
| Polish national contexts (Elixir, Express Elixir) | **PLN** | Local złoty teaching example |
| Danish national contexts (retail clearing, TIPS-DKK) | **DKK** | Local krone teaching example |
| SWIFT global services and CLS FX teaching | **EUR, GBP, SEK, PLN, DKK** | Choose a *single fictional transaction currency*; does **not** imply an FX conversion, CLS currency eligibility for any specific account, or live SWIFT access |

> The TIPS platform supports euro, Swedish-krona and Danish-krona settlement contexts. The catalogue models these **separately** (TIPS/EUR, RIX-INST/SEK and Denmark/TIPS-DKK), not as a functioning cross-currency two-leg transaction. The ECB's June 2026 cross-currency activation does not imply every PSP participates or that this lab simulates its settlement. See ECB announcement (10 June 2026) and Danmarks Nationalbank.

## Complete catalogue

| # | Context | Identifier | Classification (not interchangeable) | Demo currencies | Illustrative messages/events | Reference |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | SWIFT CBPR+ (International SWIFT & messaging) | `cbpr` | messaging standard/profile | EUR, GBP, SEK, PLN, DKK | pacs.008 / pacs.009 CORE+COV / pacs.002 / pacs.004 / camt.056 | Operator/background |
| 2 | SWIFT gpi Tracker (International SWIFT & messaging) | `gpi` | tracking overlay | EUR, GBP, SEK, PLN, DKK | UETR / payment tracker status | Operator/background |
| 3 | SWIFT gpi for Corporates (g4C) (International SWIFT & messaging) | `g4c` | corporate overlay | EUR, GBP, SEK, PLN, DKK | Pay and trace / inbound tracking | Operator/background |
| 4 | SWIFT FIN MT (legacy learning) (International SWIFT & messaging) | `swift-fin` | messaging network | EUR, GBP, SEK, PLN, DKK | MT103 / MT202(COV) / MT199 | Operator/background |
| 5 | SWIFT Go (International SWIFT & messaging) | `swift-go` | cross-border service | EUR, GBP, SEK, PLN, DKK | Payment initiation / tracking | Operator/background |
| 6 | SWIFT FileAct (International SWIFT & messaging) | `swift-fileact` | file-transfer network | EUR, GBP, SEK, PLN, DKK | File transfer / acknowledgements | Operator/background |
| 7 | CHAPS (United Kingdom) | `chaps` | payment system | GBP | pacs.008 / pacs.009 / pacs.002 | Operator/background |
| 8 | Bank of England RTGS (United Kingdom) | `boe-rtgs` | settlement infrastructure | GBP | Settlement/liquidity events | Operator/background |
| 9 | Faster Payments Service (FPS) (United Kingdom) | `fps` | retail payment system | GBP | Faster Payments retail messages | Operator/background |
| 10 | Bacs Direct Credit (United Kingdom) | `bacs-credit` | retail credit scheme | GBP | Standard 18 / submission reports | Operator/background |
| 11 | Bacs Direct Debit (United Kingdom) | `bacs-debit` | retail direct debit scheme | GBP | Mandate / collection / returns | Operator/background |
| 12 | Image Clearing System (ICS) (United Kingdom) | `ics` | cheque clearing system | GBP | Cheque image / clearing returns | Operator/background |
| 13 | Confirmation of Payee (CoP) (United Kingdom) | `cop` | name-check overlay | GBP | Payee matching response | Operator/background |
| 14 | LINK ATM network (United Kingdom) | `link` | ATM payment system | GBP | ATM transaction / network settlement | Operator/background |
| 15 | PEXA / UK property payments (United Kingdom) | `pexa` | property settlement service | GBP | Property settlement instruction | Operator/background |
| 16 | SEPA Credit Transfer (SCT) (SEPA / Eurosystem) | `sct` | EPC payment scheme | EUR | pain.001 / pacs.008 / pacs.002 | Operator/background |
| 17 | SEPA Instant Credit Transfer (SCT Inst) (SEPA / Eurosystem) | `sct-inst` | EPC payment scheme | EUR | pacs.008 / pacs.002 | Operator/background |
| 18 | SEPA Direct Debit Core (SEPA / Eurosystem) | `sdd-core` | EPC direct-debit scheme | EUR | pain.008 / pacs.003 / pacs.002 | Operator/background |
| 19 | SEPA Direct Debit B2B (SEPA / Eurosystem) | `sdd-b2b` | EPC direct-debit scheme | EUR | pain.008 / pacs.003 / pacs.002 | Operator/background |
| 20 | One-Leg Out Instant Credit Transfer (OCT Inst) (SEPA / Eurosystem) | `oct-inst` | EPC payment scheme | EUR | pacs.008 / pacs.002 | Operator/background |
| 21 | Verification of Payee (VoP) (SEPA / Eurosystem) | `vop` | payee-check scheme | EUR | Payee verification result | Operator/background |
| 22 | SEPA Request-to-Pay (SRTP) (SEPA / Eurosystem) | `srtp` | request overlay | EUR | Request / response | Operator/background |
| 23 | STEP2 SCT (SEPA / Eurosystem) | `step2` | clearing/settlement mechanism | EUR | pacs.008 / pacs.002 | Operator/background |
| 24 | STEP2 SDD (SEPA / Eurosystem) | `step2-sdd` | clearing/settlement mechanism | EUR | pacs.003 / pacs.002 | Operator/background |
| 25 | RT1 (SEPA / Eurosystem) | `rt1` | instant payment infrastructure | EUR | pacs.008 / pacs.002 | Operator/background |
| 26 | TARGET Instant Payment Settlement (TIPS) (SEPA / Eurosystem) | `tips` | central-bank settlement infrastructure | EUR | pacs.008 / pacs.002 | Operator/background |
| 27 | T2 (Eurosystem RTGS) (SEPA / Eurosystem) | `t2` | central-bank RTGS infrastructure | EUR | pacs.008 / pacs.009 / camt.* | Operator/background |
| 28 | TARGET2-Securities (T2S) (SEPA / Eurosystem) | `t2s` | securities settlement infrastructure | EUR | securities cash settlement events | Operator/background |
| 29 | EURO1 (SEPA / Eurosystem) | `euro1` | large-value payment system | EUR | Large-value payment events | Operator/background |
| 30 | STET / French clearing (Selected national European contexts) | `fr-stet` | national processing context | EUR | French SEPA payment processing | Operator/background |
| 31 | SNCE / Spain (Selected national European contexts) | `es-snce` | national clearing context | EUR | Spanish SEPA clearing concepts | Operator/background |
| 32 | BI-COMP / Italy (Selected national European contexts) | `it-bicomp` | national clearing context | EUR | Italian retail payments processing | Operator/background |
| 33 | Equens / Netherlands (Selected national European contexts) | `nl-csm` | national clearing context | EUR | Dutch SEPA processing | Operator/background |
| 34 | CENTROlink / Lithuania (Selected national European contexts) | `lt-centrolink` | national clearing context | EUR | SEPA routing and settlement services | Operator/background |
| 35 | RPS SEPA-Clearer / Germany (Selected national European contexts) | `de-sepa-clearer` | national clearing infrastructure | EUR | SCT / SDD SEPA processing | Operator/background |
| 36 | RIX-INST / Sweden (Selected national European contexts) | `se-rix-inst` | central-bank instant settlement infrastructure | SEK | NCT Inst / instant settlement events | Operator/background |
| 37 | RIX-RTGS / Sweden (Selected national European contexts) | `se-rix-rtgs` | central-bank RTGS infrastructure | SEK | Swedish high-value settlement events | Operator/background |
| 38 | Swish / Sweden (Selected national European contexts) | `se-swish` | instant payment initiation overlay | SEK | Mobile instant payment / status | Operator/background |
| 39 | Elixir / Poland (Selected national European contexts) | `pl-elixir` | national retail clearing system | PLN | PLN clearing / credit or debit events | Operator/background |
| 40 | Express Elixir / Poland (Selected national European contexts) | `pl-express-elixir` | national instant clearing system | PLN | PLN instant transfer / status | Operator/background |
| 41 | Retail clearing / Denmark (Selected national European contexts) | `dk-retail-clearing` | national retail clearing systems | DKK | Danish account transfers / direct debit / clearing | Operator/background |
| 42 | TIPS instant settlement / Denmark (Selected national European contexts) | `dk-tips` | central-bank instant settlement infrastructure | DKK | Danish-krona instant settlement events | Operator/background |
| 43 | CLS FX settlement (GBP/EUR legs) (Cross-border FX settlement) | `cls` | FX settlement infrastructure | EUR, GBP, SEK, PLN, DKK | FX PvP / funding events | Operator/background |

## Capability across all 43 contexts

Each item can generate a labelled, synthetic fixture and an educational rule assessment with fictional evidence references. The **shared small subset of checks** covers basic amount/currency policy, reference completeness, selectively applicable IBAN mod-97/BIC syntax, SWIFT-style UETR syntax for relevant tracking contexts, address structure where modeled, selected debit-mandate examples and consistency between a fictional status and final event. A fault that is not applicable is labelled as such. A generated `SIMULATED` outcome is **not** actual credit, acceptance or settlement.

All contexts support synthetic JSON report export, and the report can be handed explicitly to the same-tab guest case workspace via `sessionStorage`. Each visitor's data remains client-side; exporting saves a file to that visitor's device. There is no public backend used by the lab, no credential, shared API key or Keycloak requirement and no actual scheme connection.

The message explorer generates **intentionally incomplete** ISO 20022 shapes for selected `pacs`, `pain` and `camt` families, a historical MT103 sketch and conceptual JSON where appropriate. Context coverage does **not** mean a parser or full message schema exists for all 43 systems. SWIFT gpi and g4C examples provide fictional tracker-style status, **not** live UETR results. Address-town copying is limited to unambiguous original synthetic address text with an explicit click; no inferred town is inserted automatically.

## Important limitations

- No official SWIFT/CBPR+, EPC, ISO 20022, CHAPS, Pay.UK, Eurosystem/T2/TIPS, EBA CLEARING, CLS or national-operator certification, XSD/MIG conformance, participant directory lookup or scheme release regression pack.
- No live SWIFT API, sanctions screening, bank account verification, payment initiation, clearing, message delivery, settlement proof, exchange-rate calculation or FX liquidity modeling.
- No centrally authenticated or immutable case audit record. A copied/duplicated browser tab can inherit a snapshot of session storage on some browsers, and browser-private data disappears when its session is ended. Avoid real customer data.
- National entries are **selected examples**, not an exhaustive list of European domestic payment systems. Participation, timing, proprietary formats and standards can change and require independent operator verification.

**Public routes:** Cross-Rail Intelligence Lab · Banking Studio · Guest Case Management.

**Source of truth for catalogue identifiers:** `web/studio/payment-intelligence/catalog.mjs`. This matrix reflects those 43 entries at the date above.
