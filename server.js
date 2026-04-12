const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =========================
// API CONFIG
// =========================

const API_KEY = "a0a5a7d4-f83a-4cb6-ae97-91238413ec8c";
const API_URL = "https://api.cricapi.com/v1";

let matches = [];
let selectedMatch = null;

// =========================
// GET LIVE MATCHES
// =========================

async function getMatches() {

  try {

    const response = await axios.get(
      `${API_URL}/currentMatches?apikey=${API_KEY}&offset=0`
    );

    const data = response.data;

    if (!data || !data.data) return [];

    return data.data;

  } catch (error) {

    console.log("API Error:", error.message);
    return [];

  }

}

// =========================
// GET SCORE
// =========================

function getScore(match) {

  const name = match.name || "Match";
  const status = match.status || "Score not available";

  return `${name}

${status}

1. Refresh
0. Back`;

}

// =========================
// SMS LISTENER
// =========================

app.post("/sms_listener", async (req, res) => {

  const message = (req.body.message || "").toLowerCase().trim();

  console.log("SMS:", message);

  // Start command
  if (message === "cricketscoreupdate") {

    matches = await getMatches();

    if (matches.length === 0) {

      return res.send("No live matches right now");

    }

    let menu = "Live Cricket Matches\n\n";

    matches.slice(0, 3).forEach((match, index) => {

      menu += `${index + 1}. ${match.name}\n`;

    });

    menu += "\n0. Back";

    return res.send(menu);

  }

  // Refresh score
  if (message === "1" && selectedMatch) {

    return res.send(getScore(selectedMatch));

  }

  // Select match
  if (!isNaN(message)) {

    const index = parseInt(message) - 1;

    if (matches[index]) {

      selectedMatch = matches[index];

      return res.send(getScore(selectedMatch));

    }

  }

  res.send("Send CRICKETSCOREUPDATE");

});

// =========================
// USSD LISTENER
// =========================

app.post("/ussd_listener", (req, res) => {

  res.send("Cricket Live Score Service");

});

// =========================
// SUB LISTENER
// =========================

app.post("/sub_listener", (req, res) => {

  res.send("Subscription Successful");

});

// =========================
// ROOT
// =========================

app.get("/", (req, res) => {

  res.send("BDapps Cricket Server Running");

});

// =========================

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {

  console.log("Server running on port", PORT);

});
