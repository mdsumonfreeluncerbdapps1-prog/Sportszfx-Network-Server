const express = require("express");
const axios = require("axios");
const config = require("./config.json");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =======================
// CRICKET API CONFIG
// =======================

const API_KEY = "ec471071441bb2ac538a0ff901abd249";
const API_URL = "https://api.api-cricket.com";

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

async function fetchMatches(type){

  try{

    let url="";

    if(type==="currentMatches"){
      url=`${API_URL}/?method=get_livescore&APIkey=${API_KEY}`;
    }

    if(type==="matches"){
      url=`${API_URL}/?method=get_fixtures&APIkey=${API_KEY}`;
    }

    const response = await axios.get(url);

    if(!response.data || !response.data.result) return [];

    return response.data.result;

  }catch(err){

    console.log("Match API Error:",err.message);
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
      `${API_URL}/?method=get_livescore&match_id=${matchId}&APIkey=${API_KEY}`
    );

    if(response.data && response.data.result){

      matchCache[matchId] = response.data.result[0];
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

  const name = `${match.event_home_team} vs ${match.event_away_team}`;

  const score = `${match.event_home_score} - ${match.event_away_score}`;

  const status = match.event_status || "";

  return `${name}

Score: ${score}

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

    if(message === config.app.shortcode || message === "cricketscoreupdate"){

      session.menu = "main";
      session.selectedMatch = null;

      return res.send(config.menu.main);

    }

    if(session.menu === "main"){

      if(message === "1"){

        session.matches = await fetchMatches("currentMatches");
        session.menu = "matches";

      }

      else if(message === "2"){

        const all = await fetchMatches("matches");
        session.matches = all;
        session.menu = "matches";

      }

      else if(message === "3"){

        const all = await fetchMatches("matches");
        session.matches = all;
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

        menu += `${i+1}. ${m.event_home_team} vs ${m.event_away_team}
`;

      });

      menu += `
0. Back`;

      return res.send(menu);

    }

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

        await updateScoreCache(match.event_key);

        return res.send(getScore(matchCache[match.event_key] || match));

      }

      return res.send("Invalid option\n\n0. Back");

    }

    if(session.menu === "score"){

      if(message === "1"){

        await updateScoreCache(session.selectedMatch.event_key);

        const match =
          matchCache[session.selectedMatch.event_key] ||
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
