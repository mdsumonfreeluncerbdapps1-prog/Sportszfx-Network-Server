const express = require("express");
const axios = require("axios");
const config = require("./config.json");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =======================
// API URL
// =======================

const LIVE_API =
"https://cricbuzz.autoaiassistant.com/api.php?action=live&type=all";

const UPCOMING_API =
"https://cricbuzz.autoaiassistant.com/api.php?action=upcoming&type=all";

const RECENT_API =
"https://cricbuzz.autoaiassistant.com/api.php?action=recent&type=all";


// =======================
// SESSION
// =======================

let sessions = {};
const SESSION_LIMIT = 5000;


// =======================
// MATCH PARSER
// =======================

function parseMatch(match){

 const name = match.match_name || "";

 // Detect match type
 const typeMatch = name.match(/(\d+(st|nd|rd|th)\sMatch|\d+(st|nd|rd|th)\sODI|\d+(st|nd|rd|th)\sT20I|\d+(st|nd|rd|th)\sTest|\d+(st|nd|rd|th)\sT10)/i);

 const matchType = typeMatch ? typeMatch[0] : "Match";

 let team1 = "";
 let team2 = "";

 // Detect VS
 const vsMatch = name.match(/([A-Za-z ]+)\s+vs\s+([A-Za-z ]+)/i);

 if(vsMatch){

  team1 = vsMatch[1].trim();
  team2 = vsMatch[2].trim();

 }else{

  const words = name.split(" ");
  team1 = words[words.length-2] || "";
  team2 = words[words.length-1] || "";

 }

 // Short team name
 const short = t => t.split(" ").map(w=>w[0]).join("").toUpperCase();

 team1 = short(team1);
 team2 = short(team2);

 return `${matchType} . ${team1} VS ${team2}`;
}


// =======================
// FETCH MATCHES
// =======================

async function fetchMatches(type){

 try{

  let url;

  if(type==="live") url = LIVE_API;
  if(type==="upcoming") url = UPCOMING_API;
  if(type==="recent") url = RECENT_API;

  const res = await axios.get(url);

  return res.data || [];

 }catch(e){

  console.log("API Error:",e.message);
  return [];

 }

}


// =======================
// MATCH LIST MENU
// =======================

function showMatches(session,title){

 const start = session.page*5;
 const end = start+5;

 const list = session.matches.slice(start,end);

 let menu = `${title}\n\n`;

 list.forEach((m,i)=>{

  const text = parseMatch(m);

  menu += `${i+1}. ${text}\n`;

 });

 if(end < session.matches.length){

  menu += `\n9 More Matches\n`;

 }

 menu += `0 Back`;

 return menu;

}


// =======================
// MATCH INFORMATION
// =======================

function getMatchInfo(match){

 const name = parseMatch(match);

 const venue = match.location || "";
 const time = match.start_date_time || "";
 const status = match.status || "";

 let score = "";

 if(match.score && match.score.length){

  score = match.score.join("\n");

 }

 let text = `Match Information\n\n${name}\n\n`;

 if(score) text += `${score}\n\n`;

 if(venue) text += `Venue: ${venue}\n`;

 if(time) text += `Date & Time: ${time}\n\n`;

 text += `${status}\n\n1 Refresh\n0 Back`;

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
    selected:null,
    page:0,
    type:""

   };

  }

  const session = sessions[user];


  // START

  if(message.includes(config.app.shortcode)){

   session.menu="main";
   session.page=0;

   return res.send(config.menu.main);

  }


  // MAIN MENU

  if(session.menu==="main"){

   if(message==="1"){

    session.matches = await fetchMatches("live");
    session.menu="matches";
    session.page=0;
    session.type="Live Matches";

    return res.send(showMatches(session,"Live Matches"));

   }

   if(message==="2"){

    session.matches = await fetchMatches("upcoming");
    session.menu="matches";
    session.page=0;
    session.type="Upcoming Matches";

    return res.send(showMatches(session,"Upcoming Matches"));

   }

   if(message==="3"){

    session.matches = await fetchMatches("recent");
    session.menu="matches";
    session.page=0;
    session.type="Recent Matches";

    return res.send(showMatches(session,"Recent Matches"));

   }

   return res.send(config.menu.default);

  }


  // MATCH LIST

  if(session.menu==="matches"){

   if(message==="0"){

    session.menu="main";

    return res.send(config.menu.main);

   }

   if(message==="9"){

    session.page++;

    return res.send(showMatches(session,session.type));

   }

   const index = (session.page*5)+(parseInt(message)-1);

   if(session.matches[index]){

    const match = session.matches[index];

    session.selected = match;
    session.menu="info";

    return res.send(getMatchInfo(match));

   }

   return res.send("Invalid Option\n\n0 Back");

  }


  // MATCH INFO

  if(session.menu==="info"){

   if(message==="1"){

    return res.send(getMatchInfo(session.selected));

   }

   if(message==="0"){

    session.menu="matches";

    return res.send(showMatches(session,session.type));

   }

  }

  return res.send(config.menu.default);

 }catch(e){

  console.log("SMS Error:",e.message);

  res.send("Service temporarily unavailable");

 }

});


// =======================
// HEALTH CHECK
// =======================

app.get("/",(req,res)=>{

 res.send("Cricket Server Running");

});


// =======================
// SERVER START
// =======================

const PORT = process.env.PORT || config.server.port;

app.listen(PORT,()=>{

 console.log("Server running on port",PORT);

});
