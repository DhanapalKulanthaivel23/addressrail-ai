/** Public AI use-case map — possibilities, not production deployment approvals. */
export const USE_CASES=Object.freeze([
 ["UC01","CBPR+","Exception triage","Status + UETR + rejection reason","Medium","Operator confirms before resubmission","Minutes-to-triage","journeys/?rail=cbpr&mode=ai","Scripted"],
 ["UC02","SCT Inst","Unknown-outcome explanation","pacs.002 outcome and timing evidence","High","No automatic retry; PSP reconciliation","Unsupported status claims","sct-inst/?scenario=timeout","Scripted"],
 ["UC03","CHAPS","Liquidity-hold summary","RTGS queue and permitted participant event logs","High","Settlement operations approval","Avoid false finality","chaps/?scenario=liquidity-hold","Scripted"],
 ["UC04","SCT","IBAN validation explanation","Deterministic check digits and transaction fields","Low","PSP validates at source","Field-error detection","sepa-sct/","Demo"],
 ["UC05","Bacs DD","Mandate exception narrative","Mandate references and authorisation events","High","Mandate holder/customer verifies rights","False mandate claims","journeys/?rail=bacs-debit&mode=ai","Scripted"],
 ["UC06","FPS","Duplicate-risk correlation","Payment references, previous status and authorised responses","High","Human approval before resubmission","Duplicate-risk flags","journeys/?rail=fps&mode=ai","Scripted"],
 ["UC07","CBPR+","Postal address repair suggestions","Original customer address and rule release","Medium","No invented address; review at source","Evidence-grounded repairs","../","Demo"],
 ["UC08","CHAPS","Incident summarisation","Observability logs and change timeline","Medium","Incident commander reviews narrative","Time-to-understand","chaps/","Planned"],
 ["UC09","SEPA","Rulebook retrieval / grounded Q&A","Versioned EPC rulebooks and source passages","Medium","Expert verifies current source/version","Citation coverage","payment-intelligence/","Planned"],
 ["UC10","Cross-rail","Operational audit summary","Immutable event references and human decisions","High","Authorised reviewer signs off","Evidence-reference accuracy","open-demo/","Scripted"],
 ["UC11","AI Lab","Hallucination guardrail","Claim, rule IDs, synthetic evidence","Medium","Rule owner signs off model-release gate","Unsafe-claim rejection rate","ai-lab/","Demo"],
 ["UC12","UK/EU","Learning explanations","Synthetic demo inputs and glossary","Low","User checks against operator source","Quiz improvement","start/","Demo"]
].map(([id,rail,task,data,risk,human,metric,link,status])=>Object.freeze({id,rail,task,data,risk,human,metric,link,status})));
export const filterUseCases=(risk="All")=>USE_CASES.filter(x=>risk==="All"||x.risk===risk);
