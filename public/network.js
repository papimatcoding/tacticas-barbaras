// Static-host friendly 1v1 multiplayer via WebRTC/PeerJS (public signaling).
// The creator of each room acts as the round authority. Intended for casual private matches.
(function(root){
  "use strict";
  const events=Object.create(null);
  const {DATA,simulate}=root.BattleEngine;
  let peer=null, connection=null, isHost=false, local=null, guest=null;
  let roomCode=null,players=[],phase="lobby",round=0,runToken=0;
  let joinCallback=null,readyCallback=null,connecting=false;
  const emitLocal=(event,data)=>(events[event]||[]).forEach(fn=>fn(data));
  const state=()=>({code:roomCode,round,phase,players:players.map(p=>({id:p.id,name:p.name,hp:p.hp,ready:!!p.ready}))});
  const send=msg=>{if(connection&&connection.open)connection.send(msg);};
  const broadcast=(event,data)=>{emitLocal(event,data);send({kind:"event",event,data});};
  const notify=()=>broadcast("room:state",state());
  const charset="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function code(){
    const bytes=new Uint8Array(6);
    if(root.crypto?.getRandomValues)root.crypto.getRandomValues(bytes);
    else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
    return Array.from(bytes,x=>charset[x%charset.length]).join("");
  }
  function name(v){return String(v||"Jugador").trim().slice(0,18)||"Jugador";}
  function checkBoard(input){
    if(!Array.isArray(input)||input.length<1||input.length>5)return null;
    const seen=new Set(),out=[];
    for(const unit of input){
      const x=Number(unit?.x),y=Number(unit?.y),star=Number(unit?.star);
      if(!DATA[unit?.type]||!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>4||y<0||y>3||
        !Number.isInteger(star)||star<1||star>3||seen.has(x+":"+y))return null;
      seen.add(x+":"+y);out.push({type:unit.type,star,x,y});
    }
    return out;
  }
  function startRound(){
    if(!isHost||players.length!==2)return;
    round++;phase="prepare";
    players.forEach(p=>{p.ready=false;p.board=null;});
    broadcast("round:start",state());
  }
  function processReady(id,board,callback){
    if(!isHost||phase!=="prepare"){callback({error:"La ronda no está en preparación."});return;}
    const p=players.find(p=>p.id===id);
    const clean=checkBoard(board);
    if(!p||p.ready||!clean){callback({error:"Formación inválida o ya confirmada."});return;}
    p.board=clean;p.ready=true;callback({ok:true});notify();
    if(players.length!==2||!players.every(p=>p.ready))return;
    phase="combat";
    const winner=simulate(players[0].board,players[1].board,round*9719);
    const loser=winner.winner==="a"?players[1]:winner.winner==="b"?players[0]:null;
    if(loser)loser.hp=Math.max(0,loser.hp-3-Math.min(3,round));
    broadcast("round:result",{result:winner,round,sides:{a:players[0].id,b:players[1].id},state:state()});
    notify();
    const token=++runToken;
    root.setTimeout(()=>{
      if(token!==runToken||!isHost||!connection?.open)return;
      if(players.some(p=>p.hp<=0)){phase="finished";broadcast("game:over",state());}
      else startRound();
    },15000);
  }
  function end(message){
    runToken++;
    if(roomCode)emitLocal("room:ended",{message:message||"Se ha cerrado la sala."});
    phase="finished";
  }
  function close(){
    runToken++;
    try{send({kind:"leave"});}catch(_){}
    try{connection?.close();}catch(_){}
    try{peer?.destroy();}catch(_){}
    connection=null;peer=null;connecting=false;roomCode=null;phase="lobby";players=[];
  }
  function setupConnection(c){
    connection=c;
    c.on("close",()=>{if(connection!==c)return;end("Se ha desconectado el otro jugador.");});
    c.on("error",()=>{if(connection!==c)return;end("Se ha interrumpido la conexión con tu rival.");});
    c.on("data",msg=>{
      if(!msg||typeof msg!=="object")return;
      if(isHost){
        if(msg.kind==="join"){
          if(players.length!==1||phase!=="lobby"){
            send({kind:"reject",error:"Esta sala ya está completa."});return;
          }
          guest={id:c.peer,name:name(msg.name),hp:20,ready:false,board:null};
          players.push(guest);
          send({kind:"ack",code:roomCode,id:guest.id});
          notify();startRound();
        }else if(msg.kind==="ready"){
          processReady(c.peer,msg.board,answer=>send({kind:"ready-ack",answer}));
        }else if(msg.kind==="leave"){end("Tu rival ha salido de la sala.");}
      }else{
        if(msg.kind==="ack"){
          const cb=joinCallback;joinCallback=null;connecting=false;
          cb?.({ok:true,code:msg.code,id:msg.id});
        }else if(msg.kind==="reject"){
          const cb=joinCallback;joinCallback=null;connecting=false;
          cb?.({error:msg.error||"Sala no disponible."});
        }else if(msg.kind==="ready-ack"){
          const cb=readyCallback;readyCallback=null;cb?.(msg.answer);
        }else if(msg.kind==="event"&&typeof msg.event==="string"){
          emitLocal(msg.event,msg.data);
        }else if(msg.kind==="leave"){end("Tu rival ha salido de la sala.");}
      }
    });
  }
  function createRoom(payload,cb){
    if(!root.Peer){cb?.({error:"No se pudo cargar PeerJS. Comprueba tu conexión a internet."});return;}
    if(peer){cb?.({error:"Ya has abierto una sala."});return;}
    isHost=true;roomCode=code();connecting=true;
    const id="tb26-"+roomCode;
    peer=new root.Peer(id);
    peer.on("open",()=>{
      connecting=false;local={id,name:name(payload?.name),hp:20,ready:false,board:null};
      players=[local];phase="lobby";round=0;
      cb?.({ok:true,code:roomCode,id});notify();
    });
    peer.on("connection",c=>{
      if(connection){c.on("open",()=>c.send({kind:"reject",error:"Sala completa."}));return;}
      setupConnection(c);
    });
    peer.on("error",e=>{if(connecting){connecting=false;const f=cb;cb=null;f?.({error:"No se pudo crear la sala: "+(e?.type||"error")});}else end("Error de conexión PeerJS.");});
  }
  function joinRoom(payload,cb){
    if(!root.Peer){cb?.({error:"No se pudo cargar PeerJS."});return;}
    if(peer){cb?.({error:"Ya tienes una conexión abierta."});return;}
    const requested=String(payload?.code||"").trim().toUpperCase();
    if(!/^[A-Z2-9]{6}$/.test(requested)){cb?.({error:"El código debe tener 6 caracteres."});return;}
    isHost=false;roomCode=requested;joinCallback=cb;connecting=true;
    peer=new root.Peer();
    peer.on("open",()=>{
      const c=peer.connect("tb26-"+roomCode,{reliable:true,serialization:"json"});
      setupConnection(c);
      c.on("open",()=>send({kind:"join",name:name(payload?.name)}));
      root.setTimeout(()=>{
        if(joinCallback){const callback=joinCallback;joinCallback=null;connecting=false;callback({error:"No se pudo contactar con esa sala. Comprueba el código o prueba otra red."});}
      },10000);
    });
    peer.on("error",e=>{
      if(joinCallback){const callback=joinCallback;joinCallback=null;connecting=false;callback({error:"No se pudo unir: "+(e?.type||"error")});}
      else end("La conexión se ha interrumpido.");
    });
  }
  root.TBNetwork={
    connect(){/* PeerJS creates the connection on room:create or room:join. */},
    on(event,callback){(events[event]||(events[event]=[])).push(callback);},
    emit(event,payload,cb){
      if(event==="room:create")return createRoom(payload,cb);
      if(event==="room:join")return joinRoom(payload,cb);
      if(event==="room:leave")return close();
      if(event==="round:ready"){
        if(isHost)return processReady(local?.id,payload?.board,cb||(()=>{}));
        if(!connection?.open){cb?.({error:"Tu rival está desconectado."});return;}
        readyCallback=cb;send({kind:"ready",board:payload?.board});
      }
    }
  };
})(window);
