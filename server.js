const express = require("express");
const axios = require("axios");
const config = require("./config.json");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =======================
// API ENDPOINTS
// =======================

const LIVE_API =
"https://cricbuzz.autoaiassistant.com/api.php?action=live&type=all";

const UPCOMING_API =
"https://cricbuzz.autoaiassistant.com/api.php?action=upcoming&type=all";

const RECENT_API =
"https://cricbuzz.autoaiassistant.com/api.php?action=recent&type=all";

const DETAIL_API =
"https://cricbuzz.autoaiassistant.com/api.php?action=match&id=";


// =======================
// SESSION
// =======================

let sessions = {};
const SESSION_LIMIT = 5000;


// =======================
// FETCH MATCH LIST
// =======================

async function fetchMatches(url){

 try{

  const res = await axios.get(url);

  if(Array.isArray(res.data)) return res.data;
  if(res.data.data) return res.data.data;

  return [];

 }catch(err){

  console.log("API Error:",err.message);
  return [];

 }

}


// =======================
// FETCH MATCH DETAIL
// =======================

async function fetchMatchDetail(matchId){

 try{

  const res = await axios.get(`${DETAIL_API}${matchId}`);

  if(res.data.data) return res.data.data;

  return res.data;

 }catch(err){

  console.log("Detail API Error:",err.message);
  return {};

 }

}


// =======================
// MATCH TITLE PARSER
// =======================

function matchTitle(match){

 const name = match.match_name || "";

 // match type detect
 const typeMatch =
 name.match(/(\d+(st|nd|rd|th)\sMatch|\d+(st|nd|rd|th)\sODI|\d+(st|nd|rd|th)\sT20I|\d+(st|nd|rd|th)\sTest|\d+(st|nd|rd|th)\sT10)/i);

 const matchType = typeMatch ? typeMatch[0] : "Match";

 // team detect
 const vsMatch = name.match(/([A-Za-z]+)\s+vs\s+([A-Za-z]+)/i);

 if(vsMatch){

  const team1 = vsMatch[1].substring(0,3).toUpperCase();
  const team2 = vsMatch[2].substring(0,3).toUpperCase();

  return `${matchType} . ${team1} VS ${team2}`;

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

 if(session.type==="live") title="Live Matches";
 if(session.type==="upcoming") title="Upcoming Matches";
 if(session.type==="recent") title="Recent Matches";

 let menu = `${title}\n\n`;

 list.forEach((m,i)=>{

  menu += `${i+1}. ${matchTitle(m)}\n`;

 });

 if(end < session.matches.length){

  menu += "9 More Matches\n";

 }

 menu += "0 Back";

 return menu;

}


// =======================
// MATCH INFO FORMAT
// =======================

function formatMatchInfo(match,type){

 let text = `Match Information\n\n`;

 const name = match.match_name || "";

 const score1 = match.team1_score || "";
 const score2 = match.team2_score || "";

 const venue = match.location || "";

 text += `${name}\n\n`;

 if(type==="live"){

  if(score1) text += `${score1}\n`;
  if(score2) text += `${score2}\n\n`;

  text += `Venue: ${venue}\n`;
  text += `Live\n\n`;

 }

 else if(type==="upcoming"){

  const date = match.start_date_time || "";

  text += `Venue: ${venue}\n`;
  text += `Date: ${date}\n\n`;
  text += `Upcoming\n\n`;

 }

 else if(type==="recent"){

  if(score1) text += `${score1}\n`;
  if(score2) text += `${score2}\n\n`;

  if(match.result){

   text += `${match.result}\n\n`;

  }

 }

 text += "1 Refresh\n0 Back";

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
    type:"",
    matchId:null

   };

  }

  const session = sessions[user];


  // start command

  if(message.includes(config.app.shortcode)){

   session.menu="main";
   session.page=0;

   return res.send(config.menu.main);

  }


  // ================= MAIN MENU =================

  if(session.menu==="main"){

   if(message==="1"){

    session.matches = await fetchMatches(LIVE_API);
    session.type="live";

   }

   else if(message==="2"){

    session.matches = await fetchMatches(UPCOMING_API);
    session.type="upcoming";

   }

   else if(message==="3"){

    session.matches = await fetchMatches(RECENT_API);
    session.type="recent";

   }

   else{

    return res.send(config.menu.default);

   }

   session.menu="matches";
   session.page=0;

   if(session.matches.length===0){

    return res.send("No matches available\n\n0 Back");

   }

   return res.send(showMatches(session));

  }


  // ================= MATCH LIST =================

  if(session.menu==="matches"){

   if(message==="0"){

    session.menu="main";

    return res.send(config.menu.main);

   }

   if(message==="9"){

    session.page++;

    return res.send(showMatches(session));

   }

   const index=(session.page*5)+(parseInt(message)-1);

   if(session.matches[index]){

    const match=session.matches[index];

    const matchId = match.match_id || match.id;

    const detail = await fetchMatchDetail(matchId);

    session.selectedMatch = detail;
    session.matchId = matchId;
    session.menu="score";

    return res.send(formatMatchInfo(detail,session.type));

   }

   return res.send("Invalid option\n\n0 Back");

  }


  // ================= MATCH INFO =================

  if(session.menu==="score"){

   if(message==="1"){

    const detail = await fetchMatchDetail(session.matchId);

    session.selectedMatch = detail;

    return res.send(
     formatMatchInfo(detail,session.type)
    );

   }

   if(message==="0"){

    session.menu="matches";

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
