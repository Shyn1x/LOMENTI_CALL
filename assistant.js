/* Lomenti Call: local FAQ search and simple saved notes. */
(()=>{
"use strict";
const faq=typeof FAQ_GROUPS!=="undefined"?FAQ_GROUPS:[];
const $=id=>document.getElementById(id);
let busy=false;
let lastAnswer=null, lastSavedText="";
let assistantLang=null;
// The guide's RU/LV switch controls the guide, but the assistant answers in
// the language of the actual question (including Latvian without diacritics).
const assistantLanguage=()=>assistantLang||language;
const assistantTr=(r,l)=>assistantLanguage()==="ru"?r:l;
window.guideLastSavedText="";
const ru=()=>language==="ru";
const tr=(r,l)=>ru()?r:l;
const take=()=>($("call-notes-text")?.value||"").trim();
const STATUS=()=>$("notes-save-status");
const ENTRIES="lomenti-call-explicit-archive-v1";
const DRAFT="lomenti-call-draft";
function localEntries(){try{let x=JSON.parse(localStorage.getItem(ENTRIES)||"[]");return Array.isArray(x)?x.slice(0,100):[]}catch{return []}}
function setLocalEntries(entries){localStorage.setItem(ENTRIES,JSON.stringify(entries.slice(0,100)))}
function notify(message){if(STATUS())STATUS().textContent=message}
function normalize(s){return (s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/ё/g,"е").replace(/[^\p{L}\p{N} ]/gu," ").replace(/\s+/g," ").trim()}
const stop=new Set(["и","а","на","в","с","по","за","до","у","о","не","вы","мы","мне","нам","там","это","ли","как","что","же","бы","или","для","то","про","the","a","un","ar","par","vai","kas","ka","ir","to","no","pie","man","jums","mums","kur","butu","kā","vai"]);
function tokens(t){return normalize(t).split(" ").filter(x=>x.length>2&&!stop.has(x))}
function detectQuestionLanguage(question){
 const raw=String(question||"");
 if (/[а-яё]/i.test(raw)) return "ru";
 if (/[āčēģīķļņšūž]/i.test(raw)) return "lv";
 // Common words make the choice work for "Cik maksa domens" too.
 // For unclear short text, respect the user's existing language selection.
 const lvWords=new Set(["cik","maksa","maksat","domens","domenu","majаslapa","majaslapa","vietne","lapa","cena","izmaksas","izmaksа","vai","kads","kada","kapec","kur","ka","kas","kad","ko","jus","jums","man","mes","var","busi","bus","ir","nav","pie","bez","ar","par","sveiki","labdien","hostings","hostingu","atlaide","termins","izstrade","ludzu"]);
 const ruRomanWords=new Set(["skolko","stoit","stoimost","kak","kakaya","kakoi","pochemu","sait","sayt","saita","sdelat","nuzhno","mozhno","domen","domena","hosting","cena","tsena","privet","zdravstvuyte","spasibo","u","menya","vopros","est","net","eto","eto","chto"]);
 let lv=0,ruScore=0;
 for(const word of normalize(raw).split(" ").filter(Boolean)){
  if(lvWords.has(word))lv+=(word==="cik"||word==="maksa"||word==="domens"?3:2);
  if(ruRomanWords.has(word))ruScore+=word==="skolko"||word==="stoit"?3:2;
 }
 if(lv>ruScore && lv>0)return "lv";
 if(ruScore>lv && ruScore>0)return "ru";
 return language;
}
function grams(s){const x=" "+normalize(s)+" ",r=new Set();for(let i=0;i<x.length-2;i++)r.add(x.slice(i,i+3));return r}
function sim(a,b){const x=grams(a),y=grams(b);if(!x.size||!y.size)return 0;let n=0;for(const p of x)if(y.has(p))n++;return 2*n/(x.size+y.size)}
function rowScore(q,row){
 const nq=normalize(q),qt=tokens(q);
 let best=0;
 for(const title of [row[0],row[1]]){
  const nt=normalize(title),tt=tokens(title);let hit=0;
  for(const t of qt)if(tt.some(k=>k===t||((k.length>=5&&t.length>=5)&&sim(t,k)>.72)))hit++;
  const overlap=qt.length?hit/qt.length:0;
  const score=.60*sim(nq,nt)+.40*overlap+(nq===nt?.35:0);
  best=Math.max(best,score);
 }
 return best;
}
const indexed=faq.flatMap((group,gi)=>group[2].map((row,ri)=>({row,gi,ri,group})));
function findLocal(q){
 return indexed.map(e=>({...e,score:rowScore(q,e.row)})).sort((a,b)=>b.score-a.score).slice(0,4);
}
function showMatch(entry,replyLang=assistantLanguage()){
 const row=entry.row, i=replyLang==="ru"?0:1;
 const tt=(r,l)=>replyLang==="ru"?r:l;
 const wrap=$("assist-result");wrap.replaceChildren();
 const p=document.createElement("div");p.className="assist-answer";p.textContent=row[i+2];wrap.append(p);
 const src=document.createElement("p");src.className="assist-source";src.textContent=tt("Источник: ","Avots: ")+entry.group[i]+" · "+row[i];wrap.append(src);
 const buttons=document.createElement("div");buttons.className="assist-toolbar";
 const copy=document.createElement("button");copy.textContent=tt("Скопировать","Kopēt");copy.onclick=()=>navigator.clipboard?.writeText(row[i+2]);buttons.append(copy);
 const open=document.createElement("button");open.textContent=tt("Открыть в FAQ","Atvērt FAQ");open.onclick=()=>{
  // FAQ questions must be displayed in the same language as the answer.
  if(language!==replyLang){language=replyLang;document.documentElement.lang=language;window.updateGuideLabels?.();}
  window.faqOpen=true;faqCategory=entry.gi;render();
  setTimeout(()=>{const wanted=row[i];const item=Array.from(document.querySelectorAll(".faq-item")).find(n=>n.querySelector("summary")?.textContent===wanted);if(item){item.open=true;item.scrollIntoView({behavior:"smooth",block:"center"})}},30);
 };buttons.append(open);wrap.append(buttons);lastAnswer=entry;
}
function showChoices(hits,message,replyLang=assistantLanguage()){
 const wrap=$("assist-result");wrap.replaceChildren();
 const p=document.createElement("div");p.className="assist-answer";p.textContent=message;wrap.append(p);
 const options=document.createElement("div");options.className="assist-options";
 for(const item of hits.slice(0,3)){
  if(item.score<.15)continue;
  const b=document.createElement("button");b.textContent=item.row[replyLang==="ru"?0:1];b.onclick=()=>showMatch(item,replyLang);options.append(b);
 }wrap.append(options);
}
async function ask(question){
 const q=(question||"").trim();if(!q||busy)return;
 const replyLang=detectQuestionLanguage(q);assistantLang=replyLang;
 window.mountFAQAssistant?.();
 const tt=(r,l)=>replyLang==="ru"?r:l;
 busy=true;$("assist-ask").disabled=true;
 $("assist-result").textContent=tt("Ищу в справочнике...","Meklēju atbilžu krājumā...");
 try{
  const hits=findLocal(q);
  if(hits[0] && hits[0].score>=.65 && (hits.length===1||hits[0].score-hits[1].score>=.12))showMatch(hits[0],replyLang);
  else showChoices(hits,tt("Не могу уверенно выбрать ответ. Уточни вопрос или выбери подходящую тему ниже.","Nevaru droši izvēlēties atbildi. Precizē jautājumu vai izvēlies tēmu zemāk."),replyLang);
 }finally{busy=false;$("assist-ask").disabled=false}
}
function makeAssistant(){
 const box=document.createElement("section");box.id="faq-assistant";
 const h=document.createElement("h2");h.id="assist-heading";box.append(h);
 const sub=document.createElement("p");sub.id="assist-sub";sub.className="assist-subtext";box.append(sub);
 const field=document.createElement("textarea");field.id="assist-question";field.maxLength=650;field.placeholder="...";box.append(field);
 const tools=document.createElement("div");tools.className="assist-toolbar";
 const askButton=document.createElement("button");askButton.id="assist-ask";askButton.type="button";askButton.onclick=()=>ask(field.value);tools.append(askButton);
 field.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();ask(field.value)}});
 box.append(tools);
 const result=document.createElement("div");result.id="assist-result";result.setAttribute("aria-live","polite");box.append(result);
 return box;
}
window.mountFAQAssistant=()=>{
 const safety=$("safety");if(!safety)return;
 let box=$("faq-assistant");if(!box){box=makeAssistant();safety.append(box)}
 $("assist-heading").textContent=assistantTr("Поиск готового ответа","Gatavas atbildes meklēšana");
 $("assist-sub").textContent=assistantTr("Найди подходящий ответ из справочника вопросов клиентов.","Atrodi piemērotu atbildi klientu jautājumu krājumā.");
 $("assist-question").placeholder=assistantTr("Что спросил клиент? Можно с опечатками...","Ko jautāja klients? Var ar drukas kļūdām...");
 $("assist-ask").textContent=assistantTr("Найти ответ","Atrast atbildi");
};
function refreshArchive(){
 const c=$("notes-archive-list");if(!c)return;
 c.replaceChildren();const list=localEntries();
 const btn=$("notes-open");
 if(btn)btn.textContent=tr("Мои заметки","Manas piezīmes")+(list.length?" ("+list.length+")":"");
 if(!list.length){c.textContent=tr("Сохранённых заметок пока нет.","Saglabātu piezīmju vēl nav.");return}
 for(const [i,e] of list.entries()){
  const div=document.createElement("article");div.className="archive-entry";
  const head=document.createElement("div");head.className="archive-entry-head";
  const dt=document.createElement("strong");dt.textContent=new Date(e.at).toLocaleString(ru()?"ru-RU":"lv-LV");head.append(dt);
  const remove=document.createElement("button");remove.type="button";remove.textContent=tr("Удалить","Dzēst");
  remove.setAttribute("aria-label",tr("Удалить запись","Dzēst ierakstu"));
  remove.onclick=()=>{
   if(!confirm(tr("Удалить эту сохранённую заметку?","Vai dzēst šo saglabāto piezīmi?")))return;
   try{setLocalEntries(localEntries().filter((_,j)=>j!==i));refreshArchive();notify(tr("Заметка удалена.","Piezīme dzēsta."))}
   catch(e){notify(tr("Не удалось удалить запись.","Neizdevās izdzēst ierakstu."))}
  };
  head.append(remove);div.append(head);
  const p=document.createElement("p");p.textContent=e.text;div.append(p);c.append(div);
 }
}
async function saveNote(){
 const note=take();if(!note){notify(tr("Напишите заметку перед сохранением.","Pirms saglabāšanas ierakstiet piezīmi."));return}
 if(note.length>8000){notify(tr("Максимум 8000 символов.","Maksimums 8000 rakstzīmju."));return}
 try{setLocalEntries([{at:new Date().toISOString(),text:note},...localEntries()]);}
 catch(e){notify(tr("Не удалось сохранить: в браузере закончилось место.","Neizdevās saglabāt: pārlūkā nav pietiekami vietas."));return}
 try{sessionStorage.setItem(DRAFT,note)}catch(e){}
 window.guideLastSavedText=note;refreshArchive();
 notify(tr("Сохранено. Запись доступна в «Моих заметках».","Saglabāts. Ieraksts pieejams sadaļā «Manas piezīmes»."));
}
function refreshLabels(){
 $("notes-save").textContent=tr("Сохранить","Saglabāt");
 $("notes-clear").textContent=tr("Очистить","Notīrīt");
 $("notes-archive-title").textContent=tr("Мои заметки","Manas piezīmes");
 refreshArchive();window.mountFAQAssistant();
}
window.updateGuideLabels=refreshLabels;
const field=$("call-notes-text");
try{const draft=sessionStorage.getItem(DRAFT);if(draft && !field.value)field.value=draft}catch{}
field.addEventListener("input",()=>{try{sessionStorage.setItem(DRAFT,field.value)}catch{}});
$("notes-clear").addEventListener("click",()=>{setTimeout(()=>{if(!field.value){try{sessionStorage.removeItem(DRAFT)}catch{}}},30)});
$("notes-save").onclick=saveNote;
$("notes-open").onclick=()=>{
 const archive=$("notes-archive");archive.hidden=!archive.hidden;
 $("notes-open").setAttribute("aria-expanded",String(!archive.hidden));
 if(!archive.hidden)refreshArchive();
};
const langBtn=$("lang");langBtn.addEventListener("click",()=>{assistantLang=null;setTimeout(refreshLabels,0)});
refreshArchive();refreshLabels();
})();