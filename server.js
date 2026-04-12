const express = require("express");
const axios = require("axios");

const config = require("./config.json");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =======================
// API CONFIG
// =======================

const API_KEY = "a0a5a7d4-f83a-4cb6-ae97-91238413ec8c";
const API_URL = "https://api.cricapi.com/v1";

let matches = [];
let selectedMatch = null;

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

  return `${name}\r\n\r\n${status}\r\n\r\n${config.score_menu}`;

}

// =======================
// SMS LISTENER
// =======================

app.post("/sms_listener", async (req, res) => {

  const message = (req.body.message || "").toLowerCase().trim();

  console.log("SMS:", message);

  // MAIN MENU

  if (message === config.app.shortcode) {

    return res.send(config.menu.main);

  }

  // LIVE MATCHES

  if (message === "1") {

    matches = await fetchMatches("currentMatches");

  }

  // UPCOMING MATCHES

  if (message === "2") {

    matches = await fetchMatches("matches");

  }

  // RECENT MATCHES

  if (message === "3") {

    matches = await fetchMatches("matches");

  }

  if (["1","2","3"].includes(message)) {

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

  // SELECT MATCH

  if (!isNaN(message)) {

    const index = parseInt(message) - 1;

    if (matches[index]) {

      selectedMatch = matches[index];

      return res.send(getScore(selectedMatch));

    }

  }

  // REFRESH

  if (message === "1" && selectedMatch) {

    return res.send(getScore(selectedMatch));

  }

  res.send(config.menu.default);

});

// =======================
// USSD
// =======================

app.post("/ussd_listener",(req,res)=>{

  res.send("Cricket Live Score Service");

});

// =======================
// SUB
// =======================

app.post("/sub_listener",(req,res)=>{

  res.send("Subscription Successful");

});

// =======================
// ROOT
// =======================

app.get("/",(req,res)=>{

  res.send("BDapps Cricket Server Running");

});

// =======================

const PORT = process.env.PORT || config.server.port;

app.listen(PORT,()=>{

  console.log("Server running on port",PORT);

});
