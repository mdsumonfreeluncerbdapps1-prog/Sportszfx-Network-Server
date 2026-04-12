const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// RapidAPI
const API_KEY = "7fe9f425e3mshff1222adf5c4e45plfc57cjsrn3249e77b5bff";
const API_HOST = "cricbuzz-official-apis.p.rapidapi.com";

let matches = [];
let selectedMatch = null;

// =====================
// FETCH MATCHES
// =====================
async function fetchMatches(type) {

  try {

    const response = await axios.get(
      `https://cricbuzz-official-apis.p.rapidapi.com/matches/${type}`,
      {
        headers: {
          "X-RapidAPI-Key": API_KEY,
          "X-RapidAPI-Host": API_HOST
        }
      }
    );

    const data = response.data;

    let list = [];

    if (!data || !data.matches) return [];

    data.matches.forEach(match => {

      list.push({
        id: match.matchId,
        team1: match.team1,
        team2: match.team2
      });

    });

    return list;

  } catch (error) {

    console.log("API error:", error.message);
    return [];

  }

}

// =====================
// GET MATCHES
// =====================
async function getMatches() {

  let list = await fetchMatches("live");

  if (list.length > 0) {
    console.log("Live matches found");
    return list;
  }

  list = await fetchMatches("upcoming");

  if (list.length > 0) {
    console.log("Upcoming matches found");
    return list;
  }

  list = await fetchMatches("recent");

  if (list.length > 0) {
    console.log("Recent matches found");
    return list;
  }

  return [];

}

// =====================
// GET SCORE
// =====================
async function getScore(matchId) {

  try {

    const response = await axios.get(
      `https://cricbuzz-official-apis.p.rapidapi.com/match/${matchId}`,
      {
        headers: {
          "X-RapidAPI-Key": API_KEY,
          "X-RapidAPI-Host": API_HOST
        }
      }
    );

    const data = response.data;

    const team1 = data.team1 || "Team A";
    const team2 = data.team2 || "Team B";
    const score = data.score || "Score unavailable";

    return `${team1} vs ${team2}
Score: ${score}

1. Refresh
0. Back`;

  } catch (error) {

    console.log("Score error:", error.message);
    return "Score unavailable";

  }

}

// =====================
// SMS LISTENER
// =====================
app.post("/sms_listener", async (req, res) => {

  const message = (req.body.message || "").toLowerCase().trim();

  console.log("SMS:", message);

  if (message === "cricketscoreupdate") {

    matches = await getMatches();

    if (matches.length === 0) {
      return res.send("No matches found");
    }

    let menu = "Matches\n";

    matches.slice(0,3).forEach((match, index) => {

      menu += `${index+1}. ${match.team1} vs ${match.team2}\n`;

    });

    menu += "0. Back";

    return res.send(menu);

  }

  // Refresh score
  if (message === "1" && selectedMatch) {

    const score = await getScore(selectedMatch);

    return res.send(score);

  }

  // Select match
  if (!isNaN(message)) {

    const index = parseInt(message) - 1;

    if (matches[index]) {

      selectedMatch = matches[index].id;

      const score = await getScore(selectedMatch);

      return res.send(score);

    }

  }

  res.send("Send CRICKETSCOREUPDATE");

});

// =====================
// USSD
// =====================
app.post("/ussd_listener", (req,res)=>{

  res.send("Cricket Live Score Service");

});

// =====================
// SUB
// =====================
app.post("/sub_listener",(req,res)=>{

  res.send("Subscription Successful");

});

// =====================
// ROOT
// =====================
app.get("/", (req,res)=>{

  res.send("BDapps Cricket Server Running");

});

// =====================
const PORT = process.env.PORT || 10000;

app.listen(PORT, ()=>{

  console.log("Server running on port", PORT);

});
