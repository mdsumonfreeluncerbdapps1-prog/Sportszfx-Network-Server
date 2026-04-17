const express = require("express");
const axios = require("axios");
const config = require("./config.json");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =======================
// API ENDPOINTS
// =======================

const LIVE_API = "https://cricbuzz.autoaiassistant.com/api.php?action=live&type=all";
const UPCOMING_API = "https://cricbuzz.autoaiassistant.com/api.php?action=upcoming&type=all";
const RECENT_API = "https://cricbuzz.autoaiassistant.com/api.php?action=recent&type=all";
const DETAIL_API = "https://cricbuzz.autoaiassistant.com/api.php?action=match&id=";


// =======================
// SESSION STORAGE
// =======================

let sessions = {};
const SESSION_LIMIT = 5000;


// =======================
// FETCH MATCH LIST
// =======================

async function fetchMatches(url) {

 try {

  const res = await axios.get(url, { timeout: 5000 });

  if(Array.isArray(res.data)) return res.data;

  return [];

 } catch (err) {

  console.log("API Error:", err.message);
  return [];

 }

}


// =======================
// FETCH MATCH DETAIL
// =======================

async function fetchMatchDetail(matchId){

 try{

  const res = await axios.get(`${DETAIL_API}${matchId}`,{timeout:5000});

  return res.data || {};

 }catch(err){

  console.log("Detail API Error:",err.message);
  return {};

 }

}


// =======================
// SHORT MATCH TITLE
// =======================

function matchTitle(match){

 const name = match.match_name || "Match";

 // detect match type

 const typeMatch = name.match(/(\d+(st|nd|rd|th)\s(Test|ODI|T20I|Match))/i);

 const matchType = typeMatch ? typeMatch[0] : "Match";


 // detect teams from score array

 if(match.score && match.score.length >= 2){

  const t1 = match.score[0].team_name || "";
  const t2 = match.score[1].team_name || "";

  return `${matchType} . ${t1} VS ${t2}`;

 }

 return matchType;

}


// =======================
// SHOW MATCH LIST
// =======================

function showMatches(session){

 const start = session.page * 5;
 const end = start + 5;

 const list = session.matches.slice(start,end);

 let title = "Matches";

 if(session.type === "live") title = "Live Matches";
 if(session.type === "upcoming") title = "Upcoming Matches";
 if(session.type === "recent") title = "Recent Matches";

 let menu = `${title}\n\n`;

 list.forEach((m,i)=>{

  menu += `${start + i + 1}. ${matchTitle(m)}\n`;

 });

 if(end < session.matches.length){

  menu += `9 More Matches\n`;

 }

 menu += `0 Back`;

 return menu;

}


// =======================
// MATCH INFO FORMAT
// =======================

function formatMatchInfo(match,type){

 let text = `Match Information\n\n`;

 const name = match.match_name || "Match";

 const venue = match.location || "";

 text += `${name}\n\n`;

 if(match.score && match.score.length){

  match.score.forEach(team=>{

   const teamName = team.team_name || "";
   const score = team.scores ? team.scores[0] : "";

   text += `${teamName} ${score}\n`;

  });

  text += "\n";

 }

 if(type === "live"){

  text += `Venue: ${venue}\n`;
  text += `Status: Live\n\n`;

 }

 else if(type === "upcoming"){

  text += `Venue: ${venue}\n`;
  text += `Status: Upcoming\n\n`;

 }

 else if(type === "recent"){

  if(match.match_name){

   const resultMatch = match.match_name.match(/won by.*$/i);

   if(resultMatch){

    text += `${resultMatch[0]}\n\n`;

   }

  }

 }

 text += `1 Refresh\n0 Back`;

 return text;

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
    page:0,
    type:""

   };

  }

  const session = sessions[user];


  // START COMMAND

  if(message.includes(config.app.shortcode)){

   session.menu = "main";
   session.page = 0;

   return res.send(config.menu.main);

  }


  // ================= MAIN MENU =================

  if(session.menu === "main"){

   if(message === "1"){

    session.matches = await fetchMatches(LIVE_API);
    session.type = "live";

   }

   else if(message === "2"){

    session.matches = await fetchMatches(UPCOMING_API);
    session.type = "upcoming";

   }

   else if(message === "3"){

    session.matches = await fetchMatches(RECENT_API);
    session.type = "recent";

   }

   else{

    return res.send(config.menu.default);

   }

   session.menu = "matches";
   session.page = 0;

   if(session.matches.length === 0){

    return res.send("No matches available\n\n0 Back");

   }

   return res.send(showMatches(session));

  }


  // ================= MATCH LIST =================

  if(session.menu === "matches"){

   if(message === "0"){

    session.menu = "main";
    return res.send(config.menu.main);

   }

   if(message === "9"){

    session.page++;
    return res.send(showMatches(session));

   }


   const index = (session.page * 5) + (parseInt(message) - 1);


   if(session.matches[index]){

    const match = session.matches[index];

    const matchId = match.match_id || match.id;

    const detail = await fetchMatchDetail(matchId);

    session.selectedMatch = detail;
    session.menu = "score";

    return res.send(formatMatchInfo(detail,session.type));

   }

   return res.send("Invalid option\n\n0 Back");

  }


  // ================= MATCH INFO =================

  if(session.menu === "score"){

   if(message === "1"){

    const matchId = session.selectedMatch.match_id;

    const detail = await fetchMatchDetail(matchId);

    session.selectedMatch = detail;

    return res.send(formatMatchInfo(detail,session.type));

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
