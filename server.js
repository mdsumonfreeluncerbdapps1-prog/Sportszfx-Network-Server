const express = require("express");
const axios = require("axios");
const config = require("./config.json");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =======================
// API LINKS
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

  console.log("API Error:", err.message);
  return [];

 }

}


// =======================
// MATCH TYPE DETECT
// =======================

function detectMatchType(text){

 const type = text.match(/\d+(st|nd|rd|th)\s(Match|ODI|T20I|Test|T10)/i);

 if(type) return type[0];

 return "Match";

}


// =======================
// TEAM DETECT
// =======================

function detectTeams(text){

 const teams = text.match(/[A-Z][a-z]+(?:\s[A-Z][a-z]+)*/g);

 if(teams && teams.length >= 2){

  return [teams[teams.length-2], teams[teams.length-1]];

 }

 return [];

}


// =======================
// FORMAT MATCH TITLE
// =======================

function formatMatch(match){

 const name = match.match_name || "";

 const type = detectMatchType(name);

 const teams = detectTeams(name);

 if(teams.length === 2){

  return `${type} . ${teams[0]} VS ${teams[1]}`;

 }

 return type;

}


// =======================
// SCORE FORMAT
// =======================

function getScore(match){

 const name = formatMatch(match);

 const status = match.status || "Live";

 return `${name}

${status}

1 Refresh
0 Back`;

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

  const name = formatMatch(m);

  menu += `${i+1}. ${name}\n`;

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


  // MAIN MENU

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
// SERVER
// =======================

app.get("/",(req,res)=>{

 res.send("BDApps Cricket Server Running");

});

const PORT = process.env.PORT || config.server.port;

app.listen(PORT,()=>{

 console.log("Server running on port",PORT);

});
