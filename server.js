const express = require("express");
const axios = require("axios");
const config = require("./config.json");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =======================
// API
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


// =======================
// FETCH MATCH
// =======================

async function fetchMatches(url){

 try{

  const res = await axios.get(url);

  if(Array.isArray(res.data)) return res.data;

  return [];

 }catch(e){

  console.log(e.message);
  return [];

 }

}


// =======================
// FETCH DETAIL
// =======================

async function fetchMatchDetail(id){

 try{

  const res = await axios.get(`${DETAIL_API}${id}`);

  return res.data || {};

 }catch(e){

  return {};

 }

}


// =======================
// TEAM SHORT CODE
// =======================

function shortTeam(name){

 if(!name) return "";

 return name
 .split(" ")
 .map(w => w[0])
 .join("")
 .toUpperCase()
 .substring(0,3);

}


// =======================
// MATCH TITLE PARSER
// =======================

function matchTitle(match){

 const name = match.match_name || "";

 // detect match type
 const typeMatch =
 name.match(/(\d+(st|nd|rd|th)\sMatch|\d+(st|nd|rd|th)\sODI|\d+(st|nd|rd|th)\sT20I|\d+(st|nd|rd|th)\sTest|\d+(st|nd|rd|th)\sunofficial\sTest)/i);

 const matchType = typeMatch ? typeMatch[0] : "Match";

 // detect teams using score pattern
 const teams =
 name.match(/([A-Za-z ]+)\s\d+[-\/]\d+.*?([A-Za-z ]+)\sDay/i);

 if(teams){

  const t1 = shortTeam(teams[1]);
  const t2 = shortTeam(teams[2]);

  return `${matchType} . ${t1} VS ${t2}`;

 }

 return matchType;

}


// =======================
// MATCH LIST
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
// MATCH INFO
// =======================

function formatMatchInfo(match,type){

 let text="Match Information\n\n";

 text += `${match.match_name || ""}\n\n`;

 if(type==="live"){

  text+="Live\n\n";

 }

 if(type==="upcoming"){

  text+="Upcoming\n\n";

 }

 if(type==="recent"){

  if(match.result) text+=`${match.result}\n\n`;

 }

 text+="1 Refresh\n0 Back";

 return text;

}


// =======================
// SMS LISTENER
// =======================

app.post("/sms_listener", async(req,res)=>{

 const msg=(req.body.message||"").trim().toLowerCase();
 const user=req.body.sourceAddress || "demo";

 if(!sessions[user]){

  sessions[user]={

   menu:"main",
   matches:[],
   page:0,
   type:"",
   matchId:null

  };

 }

 const s=sessions[user];

 if(msg.includes(config.app.shortcode)){

  s.menu="main";
  return res.send(config.menu.main);

 }


 // MAIN MENU

 if(s.menu==="main"){

  if(msg==="1"){

   s.matches=await fetchMatches(LIVE_API);
   s.type="live";

  }

  else if(msg==="2"){

   s.matches=await fetchMatches(UPCOMING_API);
   s.type="upcoming";

  }

  else if(msg==="3"){

   s.matches=await fetchMatches(RECENT_API);
   s.type="recent";

  }

  else{

   return res.send(config.menu.default);

  }

  s.menu="matches";
  s.page=0;

  return res.send(showMatches(s));

 }


 // MATCH LIST

 if(s.menu==="matches"){

  if(msg==="0"){

   s.menu="main";
   return res.send(config.menu.main);

  }

  if(msg==="9"){

   s.page++;
   return res.send(showMatches(s));

  }

  const index=(s.page*5)+(parseInt(msg)-1);

  if(s.matches[index]){

   const match=s.matches[index];

   s.matchId=match.match_id;
   s.menu="score";

   const detail=await fetchMatchDetail(s.matchId);

   return res.send(formatMatchInfo(detail,s.type));

  }

 }


 // SCORE PAGE

 if(s.menu==="score"){

  if(msg==="1"){

   const detail=await fetchMatchDetail(s.matchId);

   return res.send(formatMatchInfo(detail,s.type));

  }

  if(msg==="0"){

   s.menu="matches";

   return res.send(showMatches(s));

  }

 }

 res.send(config.menu.default);

});


// =======================
// HEALTH
// =======================

app.get("/",(req,res)=>{

 res.send("Cricket Server Running");

});


// =======================
// START
// =======================

const PORT=process.env.PORT || config.server.port;

app.listen(PORT,()=>{

 console.log("Server running on",PORT);

});
