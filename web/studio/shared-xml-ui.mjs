import {validateSyntheticXML,XML_EXAMPLES} from "./shared-xml-review.mjs";
const root=document.querySelector("[data-xml-review]");
if(root){
 const rail=root.dataset.xmlReview,editor=root.querySelector("textarea"),issues=root.querySelector("[data-xml-findings]");
 const label=root.querySelector("[data-xml-result]"),button=root.querySelector("[data-xml-run]");
 const add=(tag,value)=>{const n=document.createElement(tag);n.textContent=String(value);return n};
 root.querySelector("[data-xml-sample]").addEventListener("click",()=>{editor.value=XML_EXAMPLES[rail];label.textContent="Synthetic XML sample loaded. Run the subset checks to inspect it."});
 button.addEventListener("click",()=>{
  issues.replaceChildren();
  let report;try{report=validateSyntheticXML(editor.value,rail)}catch(error){label.textContent="Could not check XML: "+error.message;return}
  label.textContent=report.length?
   report.length+" basic rule finding(s). This is NOT an ISO XSD or scheme conformance result.":
   "No basic subset rule findings. This does not prove that the XML is scheme-compliant, safe or a real payment.";
  for(const finding of report){
   const p=add("p",finding.id+" · "+finding.path+" · "+finding.explanation);issues.append(p);
  }
 });
}
