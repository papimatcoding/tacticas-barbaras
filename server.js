"use strict";
const express=require("express");
const http=require("http");
const {Server}=require("socket.io");
const path=require("path");
const {simulate}=require("./shared/combat");
const app=express(), httpServer=http.createServer(app);
const io=new Server(httpServer,{cors:{origin:false}});
const rooms=new Map();
const PORT=Number(process.env.PORT)||3000;

app.use(express.static(path.join(__dirname,"public")));
app.get("/shared/combat.js",(_req,res)=>res.sendFile(path.join(__dirname,"shared/combat.js")));
app.get("/health",(_req,res)=>res.json({ok:true,rooms:rooms.size}));

function makeCode(){
  const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do{code=Array.from({length:6},()=>alphabet[Math.floor(Math.random()*alphabet.length)]).join("");}while(rooms.has(code));
  return code;
}
function getRoom(socket){return rooms.get(socket.data.roomCode);}
function state(room){
  return {code:room.code,round:room.round,phase:room.phase,
    players:room.players.map(p=>({id:p.id,name:p.name,hp:p.hp,ready:!!p.ready}))};
}
function notify(room){io.to(room.code).emit("room:state",state(room));}
function startRound(room){
  if(room.players.length!==2)return;
  room.round++;
  room.phase="prepare";
  room.players.forEach(p=>{p.ready=false;p.board=null;});
  io.to(room.code).emit("round:start",state(room));
}
function safeName(n){return String(n||"Jugador").trim().slice(0,18)||"Jugador";}
function validateBoard(board){
  if(!Array.isArray(board)||board.length>5)return null;
  const spots=new Set();
  const roster=require("./shared/combat").DATA;
  const clean=[];
  for(const item of board){
    const x=Number(item?.x),y=Number(item?.y),star=Number(item?.star);
    if(!roster[item?.type]||!Number.isInteger(x)||!Number.isInteger(y)||
       x<0||x>4||y<0||y>3||![1,2,3].includes(star)||spots.has(x+":"+y))return null;
    spots.add(x+":"+y);
    clean.push({type:item.type,x,y,star});
  }
  return clean;
}
function disconnectFromRoom(socket){
  const room=getRoom(socket);
  if(!room)return;
  const quitter=room.players.find(p=>p.id===socket.id);
  room.players=room.players.filter(p=>p.id!==socket.id);
  socket.leave(room.code);
  socket.data.roomCode=null;
  io.to(room.code).emit("room:ended",{message:(quitter?.name||"Un jugador")+" ha abandonado la partida."});
  rooms.delete(room.code);
}
io.on("connection",socket=>{
  socket.on("room:create",(payload,cb)=>{
    if(socket.data.roomCode)return cb?.({error:"Ya estás en una sala."});
    const code=makeCode();
    const room={code,round:0,phase:"lobby",players:[{id:socket.id,name:safeName(payload?.name),hp:20,ready:false,board:null}]};
    rooms.set(code,room);socket.data.roomCode=code;socket.join(code);
    cb?.({ok:true,code,id:socket.id});notify(room);
  });
  socket.on("room:join",(payload,cb)=>{
    if(socket.data.roomCode)return cb?.({error:"Ya estás en una sala."});
    const code=String(payload?.code||"").trim().toUpperCase();
    const room=rooms.get(code);
    if(!room)return cb?.({error:"No existe esa sala."});
    if(room.players.length>=2||room.phase!=="lobby")return cb?.({error:"La sala no admite más jugadores."});
    room.players.push({id:socket.id,name:safeName(payload?.name),hp:20,ready:false,board:null});
    socket.data.roomCode=code;socket.join(code);
    cb?.({ok:true,code,id:socket.id});notify(room);startRound(room);
  });
  socket.on("round:ready",(payload,cb)=>{
    const room=getRoom(socket);
    if(!room||room.phase!=="prepare")return cb?.({error:"No estamos en preparación."});
    const p=room.players.find(p=>p.id===socket.id);
    if(!p||p.ready)return cb?.({error:"Ya estás listo."});
    const board=validateBoard(payload?.board);
    if(!board||board.length===0)return cb?.({error:"Coloca al menos una unidad válida."});
    p.board=board;p.ready=true;cb?.({ok:true});notify(room);
    if(room.players.length!==2||!room.players.every(p=>p.ready))return;
    room.phase="combat";
    const result=simulate(room.players[0].board,room.players[1].board,room.round*9719);
    const winner=result.winner==="a"?room.players[0]:result.winner==="b"?room.players[1]:null;
    const loser=winner?room.players.find(p=>p!==winner):null;
    if(loser)loser.hp=Math.max(0,loser.hp-(3+Math.min(3,room.round)));
    io.to(room.code).emit("round:result",{result,round:room.round,
      sides:{a:room.players[0].id,b:room.players[1].id},state:state(room)});
    notify(room);
    setTimeout(()=>{
      if(!rooms.has(room.code))return;
      if(room.players.some(p=>p.hp<=0)){
        room.phase="finished";
        io.to(room.code).emit("game:over",state(room));
      }else startRound(room);
    },15000);
  });
  socket.on("room:leave",()=>disconnectFromRoom(socket));
  socket.on("disconnect",()=>disconnectFromRoom(socket));
});
httpServer.listen(PORT,()=>console.log("Tácticas Bárbaras en http://localhost:"+PORT));
