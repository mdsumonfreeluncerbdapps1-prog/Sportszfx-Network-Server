const express = require("express");
const axios = require("axios");
const config = require("./config.json");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =======================
// API CONFIG
// =======================

const API_KEY = "5c9d00ec-b548-4929-bbec-ba3b86444270";
const API_URL = "https://api.cricapi.com/v1";

// =======================
// SESSION
// =======================

let sessions = {};
const SESSION_LIMIT = 5000;

// =======================
// MATCH PRIORITY SYSTEM
// =======================

function getPriority(match){

 const name = (match.name || "").toLowerCase();
 const status = (match.status || "").toLowerCase();

 // LIVE MATCH FIRST
 if(match.matchStarted && !match.matchEnded){
  return 0;
 }

 // INDIA / PAKISTAN / BANGLADESH
 if(
  name.includes("india") ||
  name.includes("pakistan") ||
  name.includes("bangladesh")
 ){
  return 1;
 }

 // IPL
 if(name.includes("indian premier league") || name.includes("ipl")){
  return 2;
 }

 // BPL
 if(name.includes("bangladesh premier league") || name.includes("bpl")){
  return 3;
 }

 // WORLD CUP
 if(name.includes("world cup")){
  return 4;
 }

 // ASIA CUP
 if(name.includes("asia cup")){
  return 5;
 }

 // INTERNATIONAL TEAMS
 const bigTeams = [
  "australia",
  "england",
  "south africa",
  "new zealand",
  "sri lanka",
  "afghanistan",
  "west indies"
 ];

 if(bigTeams.some(t => name.includes(t))){
  return 6;
 }

 // SMALL LEAGUE
 if(
  name.includes("cyprus") ||
  name.includes("malta") ||
  name.includes("croatia")
 ){
  return 50;
 }

 return 20;

}

// =======================
// FETCH MATCHES
// =======================

async function fetchAllMatches(){

 try{

  const res = await axios.get(`${API_URL}/matches?apikey=${API_KEY}`);

  let matches = res.data.data || [];

  matches.sort((a,b)=> getPriority(a) - getPriority(b));

  return matches;

 }catch(err){

  console.log("API Error:",err.message);
  return [];

 }

}

// =======================
// FILTER MATCHES
// =======================

function getLive(matches){

 const live = matches.filter(
  m => m.matchStarted === true && m.matchEnded === false
 );

 return live.sort((a,b)=> getPriority(a) - getPriority(b));

}

function getUpcoming(matches){

 const upcoming = matches.filter(
  m => m.matchStarted === false
 );

 return upcoming.sort((a,b)=> getPriority(a) - getPriority(b));

}

function getRecent(matches){

 const recent = matches.filter(
  m => m.matchEnded === true
 );

 return recent.sort((a,b)=> getPriority(a) - getPriority(b));

}

// =======================
// SCORE FORMAT
// =======================

function getScore(match){

 const name = match.name || "Match";

 let score = "Score not available";

 if(match.score && match.score.length > 0){

  const scores = match.score.map(
   s => `${s.r}/${s.w} (${s.o} ov)`
  );

  score = scores.join(" | ");

 }

 const status = match.status || "";

 return `${name}

Score: ${score}

${status}

1 Refresh
0 Back`;

}

// =======================
// MATCH LIST MENU
// =======================

function showMatches(session){

 const start = session.page * 5;
 const end = start + 5;

 const list = session.matches.slice(start,end);

 let menu = `Matches\n\n`;

 list.forEach((m,i)=>{
  menu += `${i+1}. ${m.name}\n`;
 });

 if(end < session.matches.length){
  menu += `9 More Matches\n`;
 }

 menu += `0 Back`;

 return menu;

}

// =======================
// SMS LISTENER
// =======================

app.post("/sms_listener", async (req,res)=>{

 try{

  const message = (req.body.message || "").trim().toLowerCase();
  const user = req.body.sourceAddress || "demo";

  if(Object.keys(sessions).length > SESSION_LIMIT){
   sessions = {};
  }

  if(!sessions[user]){

   sessions[user] = {
    menu:"main",
    matches:[],
    selectedMatch:null,
    page:0
   };

  }

  const session = sessions[user];

  // START

  if(message === config.app.shortcode || message === "cricketscoreupdate"){

   session.menu = "main";
   session.page = 0;

   return res.send(config.menu.main);

  }

  // MAIN MENU

  if(session.menu === "main"){

   const all = await fetchAllMatches();

   if(message === "1"){
    session.matches = getLive(all);
   }

   else if(message === "2"){
    session.matches = getUpcoming(all);
   }

   else if(message === "3"){
    session.matches = getRecent(all);
   }

   else{
    return res.send(config.menu.default);
   }

   session.menu = "matches";
   session.page = 0;

   if(session.matches.length === 0){

    return res.send(`No matches available

0 Back`);

   }

   return res.send(showMatches(session));

  }

  // MATCH LIST

  if(session.menu === "matches"){

   if(message === "0"){

    session.menu = "main";
    return res.send(config.menu.main);

   }

   if(message === "9"){

    session.page++;
    return res.send(showMatches(session));

   }

   const index = (session.page*5) + (parseInt(message)-1);

   if(session.matches[index]){

    const match = session.matches[index];

    session.selectedMatch = match;
    session.menu = "score";

    return res.send(getScore(match));

   }

   return res.send("Invalid option\n\n0 Back");

  }

  // SCORE MENU

  if(session.menu === "score"){

   if(message === "1"){
    return res.send(getScore(session.selectedMatch));
   }

   if(message === "0"){

    session.menu = "matches";
    return res.send(showMatches(session));

   }

  }

  return res.send(config.menu.default);

 }catch(err){

  console.log("SMS Error:",err.message);
  res.send("Service temporarily unavailable");

 }

});

// =======================
// HEALTH CHECK
// =======================

app.get("/",(req,res)=>{
 res.send("BDApps Cricket Server Running");
});

// =======================
// SERVER START
// =======================

const PORT = process.env.PORT || config.server.port;

app.listen(PORT,()=>{
 console.log("Server running on port",PORT);
});
