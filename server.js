const express = require("express");
const axios = require("axios");

const config = require("./config.json");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =======================
// BDAPPS CONFIG
// =======================

const BDAPPS_API_KEY = "977374d2647617747e34d1e857a420e9";
const APP_ID = "APP_136876";

// =======================
// CRICKET API CONFIG
// =======================

const API_KEY = "a0a5a7d4-f83a-4cb6-ae97-91238413ec8c";
const API_URL = "https://api.cricapi.com/v1";

let matches = [];
let selectedMatch = null;
let currentMenu = "main";

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
// SCORE FORMAT
// =======================

function getScore(match) {

  const name = match.name || "Match";
  const status = match.status || "Score not available";

  return `${name}\r\n\r\n${status}\r\n\r\n1. Refresh\r\n0. Back`;

}

// =======================
// SMS LISTENER
// =======================

app.post("/sms_listener", async (req, res) => {

  try {

    const message = (req.body.message || "").toLowerCase().trim();

    console.log("SMS:", message);

    // MAIN MENU

    if (message === config.app.shortcode || message === "cricketscoreupdate") {

      currentMenu = "main";
      selectedMatch = null;

      return res.send(config.menu.main);

    }

    // =====================
    // MAIN MENU OPTIONS
    // =====================

    if (currentMenu === "main") {

      if (message === "1") {

        matches = await fetchMatches("currentMatches");
        currentMenu = "matches";

      }

      else if (message === "2") {

        matches = await fetchMatches("matches");
        currentMenu = "matches";

      }

      else if (message === "3") {

        matches = await fetchMatches("matches");
        currentMenu = "matches";

      }

      if (matches.length === 0) {

        return res.send(config.menu.no_matches);

      }

      let menu = `${config.menu.matches}\r\n\r\n`;

      matches.slice(0,3).forEach((match,index)=>{

        menu += `${index+1}. ${match.name}\r\n`;

      });

      menu += "\r\n0. Back";

      return res.send(menu);

    }

    // =====================
    // MATCH SELECT
    // =====================

    if (currentMenu === "matches") {

      if (message === "0") {

        currentMenu = "main";
        return res.send(config.menu.main);

      }

      const index = parseInt(message) - 1;

      if (matches[index]) {

        selectedMatch = matches[index];
        currentMenu = "score";

        return res.send(getScore(selectedMatch));

      }

    }

    // =====================
    // SCORE MENU
    // =====================

    if (currentMenu === "score") {

      if (message === "1") {

        return res.send(getScore(selectedMatch));

      }

      if (message === "0") {

        currentMenu = "main";
        selectedMatch = null;

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
// USSD LISTENER
// =======================

app.post("/ussd_listener",(req,res)=>{

  try{

    res.send("Welcome to Sportzfx NK Cricket Service");

  }catch(err){

    res.send("USSD service error");

  }

});

// =======================
// SUBSCRIPTION LISTENER
// =======================

app.post("/sub_listener",(req,res)=>{

  try{

    console.log("Subscription Event:", req.body);

    res.send("Subscription Successful");

  }catch(err){

    res.send("Subscription Error");

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
