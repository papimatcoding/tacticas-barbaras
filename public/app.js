"use strict";
const $=id=>document.getElementById(id);
const {DATA,simulate}=window.BattleEngine;
const TYPES=Object.keys(DATA);
const CAMPAIGN=[
  {name:"Patos de barrio",desc:"Dos aspirantes al caos. Aprende a posicionar una primera línea.",units:[["pato",1,2,0],["capibara",1,1,1]]},
  {name:"La rebelión del castor",desc:"El castor protege a los atacantes. Coloca bien tus unidades a distancia.",units:[["pereira",1,2,2],["pato",1,0,0],["tung",1,4,0]]},
  {name:"Inspección de Hacienda",desc:"Una alineación peligrosa de luchadores con mucho alcance.",units:[["agencia",1,2,0],["trancas",1,0,1],["steve",1,4,2]]},
  {name:"El combo imposible",desc:"Los rivales tienen sus primeras unidades de dos estrellas.",units:[["abuela",2,2,2],["renfe",1,0,0],["capibara",1,4,1]]},
  {name:"Asamblea de leyendas",desc:"Una formación completa de personajes absurdos.",units:[["pereira",2,2,3],["agencia",2,1,0],["pato",2,3,0],["tung",1,0,1],["trancas",1,4,1]]},
  {name:"El consejo de las 3 estrellas",desc:"La última batalla. Demuestra tu nivel.",units:[["abuela",3,2,2],["pereira",2,1,3],["renfe",2,0,0],["agencia",2,4,1],["pato",2,3,0]]}
];
let serial=1;
let game={mode:"menu",phase:"menu",level:1,round:1,gold:10,hp:20,units:[],shop:[],selected:null,
  frame:null,focus:null,code:null,id:null,players:[],battleToken:0,lastResult:null};
