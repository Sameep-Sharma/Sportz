
#Core Learnings-:

-Core Mechanics of Web Sockets
-How a webSocket starts life as HTTP
-What 101 switching protocols response actually does
-how full duplex communication let data serve instantly
-how to keep 1000s connection stable
-how ghost connections silently kill servers
-ping pong heartbeats
-how to strucuture messages so the server always knows the intent
-broadcast----unicast----rooms
-pub and sub architecture
-acknowledgements for reliability
-how back pressure forms 
-how real systems avoid memory blowups

#Tech Stack -: 
React.js
Node.js
Express.js
PostgreSQL
ws library
Arcjet
CodeRabbit


__bold__How WebSockets States-:
Connect: 0------Open :1-----Closing:2------Closed:3

Server Side events-:
client connects
sending data to client
disconnecting client
crashing

wss.on('connection',(socket, request)=>{
  console.log('Client connected', request.socket.remoteAddress);
})

in ws usually message arrives as a buffer, so we need to convert it to string before using it.

socket.on('message',(raw)=>{
  const text = raw.toString();
  console.log('Message from client:', text);
});

error

socket.on('error',(err)=>{
  console.log('Error:', err.message);
});


Client Side events-:
open

socket.addEventListener('open',()=>{
  console.log('Connected to server');
  socket.send('Hello Server!');
});

message

socket.addEventListener('message',(event)=>{
  const data = JSON.parse(event.data);
  console.log('New Data', data);
});

close

socket.addEventListener('close',(event)=>{
  console.log('Connection closed', event.code, event.reason);
});

#Summary-:
// SERVER(ws)

wss.on("connection",(ws)=>{
  ws.on("message",(data)=>{})
  ws.on("error",(err)=>{})
  ws.on("close",(code, reason)=>{})
})

//CLIENT (ws)

const socket = new WebSocket("ws://localhost:8080");
socket.onopen = () => {};
socket.onmessage = (event) => {};
socket.onerror = (error) => {};
socket.onclose = (event) => {};




