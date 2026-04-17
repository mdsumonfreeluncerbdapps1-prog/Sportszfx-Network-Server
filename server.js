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
// API CACHE
// =======================

let cache = {
 live: { data: [], time: 0 },
 upcoming: { data: [], time: 0 },
 recent: { data: [], time: 0 }
};

const CACHE_TIME = 20000;


// =======================
// TEAM CACHE (NEW)
// =======================

let teamCache = {};


// =======================
// REMOVE DUPLICATE MATCHES
// =======================

function removeDuplicates(matches){

 const seen = new Set();

 return matches.filter(m => {

  const key = m.match_id || m.id || m.match_name;

  if(seen.has(key)) return false;

  seen.add(key);
  return true;

 });

}


// =======================
// FETCH MATCH LIST
// =======================

async function fetchMatches(type, url){

 try{

  const now = Date.now();

  if(cache[type].data.length > 0 && now - cache[type].time < CACHE_TIME){
   return cache[type].data;
  }

  const res = await axios.get(url);

  cache[type].data = removeDuplicates(res.data || []);
  cache[type].time = now;

  return cache[type].data;

 }catch(err){

  console.log("API Error:", err.message);
  return [];

 }

}


// =======================
// FETCH MATCH DETAIL
// =======================

async function fetchMatchDetail(matchId){

 try{

  const res = await axios.get(`${DETAIL_API}${matchId}`);
  return res.data || {};

 }catch(err){

  console.log("Detail API Error:", err.message);
  return {};

 }

}


// =======================
// MATCH TITLE WITH TEAM FALLBACK
// =======================

async function matchTitle(match){

 const name = (match.match_name || "").toUpperCase();

 const typeMatch =
 name.match(/(\d+(ST|ND|RD|TH)\s(TEST|ODI|T20I|MATCH))/i);

 const matchType = typeMatch ? typeMatch[0] : "MATCH";

 let team1 = "";
 let team2 = "";

 // case 1: team field
 if(match.team1 && match.team2){
  team1 = (match.team1.short_name || match.team1.name || "").toUpperCase();
  team2 = (match.team2.short_name || match.team2.name || "").toUpperCase();
 }

 // case 2: teams array
 else if(match.teams && match.teams.length >= 2){
  team1 = (match.teams[0].short_name || match.teams[0].name || "").toUpperCase();
  team2 = (match.teams[1].short_name || match.teams[1].name || "").toUpperCase();
 }

 // case 3: detect from match name
 else{

  const teamMatch =
  name.match(/([A-Z]{2,4})\sVS\s([A-Z]{2,4})/i);

  if(teamMatch){
   team1 = teamMatch[1];
   team2 = teamMatch[2];
  }

 }

 // =========================
 // FALLBACK USING MATCH ID
 // =========================

 if((!team1 || !team2) && (match.match_id || match.id)){

  const id = match.match_id || match.id;

  if(teamCache[id]){
   return `${matchType} . ${teamCache[id]}`;
  }

  const detail = await fetchMatchDetail(id);

  if(detail.team1 && detail.team2){

   const t1 = (detail.team1.short_name || detail.team1.name || "").toUpperCase();
   const t2 = (detail.team2.short_name || detail.team2.name || "").toUpperCase();

   teamCache[id] = `${t1} VS ${t2}`;

   return `${matchType} . ${t1} VS ${t2}`;
  }

 }

 if(team1 && team2){
  return `${matchType} . ${team1} VS ${team2}`;
 }

 return matchType;

}


// =======================
// SHOW MATCH LIST
// =======================

async function showMatches(session){

 const start = session.page * 5;
 const end = start + 5;

 const list = session.matches.slice(start,end);

 let title = "Matches";

 if(session.type === "live") title = "Live Matches";
 if(session.type === "upcoming") title = "Upcoming Matches";
 if(session.type === "recent") title = "Recent Matches";

 let menu = `${title}\n\n`;

 for(let i=0;i<list.length;i++){

  const titleText = await matchTitle(list[i]);

  menu += `${start + i + 1}. ${titleText}\n`;

 }

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

 const name = match.match_name || "";
 const venue = match.location || "";
 const score = match.score || [];

 text += `${name}\n\n`;

 if(score.length){

  score.forEach(t=>{
   if(t.team_name && t.scores){
    text += `${t.team_name} ${t.scores[0] || ""}\n`;
   }
  });

  text += `\n`;

 }else{

  text += `Score: Not started\n\n`;

 }

 if(type === "live"){

  text += `Venue: ${venue}\n`;
  text += `Status: Live\n\n`;

 }

 if(type === "upcoming"){

  const date = match.start_date_time || "";

  text += `Venue: ${venue}\n`;
  text += `Date: ${date}\n\n`;

 }

 if(type === "recent"){

  if(match.result){
   text += `${match.result}\n\n`;
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


// ================= START KEYWORD =================

  if(message.includes(config.app.shortcode.toLowerCase())){

   session.menu = "main";
   session.page = 0;

   return res.send(config.menu.main);

  }


// ================= MAIN MENU =================

  if(session.menu === "main"){

   if(message === "1"){
    session.matches = await fetchMatches("live", LIVE_API);
    session.type = "live";
   }

   else if(message === "2"){
    session.matches = await fetchMatches("upcoming", UPCOMING_API);
    session.type = "upcoming";
   }

   else if(message === "3"){
    session.matches = await fetchMatches("recent", RECENT_API);
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

   return res.send(await showMatches(session));

  }


// ================= MATCH LIST =================

  if(session.menu === "matches"){

   if(message === "0"){
    session.menu = "main";
    return res.send(config.menu.main);
   }

   if(message === "9"){
    session.page++;
    return res.send(await showMatches(session));
   }

   const index = session.page * 5 + (parseInt(message) - 1);

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

    const matchId =
    session.selectedMatch.match_id ||
    session.selectedMatch.id;

    const detail = await fetchMatchDetail(matchId);

    session.selectedMatch = detail;

    return res.send(
     formatMatchInfo(detail,session.type)
    );

   }

   if(message === "0"){
    session.menu = "matches";
    return res.send(await showMatches(session));
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


// =======================
// SERVER CRASH PROTECTION
// =======================

process.on("uncaughtException", err => {
 console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", err => {
 console.error("Unhandled Rejection:", err);
});