const socket=window.io({autoConnect:false});
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function note(t){$("battle-message").textContent=t;}
function menuNote(t){$("menu-message").textContent=t;}
function uid(){return "u"+serial++;}
function newUnit(type,star=1,x=null,y=null){return {id:uid(),type,star,x,y};}
function inField(u){return Number.isInteger(u.x)&&Number.isInteger(u.y);}
function bench(){return game.units.filter(u=>!inField(u));}
function field(){return game.units.filter(inField);}
function canEdit(){return game.phase==="prepare";}
function roster(){return Object.keys(DATA);}
function rollShop(){game.shop=Array.from({length:4},()=>roster()[Math.floor(Math.random()*roster().length)]);}
function reset(mode){
  game={mode,phase:"prepare",level:1,round:1,gold:10,hp:20,units:[newUnit("capibara",1,2,3)],
    shop:[],selected:null,frame:null,focus:null,code:null,id:null,players:[],battleToken:0,lastResult:null};
  rollShop();
  $("menu").classList.add("hidden");$("game").classList.remove("hidden");
  render();
}
function beginCampaign(){reset("campaign");game.level=1;note("¡Primera misión! Compra personajes y colócalos en tu lado.");render();}
function tryMerge(){
  let changed=true;
  while(changed){
    changed=false;
    for(const type of TYPES)for(let star=1;star<3;star++){
      const matches=game.units.filter(u=>u.type===type&&u.star===star);
      if(matches.length<3)continue;
      const three=matches.slice(0,3);
      const placed=three.find(inField);
      const promoted=newUnit(type,star+1,placed?.x??null,placed?.y??null);
      game.units=game.units.filter(u=>!three.includes(u));
      game.units.push(promoted);game.selected=promoted.id;
      note(DATA[type].name+" asciende a "+(star+1)+" estrellas. ¡Fusión!");
      changed=true;
      break;
    }
  }
}
function buy(i){
  if(!canEdit())return;
  const type=game.shop[i];
  if(!type)return;
  const cost=DATA[type].cost;
  if(game.gold<cost){note("No tienes monedas suficientes.");return;}
  if(bench().length>=8){note("La reserva está llena: mueve una unidad al campo.");return;}
  game.gold-=cost;game.units.push(newUnit(type));game.shop[i]=null;tryMerge();render();
}
function reroll(){
  if(!canEdit()||game.gold<2){note("Necesitas 2 monedas para renovar.");return;}
  game.gold-=2;rollShop();render();
}
function selectUnit(id){if(!canEdit())return;game.selected=game.selected===id?null:id;render();}
function clickCell(x,y){
  if(!canEdit())return;
  const occupied=game.units.find(u=>u.x===x&&u.y===y);
  const selected=game.units.find(u=>u.id===game.selected);
  if(!selected){if(occupied){game.selected=occupied.id;render();}return;}
  if(occupied?.id===selected.id){selected.x=null;selected.y=null;game.selected=null;render();return;}
  if(!occupied&&!inField(selected)&&field().length>=5){note("Máximo 5 unidades desplegadas.");return;}
  if(occupied){const ox=selected.x,oy=selected.y;occupied.x=ox;occupied.y=oy;}
  selected.x=x;selected.y=y;game.selected=null;render();
}
function removeSelected(){
  if(!canEdit())return;
  const u=game.units.find(u=>u.id===game.selected);
  if(u&&inField(u)){u.x=null;u.y=null;}
  game.selected=null;render();
}
function displayUnits(){
  if(game.frame){
    const side=game.mode==="pvp"&&game.lastResult?.sides?.a!==game.id?"b":"a";
    return game.frame.units.filter(u=>u.hp>0).map(u=>{
      const flip=side==="b";return {type:u.type,star:u.star,x:flip?4-u.x:u.x,y:flip?7-u.y:u.y,
        hp:u.hp,maxHp:u.maxHp,foe:u.side!==side,focus:u.id===game.frame.focus,id:u.id};
    });
  }
  const own=field().map(u=>({...u,y:u.y+4,foe:false}));
  if(game.mode!=="campaign")return own;
  const e=CAMPAIGN[game.level-1];
  return [...own,...(e?.units||[]).map((v,i)=>{
    const d=DATA[v[0]],scale=Math.pow(1.7,v[1]-1);
    return {type:v[0],star:v[1],x:4-v[2],y:3-v[3],hp:Math.round(d.hp*scale),maxHp:Math.round(d.hp*scale),foe:true,id:"e"+i};
  })];
}
function renderBoard(){
  const elements=displayUnits();
  const cards=new Map(elements.map(u=>[u.x+":"+u.y,u]));
  const board=$("board");board.innerHTML="";
  for(let y=0;y<8;y++)for(let x=0;x<5;x++){
    const u=cards.get(x+":"+y);
    const tile=document.createElement("button");
    tile.type="button";tile.className="tile "+(y<4?"enemy":"friendly")+(y===3?" frontier":"");
    if(y>=4&&canEdit()&&game.units.some(v=>v.x===x&&v.y===y-4&&v.id===game.selected))tile.classList.add("selected");
    tile.setAttribute("role","gridcell");
    tile.setAttribute("aria-label",(y<4?"Rival":"Tu campo")+" columna "+(x+1)+" fila "+(y+1)+(u?" "+DATA[u.type].name:""));
    if(u){
      const d=DATA[u.type],percent=u.hp==null?100:Math.round(100*u.hp/u.maxHp);
      tile.innerHTML='<div class="chip '+(u.foe?"foe ":"")+(u.focus?"focus":"")+'"><span class="stars">'+("★".repeat(u.star))+'</span><span class="avatar">'+d.emoji+'</span><span class="hpbar"><i style="width:'+percent+'%"></i></span></div>';
    }else if(y>=4&&canEdit()&&game.selected)tile.innerHTML='<span class="tile-hint">COLOCAR</span>';
    if(y>=4)tile.addEventListener("click",()=>clickCell(x,y-4));
    else tile.disabled=true;
    board.appendChild(tile);
  }
}
function renderBench(){
  const box=$("bench");box.innerHTML="";
  const reserve=bench();
  reserve.forEach(u=>{
    const d=DATA[u.type],b=document.createElement("button");b.type="button";
    b.className="unit-card "+(game.selected===u.id?"selected":"");
    b.title=d.name+" "+u.star+" estrellas";b.disabled=!canEdit();
    b.innerHTML='<span class="avatar">'+d.emoji+'</span><span class="stars">'+("★".repeat(u.star))+'</span>';
    b.addEventListener("click",()=>selectUnit(u.id));box.appendChild(b);
  });
  for(let i=reserve.length;i<8;i++){const blank=document.createElement("div");blank.className="bench-empty";blank.textContent="+";box.appendChild(blank);}
}
function renderShop(){
  const box=$("shop");box.innerHTML="";
  game.shop.forEach((type,i)=>{
    const b=document.createElement("button");b.type="button";
    if(!type){b.className="shop-card sold";b.textContent="VENDIDO";b.disabled=true;}
    else{
      const d=DATA[type];b.className="shop-card";b.disabled=!canEdit()||game.gold<d.cost;
      b.innerHTML='<span class="portrait">'+d.emoji+'</span><span class="details"><strong>'+esc(d.name)+'</strong><small>'+esc(d.trait)+'</small></span><span class="price">'+d.cost+' 🪙</span>';
      b.addEventListener("click",()=>buy(i));
    }box.appendChild(b);
  });
}
function render(){
  if(game.mode==="menu")return;
  const pvp=game.mode==="pvp";
  const e=CAMPAIGN[game.level-1];
  $("mode-label").textContent=pvp?"DUELO ONLINE":"CAMPAÑA";
  $("round-label").textContent=pvp?"RONDA "+game.round:"MISIÓN "+game.level+" / "+CAMPAIGN.length;
  $("hp").textContent=pvp?game.hp:"∞";
  $("gold").textContent=game.gold;
  $("phase-label").textContent={prepare:"PREPARACIÓN",waiting:"ESPERANDO",combat:"COMBATE",finished:"TERMINADO",lobby:"SALA PRIVADA"}[game.phase]||"JUEGO";
  $("enemy-name").textContent=pvp?(game.players.find(p=>p.id!==game.id)?.name||"Esperando rival..."):(e?.name||"¡Campaña completada!");
  $("enemy-summary").textContent=pvp?(game.players.length===2?"Cada jugador ve sus unidades abajo.":"Comparte el código para empezar."):(e?.desc||"¡Has ganado!");
  $("room-info").classList.toggle("hidden",!pvp);
  $("room-info").textContent=game.code?"SALA "+game.code:"";
  $("unit-count").textContent=field().length+" / 5";
  $("mission-desc").textContent=pvp?"Los dos jugadores preparáis el tablero y pulsáis LISTO. El servidor resuelve el combate.":(e?.desc||"Has derrotado a todos los jefes.");
  const selection=game.units.find(u=>u.id===game.selected);
  $("selection-info").textContent=selection?DATA[selection.type].name+" "+("★".repeat(selection.star))+" · Haz clic en una casilla.":"Selecciona una unidad y una casilla.";
  $("reroll").disabled=!canEdit()||game.gold<2;
  $("remove-selected").disabled=!canEdit()||!selection;
  $("ready").disabled=!canEdit()||field().length===0;
  $("ready").textContent=pvp?"✓ ESTOY LISTO":"⚔ ¡LUCHAR!";
  $("ready-hint").textContent=pvp?"La ronda comienza cuando ambos estén listos.":"Compra, posiciona y pulsa LUCHAR.";
  renderShop();renderBench();renderBoard();
}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function playback(result,sides,after){
  game.phase="combat";game.lastResult={sides};const token=++game.battleToken;
  $("skip-battle").classList.remove("hidden");render();
  for(const fr of result.frames){
    if(game.battleToken!==token)break;
    game.frame=fr;note(fr.message);renderBoard();await sleep(155);
  }
  if(game.battleToken!==token)return;
  game.frame=null;$("skip-battle").classList.add("hidden");
  after(result);render();
}
function ownWon(result,sides){
  const side=game.mode==="pvp"&&sides?.a!==game.id?"b":"a";
  return result.winner===side;
}
function pveFight(){
  if(!canEdit()||!field().length)return;
  const target=CAMPAIGN[game.level-1];if(!target)return;
  const ours=field().map(u=>({type:u.type,x:u.x,y:u.y,star:u.star}));
  const theirs=target.units.map(([type,star,x,y])=>({type,star,x,y}));
  const result=simulate(ours,theirs,game.level*1119);
  playback(result,{a:"me",b:"enemy"},r=>{
    if(r.winner==="a"){
      const old=game.level;game.level++;
      game.gold+=6;
      try{localStorage.setItem("tb_campaign_best",String(Math.max(old,Number(localStorage.getItem("tb_campaign_best")||0))));}catch(_){}
      if(game.level>CAMPAIGN.length){
        game.phase="finished";note("🏆 ¡Has completado la campaña! La estrategia más absurda ha triunfado.");
      }else{game.phase="prepare";rollShop();note("🏆 Victoria. +6 monedas. ¡Siguiente misión!");}
    }else{game.phase="prepare";game.gold+=4;rollShop();note("Derrota. +4 monedas de consuelo. Mejora tu formación e inténtalo de nuevo.");}
  });
}
function pvpFight(){
  if(!canEdit()||!field().length)return;
  game.phase="waiting";note("Esperando a que tu rival esté listo...");render();
  const board=field().map(u=>({type:u.type,x:u.x,y:u.y,star:u.star}));
  socket.emit("round:ready",{board},res=>{
    if(!res?.ok){game.phase="prepare";note(res?.error||"No se pudo confirmar la preparación.");render();}
  });
}
function initSocket(){
  socket.on("connect_error",()=>menuNote("No se puede conectar al servidor del multijugador."));
  socket.on("room:state",s=>{
    if(game.mode!=="pvp")return;
    game.players=s.players;game.round=s.round||1;
    const me=s.players.find(p=>p.id===game.id);if(me)game.hp=me.hp;
    render();
  });
  socket.on("round:start",s=>{
    if(game.mode!=="pvp")return;
    game.battleToken++;game.frame=null;game.lastResult=null;game.round=s.round;
    game.players=s.players;game.hp=s.players.find(p=>p.id===game.id)?.hp??20;
    if(s.round>1)game.gold+=6;
    game.phase="prepare";rollShop();$("skip-battle").classList.add("hidden");
    note("¡Ronda "+s.round+"! Refuerza tu equipo. Ambos jugadores ven su lado abajo.");render();
  });
  socket.on("round:result",payload=>{
    if(game.mode!=="pvp")return;
    game.players=payload.state.players;game.hp=payload.state.players.find(p=>p.id===game.id)?.hp??game.hp;
    playback(payload.result,payload.sides,r=>{
      game.phase="waiting";
      note(r.winner==="draw"?"¡Empate!":ownWon(r,payload.sides)?"¡Has ganado la ronda!":"Has perdido la ronda. ¡Remonta!");
    });
  });
  socket.on("game:over",s=>{
    if(game.mode!=="pvp")return;
    game.battleToken++;game.frame=null;game.phase="finished";game.players=s.players;
    const me=s.players.find(p=>p.id===game.id);
    game.hp=me?.hp??0;$("skip-battle").classList.add("hidden");
    note(me&&me.hp>0?"🏆 ¡Victoria! ¡Has ganado el duelo!":"💀 Has perdido el duelo. ¡Revancha!");
    render();
  });
  socket.on("room:ended",msg=>{
    if(game.mode!=="pvp")return;
    game.battleToken++;game.frame=null;game.phase="finished";note(msg.message);render();
  });
}
function enterRoom(create){
  socket.connect();
  const name=$("player-name").value.trim()||"Jugador";
  const code=$("room-code").value.trim().toUpperCase();
  if(!create&&code.length!==6){menuNote("Escribe un código de sala de 6 caracteres.");return;}
  socket.emit(create?"room:create":"room:join",{name,code},r=>{
    if(!r?.ok){menuNote(r?.error||"Error de conexión.");return;}
    reset("pvp");game.code=r.code;game.id=r.id;game.phase="lobby";
    note("Comparte el código "+r.code+" con tu amigo para empezar.");render();
  });
}
function init(){
  $("play-campaign").addEventListener("click",beginCampaign);
  $("create-room").addEventListener("click",()=>enterRoom(true));
  $("join-room").addEventListener("click",()=>enterRoom(false));
  $("room-code").addEventListener("input",e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,"").slice(0,6);});
  $("reroll").addEventListener("click",reroll);
  $("remove-selected").addEventListener("click",removeSelected);
  $("ready").addEventListener("click",()=>game.mode==="campaign"?pveFight():pvpFight());
  $("exit-game").addEventListener("click",()=>{if(game.mode==="pvp")socket.emit("room:leave");window.location.reload();});
  $("skip-battle").addEventListener("click",()=>{
    if(game.phase!=="combat")return;
    // Mark the playback as skipped; finish using the last known result handler in the current engine.
    game.battleToken++;
    game.frame=null;$("skip-battle").classList.add("hidden");
    if(game.mode==="pvp"){game.phase="waiting";note("Animación omitida. Esperando la siguiente ronda.");}
    else{game.phase="prepare";note("Animación omitida. Continúa con la misión.");}
    render();
  });
  initSocket();
}
init();
