const express = require("express");
const axios = require("axios");
const config = require("./config.json");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =======================
// CRICKET API CONFIG
// =======================

const API_KEY = process.env.CRIC_API_KEY || "YOUR_API_KEY";
const API_URL = "https://api.cricapi.com/v1";

// =======================
// USER SESSIONS
// =======================

let sessions = {};
let matchCache = {};
let cacheTimestamp = {};

// =======================
// CACHE SETTINGS
// =======================

const CACHE_TIME = 15000;
const SESSION_LIMIT = 5000;

// =======================
// FETCH MATCHES
// =======================

async function fetchMatches(type) {

  try {

    const response = await axios.get(
      `${API_URL}/${type}?apikey=${API_KEY}&offset=0`
    );

    if (!response.data || !response.data.data) return [];

    return response.data.data;

  } catch (error) {

    console.log("Match API Error:", error.message);
    return [];

  }

}

// =======================
// FETCH SCORE
// =======================

async function updateScoreCache(matchId){

  try{

    const now = Date.now();

    if(
      matchCache[matchId] &&
      cacheTimestamp[matchId] &&
      now - cacheTimestamp[matchId] < CACHE_TIME
    ){
      return;
    }

    const response = await axios.get(
      `${API_URL}/match_info?apikey=${API_KEY}&id=${matchId}`
    );

    if(response.data && response.data.data){

      matchCache[matchId] = response.data.data;
      cacheTimestamp[matchId] = now;

    }

  }catch(err){

    console.log("Score API Error:", err.message);

  }

}

// =======================
// CLEAN OLD CACHE
// =======================

setInterval(()=>{

  const now = Date.now();

  Object.keys(cacheTimestamp).forEach(id=>{

    if(now - cacheTimestamp[id] > 600000){

      delete matchCache[id];
      delete cacheTimestamp[id];

    }

  });

},600000);

// =======================
// SCORE FORMAT
// =======================

function getScore(match){

  const name = match.name || "Match";

  let scoreText = "Score not available";

  if(match.score && match.score.length > 0){

    const scores = match.score.map(
      s => `${s.r}/${s.w} (${s.o} ov)`
    );

    scoreText = scores.join(" | ");

  }

  const status = match.status || "";

  return `${name}

Score: ${scoreText}

${status}

1. Refresh
0. Back`;

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
        selectedMatch:null
      };

    }

    const session = sessions[user];

    // =====================
    // START COMMAND
    // =====================

    if(message === config.app.shortcode || message === "cricketscoreupdate"){

      session.menu = "main";
      session.selectedMatch = null;

      return res.send(config.menu.main);

    }

    // =====================
    // MAIN MENU
    // =====================

    if(session.menu === "main"){

      if(message === "1"){

        session.matches = await fetchMatches("currentMatches");
        session.menu = "matches";

      }

      else if(message === "2"){

        const all = await fetchMatches("matches");
        session.matches = all.filter(m => !m.matchStarted);
        session.menu = "matches";

      }

      else if(message === "3"){

        const all = await fetchMatches("matches");
        session.matches = all.filter(m => m.matchStarted && m.matchEnded);
        session.menu = "matches";

      }

      else{

        return res.send(config.menu.default);

      }

      if(session.matches.length === 0){

        return res.send(`No matches available

0. Back`);

      }

      let menu = `${config.menu.matches}

`;

      session.matches.slice(0,5).forEach((m,i)=>{

        menu += `${i+1}. ${m.name}
`;

      });

      menu += `
0. Back`;

      return res.send(menu);

    }

    // =====================
    // MATCH SELECT
    // =====================

    if(session.menu === "matches"){

      if(message === "0"){

        session.menu = "main";
        return res.send(config.menu.main);

      }

      const index = parseInt(message)-1;

      if(session.matches[index]){

        const match = session.matches[index];

        session.selectedMatch = match;
        session.menu = "score";

        await updateScoreCache(match.id);

        return res.send(getScore(matchCache[match.id] || match));

      }

      return res.send("Invalid option\n\n0. Back");

    }

    // =====================
    // SCORE MENU
    // =====================

    if(session.menu === "score"){

      if(message === "1"){

        await updateScoreCache(session.selectedMatch.id);

        const match =
          matchCache[session.selectedMatch.id] ||
          session.selectedMatch;

        return res.send(getScore(match));

      }

      if(message === "0"){

        session.menu = "main";
        session.selectedMatch = null;

        return res.send(config.menu.main);

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

  res.send("BDapps Cricket Server Running");

});

// =======================
// DEBUG API
// =======================

app.get("/api/live", async (req,res)=>{

  const matches = await fetchMatches("currentMatches");

  res.json(matches);

});

// =======================
// SERVER START
// =======================

const PORT = process.env.PORT || config.server.port;

app.listen(PORT,()=>{

  console.log("Server running on port",PORT);

});
