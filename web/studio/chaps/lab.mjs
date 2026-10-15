import {buildChapsExample} from "./core.mjs";
const $=id=>document.getElementById(id);
let xml="";
function build(){
 try {
  const kind=$("message-family").value;
  xml=buildChapsExample(kind,$("amount").value.trim());
  $("xml-output").textContent=xml;
  $("output-title").textContent=kind==="customer"?"pacs.008 customer transfer (teaching sketch)":"pacs.009 CORE FI transfer (teaching sketch)";
  $("status").textContent="Generated a synthetic XML sketch only. No validation or transmission.";
  $("download").disabled=false;
 } catch(error) {
  xml="";$("xml-output").textContent="";$("status").textContent=error.message;
  $("download").disabled=true;
 }
}
$("build").addEventListener("click",build);
$("download").addEventListener("click",()=>{
 if(!xml)return;
 const url=URL.createObjectURL(new Blob([xml],{type:"application/xml"}));
 const link=document.createElement("a");link.href=url;link.download="addressrail-chaps-educational.xml";link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
});
build();
