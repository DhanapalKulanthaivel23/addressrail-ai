import {getCard,gradeCard} from "./rail-card.mjs";
const id=document.querySelector("[data-rail-card]")?.dataset.railCard;
if(id){
 const card=getCard(id),el=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=String(text);return x};
 const root=document.querySelector("[data-rail-card]");
 const title=root.querySelector(".ar-card-title");title.textContent=card.title;
 const actors=root.querySelector(".ar-card-actors");actors.replaceChildren();
 card.actors.forEach((p,i)=>{actors.append(el("span",p));if(i<card.actors.length-1)actors.append(el("b","→"))});
 const success=root.querySelector(".ar-card-success"),failure=root.querySelector(".ar-card-failure");
 for(const item of card.messageSuccess)success.append(el("li",item));
 for(const item of card.messageFailure)failure.append(el("li",item));
 root.querySelector(".ar-card-settlement").textContent=card.settlement;
 const ai=root.querySelector(".ar-card-ai");for(const item of card.ai)ai.append(el("li",item));
 root.querySelector(".ar-card-caution").textContent=card.caution;
 root.querySelector(".ar-card-lab").href=card.link;
 const buttons=[...root.querySelectorAll("[data-outcome]")];
 function focus(which){
  for(const btn of buttons)btn.setAttribute("aria-pressed",String(btn.dataset.outcome===which));
  success.closest("article").classList.toggle("ar-emphasis",which==="success");
  failure.closest("article").classList.toggle("ar-emphasis",which==="failure");
 }
 for(const btn of buttons)btn.addEventListener("click",()=>focus(btn.dataset.outcome));
 focus("failure");
 const quiz=root.querySelector(".ar-card-quiz");let answered=0,correct=0;
 const state=root.querySelector(".ar-card-score");
 function drawQuestion(){
  quiz.replaceChildren();
  if(answered>=card.quizzes.length){state.textContent="Quiz complete: "+correct+" of 5 correct. You can retake it.";
   const reset=el("button","Retake five-question quiz");reset.type="button";
   reset.addEventListener("click",()=>{answered=0;correct=0;drawQuestion()});quiz.append(reset);return;}
  const question=card.quizzes[answered];state.textContent="Question "+(answered+1)+" of 5 · Correct so far: "+correct;
  quiz.append(el("h4",question.question));
  for(let i=0;i<question.answers.length;i++){
   const b=el("button",question.answers[i]);b.type="button";
   b.addEventListener("click",()=>{
    const result=gradeCard(id,answered,i);if(result.correct)correct++;
    const response=el("p",(result.correct?"Correct. ":"Not quite. ")+result.explanation);
    for(const child of quiz.querySelectorAll("button"))child.disabled=true;
    quiz.append(response);
    const next=el("button",answered===4?"See score →":"Next question →");
    next.type="button";next.addEventListener("click",()=>{answered++;drawQuestion()});quiz.append(next);
   });quiz.append(b);
  }
 }
 drawQuestion();
}
