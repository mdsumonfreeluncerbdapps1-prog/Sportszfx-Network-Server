const express = require("express");
const axios = require("axios");
const config = require("./config.json");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =======================
// API CONFIG
// =======================

const LIVE_API = "https://cricbuzz.autoaiassistant.com/api.php?action=live&type=all";
const UPCOMING_API = "https://cricbuzz.autoaiassistant.com/api.php?action=upcoming&type=all";
const RECENT_API = "https://cricbuzz.autoaiassistant.com/api.php?action=recent&type=all";

// =======================
// SESSION
// =======================

let sessions = {};
const SESSION_LIMIT = 5000;

// =======================
// FETCH MATCHES
// =======================

async function fetchMatches(url){

 try{

  const res = await axios.get(url);

  return res.data || [];

 }catch(err){

  console.log("API Error:",err.message);
  return [];

 }

}

// =======================
// SCORE FORMAT
// =======================

function getScore(match){

 const team1 = match.team1 || match.team1_name || match.home || "Team 1";
 const team2 = match.team2 || match.team2_name || match.away || "Team 2";

 const name = `${team1} vs ${team2}`;

 const score = match.score || match.match_score || "Score not available";

 const status = match.status || match.match_status || "";

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

  const team1 = m.team1 || m.team1_name || m.home || "Team 1";
  const team2 = m.team2 || m.team2_name || m.away || "Team 2";

  menu += `${i+1}. ${team1} vs ${team2}\n`;

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

  const message = (req.body.message || "").toLowerCase().trim();
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

  if(message.includes(config.app.shortcode)){

   session.menu = "main";
   session.page = 0;

   return res.send(config.menu.main);

  }

  // MAIN MENU

  if(session.menu === "main"){

   if(message === "1"){
    session.matches = await fetchMatches(LIVE_API);
   }

   else if(message === "2"){
    session.matches = await fetchMatches(UPCOMING_API);
   }

   else if(message === "3"){
    session.matches = await fetchMatches(RECENT_API);
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
