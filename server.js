const express = require("express");
const axios = require("axios");

const config = require("./config.json");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =======================
// CRICKET API CONFIG
// =======================

const API_KEY = "a0a5a7d4-f83a-4cb6-ae97-91238413ec8c";
const API_URL = "https://api.cricapi.com/v1";

// =======================
// USER SESSIONS
// =======================

let sessions = {};

// =======================
// CACHE MEMORY
// =======================

let matchCache = {};

// =======================
// FETCH MATCHES
// =======================

async function fetchMatches(type) {

  try {

    const response = await axios.get(
      `${API_URL}/${type}?apikey=${API_KEY}&offset=0`
    );

    const data = response.data;

    if (!data || !data.data) return [];

    return data.data;

  } catch (error) {

    console.log("API Error:", error.message);
    return [];

  }

}

// =======================
// UPDATE CACHE SCORE
// =======================

async function updateScoreCache(matchId){

  try{

    const response = await axios.get(
      `${API_URL}/match_info?apikey=${API_KEY}&id=${matchId}`
    );

    if(response.data && response.data.data){

      matchCache[matchId] = response.data.data;

    }

  }catch(err){

    console.log("Cache Error:", err.message);

  }

}

// =======================
// SCORE FORMAT
// =======================

function getScore(match) {

  const name = match.name || "Match";

  let scoreText = "Score not available";

  if (match.score && match.score.length > 0) {

    let scores = [];

    match.score.forEach((s) => {

      scores.push(`${s.r}/${s.w} (${s.o} overs)`);

    });

    scoreText = scores.join(" | ");

  }

  const status = match.status || "";

  return `${name}\r\n\r\nScore: ${scoreText}\r\n${status}\r\n\r\n1. Refresh\r\n0. Back`;

}

// =======================
// AUTO CACHE REFRESH
// =======================

setInterval(async () => {

  const matchIds = Object.keys(matchCache);

  for(const id of matchIds){

    await updateScoreCache(id);

  }

},15000);

// =======================
// SMS LISTENER
// =======================

app.post("/sms_listener", async (req, res) => {

  try {

    const message = (req.body.message || "").toLowerCase().trim();
    const user = req.body.sourceAddress || "demo";

    console.log("SMS:", message, "User:", user);

    if (!sessions[user]) {

      sessions[user] = {
        menu: "main",
        matches: [],
        selectedMatch: null
      };

    }

    const session = sessions[user];

    // =====================
    // MAIN MENU
    // =====================

    if (message === config.app.shortcode || message === "cricketscoreupdate") {

      session.menu = "main";
      session.selectedMatch = null;

      return res.send(config.menu.main);

    }

    // =====================
    // MAIN MENU OPTIONS
    // =====================

    if (session.menu === "main") {

      if (message === "1") {

        session.matches = await fetchMatches("currentMatches");
        session.menu = "matches";

      }

      else if (message === "2") {

        session.matches = await fetchMatches("matches");
        session.menu = "matches";

      }

      else if (message === "3") {

        session.matches = await fetchMatches("matches");
        session.menu = "matches";

      }

      if (session.matches.length === 0) {

        return res.send(config.menu.no_matches);

      }

      let menu = `${config.menu.matches}\r\n\r\n`;

      session.matches.slice(0,3).forEach((match,index)=>{

        menu += `${index+1}. ${match.name}\r\n`;

      });

      menu += "\r\n0. Back";

      return res.send(menu);

    }

    // =====================
    // MATCH SELECT
    // =====================

    if (session.menu === "matches") {

      if (message === "0") {

        session.menu = "main";
        return res.send(config.menu.main);

      }

      const index = parseInt(message) - 1;

      if (session.matches[index]) {

        const match = session.matches[index];

        session.selectedMatch = match;
        session.menu = "score";

        // add cache

        if(!matchCache[match.id]){

          await updateScoreCache(match.id);

        }

        return res.send(getScore(matchCache[match.id] || match));

      }

    }

    // =====================
    // SCORE MENU
    // =====================

    if (session.menu === "score") {

      if (message === "1") {

        const match = matchCache[session.selectedMatch.id] || session.selectedMatch;

        return res.send(getScore(match));

      }

      if (message === "0") {

        session.menu = "main";
        session.selectedMatch = null;

        return res.send(config.menu.main);

      }

    }

    return res.send(config.menu.default);

  } catch (error) {

    console.log("SMS Error:", error.message);
    res.send("Service temporarily unavailable");

  }

});

// =======================
// ROOT
// =======================

app.get("/",(req,res)=>{

  res.send("BDapps Cricket Server Running");

});

// =======================
// SERVER START
// =======================

const PORT = process.env.PORT || config.server.port;

app.listen(PORT,()=>{

  console.log("Server running on port",PORT);

});
