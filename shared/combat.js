// Shared deterministic combat engine (browser + Node).
(function (root) {
  "use strict";
  const DATA = {
    pato: { name:"Pato Metralleta", emoji:"🦆", cost:2, hp:72, atk:17, range:3, speed:3, trait:"Caos" },
    abuela: { name:"Abuela con Chancla", emoji:"👵", cost:3, hp:105, atk:24, range:1, speed:2, trait:"Leyenda" },
    pereira: { name:"Pereira Castor", emoji:"🦫", cost:3, hp:170, atk:12, range:1, speed:1, trait:"Tanque" },
    tung: { name:"Tung Tung Sahur", emoji:"🥁", cost:2, hp:100, atk:15, range:2, speed:2, trait:"Caos" },
    trancas: { name:"Trancas y Barrancas", emoji:"🐜", cost:2, hp:90, atk:18, range:2, speed:2, trait:"Dúo" },
    agencia: { name:"Agencia Tributaria", emoji:"💼", cost:3, hp:115, atk:22, range:2, speed:1, trait:"Leyenda" },
    capibara: { name:"Capibara", emoji:"🦦", cost:1, hp:130, atk:11, range:1, speed:1, trait:"Tanque" },
    steve: { name:"Steve", emoji:"⛏️", cost:2, hp:145, atk:15, range:1, speed:2, trait:"Tanque" },
    renfe: { name:"Renfe", emoji:"🚆", cost:3, hp:95, atk:27, range:3, speed:1, trait:"Caos" },
    queso: { name:"Vaca que Ríe", emoji:"🐮", cost:1, hp:88, atk:14, range:2, speed:2, trait:"Dúo" }
  };
  function normalize(team, side) {
    const seen = new Set();
    return (Array.isArray(team) ? team : []).slice(0,5).flatMap((item, i) => {
      if (!item || !DATA[item.type] || !Number.isInteger(item.x) || !Number.isInteger(item.y) ||
          item.x < 0 || item.x > 4 || item.y < 0 || item.y > 3) return [];
      const key = item.x + ":" + item.y;
      if (seen.has(key)) return [];
      seen.add(key);
      const d=DATA[item.type], star=Math.min(3,Math.max(1,Math.trunc(Number(item.star)||1)));
      const f=Math.pow(1.7,star-1);
      return [{id:side+":"+i,type:item.type,name:d.name,emoji:d.emoji,star,trait:d.trait,
        side,x:side==="a"?item.x:4-item.x,y:side==="a"?4+item.y:3-item.y,
        hp:Math.round(d.hp*f),maxHp:Math.round(d.hp*f),atk:Math.round(d.atk*f),range:d.range,speed:d.speed}];
    });
  }
  function simulate(a,b,seed=1) {
    const units=[...normalize(a,"a"),...normalize(b,"b")];
    const frames=[];
    let rng=(Number(seed)>>>0)||1;
    function random(){rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;return (rng>>>0)/4294967296;}
    function capture(message,focus=null){
      frames.push({message,focus,units:units.map(u=>({id:u.id,side:u.side,x:u.x,y:u.y,hp:u.hp,maxHp:u.maxHp,type:u.type,star:u.star}))});
    }
    capture("¡Empieza el combate!");
    for(let cycle=0;cycle<18;cycle++){
      const alive=units.filter(u=>u.hp>0);
      if(!alive.some(u=>u.side==="a")||!alive.some(u=>u.side==="b"))break;
      const order=alive.slice().sort((a,b)=>b.speed-a.speed||(random()-.5));
      let acted=0;
      for(const u of order){
        if(u.hp<=0)continue;
        const enemies=units.filter(v=>v.hp>0&&v.side!==u.side);
        if(!enemies.length)break;
        const dist=v=>Math.abs(v.x-u.x)+Math.abs(v.y-u.y);
        enemies.sort((a,b)=>dist(a)-dist(b)||a.hp-b.hp);
        const target=enemies[0];
        if(dist(target)<=u.range){
          target.hp=Math.max(0,target.hp-u.atk);
          capture(u.name+" golpea a "+target.name+" (-"+u.atk+")",u.id);
          acted++;
        }else{
          const dx=Math.sign(target.x-u.x),dy=Math.sign(target.y-u.y);
          const options=Math.abs(target.y-u.y)>=Math.abs(target.x-u.x)
            ? [[0,dy],[dx,0],[0,-dy],[-dx,0]]
            : [[dx,0],[0,dy],[-dx,0],[0,-dy]];
          const free=([ox,oy])=> (ox!==0||oy!==0)&&u.x+ox>=0&&u.x+ox<5&&u.y+oy>=0&&u.y+oy<8&&!units.some(v=>v.hp>0&&v!==u&&v.x===u.x+ox&&v.y===u.y+oy);
          const step=options.find(free);
          if(step){u.x+=step[0];u.y+=step[1];capture(u.name+" avanza",u.id);acted++;}
        }
        if(frames.length>=90)break;
      }
      if(!acted||frames.length>=90)break;
    }
    const ha=units.filter(u=>u.side==="a").reduce((x,u)=>x+u.hp,0),hb=units.filter(u=>u.side==="b").reduce((x,u)=>x+u.hp,0);
    const winner=ha>hb?"a":hb>ha?"b":"draw";
    capture(winner==="draw"?"¡Empate!":winner==="a"?"¡Victoria del lado azul!":"¡Victoria del lado rojo!");
    return {winner,frames,remaining:{a:ha,b:hb}};
  }
  const api={DATA,simulate};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.BattleEngine=api;
})(typeof window!=="undefined"?window:globalThis);
