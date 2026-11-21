/* Lomenti Call: FAQ-only assistant, local fallback, explicit notes archive. */
(()=>{
"use strict";
const faq=typeof FAQ_GROUPS!=="undefined"?FAQ_GROUPS:[];
const $=id=>document.getElementById(id);
let endpoint="",key="",busy=false;
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
function blobSave(content,name){const b=new Blob([content],{type:"text/plain;charset=utf-8"}),u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),3000)}
function stamp(){return new Date().toISOString().replaceAll(":","-").slice(0,19)}
function textExport(rows){return rows.map(e=>new Date(e.at).toLocaleString(ru()?"ru-RU":"lv-LV")+"\n"+e.text+"\n").join("\n---\n\n")}
async function api(path,method="GET",body){
 if(!endpoint||!key)throw Error(tr("Сервер не подключён","Serveris nav pieslēgts"));
 const res=await fetch(endpoint+path,{method,headers:{"Content-Type":"application/json","X-Guide-Key":key},body:body?JSON.stringify(body):undefined,cache:"no-store",signal:AbortSignal.timeout(16000)});
 if(!res.ok)throw Error("HTTP "+res.status);
 return res.json();
}
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
function showMatch(entry,origin="local",replyLang=assistantLanguage()){
 const row=entry.row, i=replyLang==="ru"?0:1;
 const tt=(r,l)=>replyLang==="ru"?r:l;
 const wrap=$("assist-result");wrap.replaceChildren();
 const p=document.createElement("div");p.className="assist-answer";p.textContent=row[i+2];wrap.append(p);
 const src=document.createElement("p");src.className="assist-source";src.textContent=tt("Источник: ","Avots: ")+entry.group[i]+" · "+row[i]+(origin==="local"?tt(" · поиск по FAQ без AI"," · FAQ meklēšana bez AI"):" · AI FAQ");wrap.append(src);
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
  const b=document.createElement("button");b.textContent=item.row[replyLang==="ru"?0:1];b.onclick=()=>showMatch(item,"local",replyLang);options.append(b);
 }wrap.append(options);
}
async function ask(question){
 const q=(question||"").trim();if(!q)return;
 if(busy)return;
 const replyLang=detectQuestionLanguage(q);
 assistantLang=replyLang;
 window.mountFAQAssistant?.();
 const tt=(r,l)=>replyLang==="ru"?r:l;
 busy=true;$("assist-ask").disabled=true;
 const wrap=$("assist-result");wrap.textContent=tt("Ищу в базе...","Meklēju zināšanu bāzē...");
 try{
  if(endpoint&&key){
   const r=await api("/api/ask","POST",{question:q,lang:replyLang});
   if(r.matched&&indexed[r.id]){showMatch(indexed[r.id],"ai",replyLang);return}
   if(r.clarification){showChoices(findLocal(q),tt("В базе нет однозначного ответа. Уточни вопрос или выбери тему ниже.","Zināšanu bāzē nav viennozīmīgas atbildes. Precizē jautājumu vai izvēlies tēmu zemāk."),replyLang);return}
  }
  const hits=findLocal(q);
  if(hits[0] && hits[0].score>=.65 && (hits.length===1||hits[0].score-hits[1].score>=.12))showMatch(hits[0],"local",replyLang);
  else showChoices(hits,tt("Не могу уверенно выбрать ответ. Уточни вопрос или выбери подходящую тему ниже.","Nevaru droši izvēlēties atbildi. Precizē jautājumu vai izvēlies tēmu zemāk."),replyLang);
 }catch(e){
  const hits=findLocal(q);
  showChoices(hits,tt("AI-сервер недоступен; показываю варианты из FAQ. Ответ не выдумываю.","AI serveris nav pieejams; rādu FAQ variantus. Atbildi neizdomāju."),replyLang);
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
 $("assist-heading").textContent=assistantTr("AI-помощник по FAQ","AI palīgs no FAQ");
 $("assist-sub").textContent=endpoint&&key?assistantTr("AI выбирает подходящий ответ из базы. Без выдумок.","AI atlasa atbildi no datubāzes. Bez izdomājumiem."):assistantTr("Пока работает локальный поиск по FAQ. AI включится после подключения сервера.","Pagaidām pieejama lokāla FAQ meklēšana. AI būs pēc servera pieslēgšanas.");
 $("assist-question").placeholder=assistantTr("Что спросил клиент? Можно с опечатками...","Ko jautāja klients? Var ar drukas kļūdām...");
 $("assist-ask").textContent=assistantTr("Найти ответ","Atrast atbildi");
};
function refreshArchive(){
 const c=$("notes-archive-list");if(!c)return;c.replaceChildren();
 const list=localEntries();
 if(!list.length){c.textContent=tr("На этом устройстве записей пока нет.","Šajā ierīcē ierakstu pagaidām nav.");return}
 for(const e of list.slice(0,30)){
  const div=document.createElement("div");div.className="archive-entry";
  const dt=document.createElement("strong");dt.textContent=new Date(e.at).toLocaleString(ru()?"ru-RU":"lv-LV");div.append(dt);
  const p=document.createElement("p");p.textContent=e.text;div.append(p);c.append(div);
 }
}
function setStatus(el,t){if(el)el.textContent=t}
async function saveNote(){
 const note=take();if(!note){notify(tr("Введите заметку.","Ievadiet piezīmi."));return}
 if(note.length>8000){notify(tr("Слишком длинная заметка (макс. 8000 символов).","Pārāk gara piezīme (maks. 8000 rakstzīmes)."));return}
 const item={at:new Date().toISOString(),text:note};
 try{setLocalEntries([item,...localEntries()]);}catch(e){notify(tr("Нет места в браузере. Скачайте TXT.","Pārlūkā nav vietas. Lejupielādējiet TXT."));return}
 try{sessionStorage.setItem(DRAFT,note)}catch(e){}
 window.guideLastSavedText=note;refreshArchive();
 if(endpoint&&key){
  try{await api("/api/notes","POST",item);notify(tr("Сохранено на сервере и на этом устройстве.","Saglabāts serverī un šajā ierīcē."));return}
  catch(e){notify(tr("Сохранено только на этом устройстве. Сервер недоступен.","Saglabāts tikai šajā ierīcē. Serveris nav pieejams."));return}
 }
 notify(tr("Сохранено только в браузере этого устройства. Для общей истории подключите сервер.","Saglabāts tikai šīs ierīces pārlūkā. Kopīgai vēsturei pieslēdziet serveri."));
}
async function loadRemote(){
 if(!endpoint||!key){notify(tr("Сначала подключите сервер.","Vispirms pieslēdziet serveri."));return}
 try{
  const r=await api("/api/notes");const list=Array.isArray(r.items)?r.items:[];
  const c=$("notes-archive-list");c.replaceChildren();
  const title=document.createElement("p");title.textContent=tr("Записи на сервере: ","Servera ieraksti: ")+list.length;c.append(title);
  for(const e of list){
   const row=document.createElement("div");row.className="archive-entry";
   const t=document.createElement("strong");t.textContent=new Date(e.at).toLocaleString(ru()?"ru-RU":"lv-LV");row.append(t);
   const p=document.createElement("p");p.textContent=e.text;row.append(p);c.append(row);
  }
 }catch(e){notify(tr("Не удалось загрузить серверную историю.","Neizdevās ielādēt servera vēsturi."))}
}
function refreshLabels(){
 $("notes-save").textContent=tr("Сохранить заметки","Saglabāt piezīmes");
 $("notes-download").textContent=tr("Скачать TXT","Lejupielādēt TXT");
 $("notes-archive-title").textContent=tr("История на этом устройстве","Vēsture šajā ierīcē");
 $("notes-history-export").textContent=tr("Скачать историю TXT","Lejupielādēt vēsturi TXT");
 $("notes-history-delete").textContent=tr("Удалить локальную историю","Dzēst vietējo vēsturi");
 $("guide-connect-title").textContent=tr("Подключение сервера","Servera pieslēgšana");
 $("guide-connect-hint").textContent=tr("HTTPS API + ключ из настроек VPS. Ключ не сохраняется в браузере.","HTTPS API un VPS piekļuves atslēga. Atslēga netiek saglabāta pārlūkā.");
 $("guide-api-connect").textContent=tr("Подключить","Pieslēgt");
 $("guide-api-url").placeholder="https://api.example.com";
 if(!$("notes-remote-button")){const b=document.createElement("button");b.id="notes-remote-button";b.textContent=tr("Серверная история","Servera vēsture");b.onclick=loadRemote;$("notes-archive-list").after(b)}
 else $("notes-remote-button").textContent=tr("Серверная история","Servera vēsture");
 window.mountFAQAssistant();
}
window.updateGuideLabels=refreshLabels;
const field=$("call-notes-text");
try{const draft=sessionStorage.getItem(DRAFT);if(draft && !field.value)field.value=draft}catch{}
field.addEventListener("input",()=>{try{sessionStorage.setItem(DRAFT,field.value)}catch{}});
$("notes-clear").addEventListener("click",()=>{setTimeout(()=>{if(!field.value){try{sessionStorage.removeItem(DRAFT)}catch{}}},30)});
$("notes-save").onclick=saveNote;
$("notes-download").onclick=()=>{if(!take())return notify(tr("Нет текста для скачивания.","Nav teksta lejupielādei."));blobSave(new Date().toLocaleString()+"\n"+take()+"\n","lomenti-note-"+stamp()+".txt")};
$("notes-history-export").onclick=()=>{const list=localEntries();if(!list.length)return notify(tr("История пуста.","Vēsture ir tukša."));blobSave(textExport(list),"lomenti-history-"+stamp()+".txt")};
$("notes-history-delete").onclick=()=>{if(confirm(tr("Удалить все локальные сохранённые записи? Серверные не затронутся.","Dzēst visus vietējos ierakstus? Servera ieraksti netiks dzēsti."))){try{localStorage.removeItem(ENTRIES)}catch{}refreshArchive()}};
$("guide-api-connect").onclick=async()=>{
 const url=$("guide-api-url").value.trim().replace(/\/+$/,"");
 const secret=$("guide-api-key").value.trim();
 if(!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(url)||!secret){setStatus($("guide-api-status"),tr("Укажите HTTPS-адрес и ключ.","Norādiet HTTPS adresi un atslēgu."));return}
 endpoint=url;key=secret;$("guide-api-key").value="";
 try{await api("/api/health");setStatus($("guide-api-status"),tr("Сервер подключён.","Serveris pieslēgts."))}
 catch(e){endpoint="";key="";setStatus($("guide-api-status"),tr("Нет соединения. Проверьте адрес, HTTPS и ключ.","Nav savienojuma. Pārbaudiet adresi, HTTPS un atslēgu."))}
 window.mountFAQAssistant();
};
const langBtn=$("lang");langBtn.addEventListener("click",()=>{assistantLang=null;setTimeout(refreshLabels,0)});
refreshArchive();refreshLabels();
})();