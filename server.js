const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// RapidAPI Config
const API_KEY = "7fe9f425e3mshff1222adf5c4e45plfc57cjsrn3249e77b5bff";
const API_HOST = "cricbuzz-cricket2.p.rapidapi.com";

// Store matches
let liveMatches = [];

// ===============================
// Get Live Matches From Cricbuzz
// ===============================
async function getLiveMatches() {

  try {

    const response = await axios.get(
      "https://cricbuzz-cricket2.p.rapidapi.com/matches/v1/live",
      {
        headers: {
          "X-RapidAPI-Key": API_KEY,
          "X-RapidAPI-Host": API_HOST
        }
      }
    );

    const data = response.data;

    liveMatches = [];

    if (data && data.typeMatches) {

      data.typeMatches.forEach(type => {

        if (type.seriesMatches) {

          type.seriesMatches.forEach(series => {

            if (series.seriesAdWrapper && series.seriesAdWrapper.matches) {

              series.seriesAdWrapper.matches.forEach(match => {

                const team1 = match.matchInfo.team1.teamName;
                const team2 = match.matchInfo.team2.teamName;

                liveMatches.push({
                  id: match.matchInfo.matchId,
                  team1: team1,
                  team2: team2
                });

              });

            }

          });

        }

      });

    }

  } catch (error) {

    console.log("API Error:", error.message);

  }

}

// ===============================
// Get Match Score
// ===============================
async function getMatchScore(matchId) {

  try {

    const response = await axios.get(
      https://cricbuzz-cricket2.p.rapidapi.com/mcenter/v1/${matchId},
      {
        headers: {
          "X-RapidAPI-Key": API_KEY,
          "X-RapidAPI-Host": API_HOST
        }
      }
    );

    const data = response.data;

    const team1 = data.matchHeader.team1.name;
    const team2 = data.matchHeader.team2.name;

    const score = data.matchScore.team1Score.inngs1;

    const runs = score.runs;
    const wickets = score.wickets;
    const overs = score.overs;

    return `${team1} vs ${team2}
Score: ${runs}/${wickets}
Over: ${overs}

1. Refresh
0. Back`;

  } catch (error) {

    console.log("Score Error:", error.message);
    return "Score unavailable";

  }

}

// ===============================
// SMS Listener
// ===============================
app.post("/sms_listener", async (req, res) => {

  const message = (req.body.message || "").toLowerCase().trim();

  console.log("SMS:", message);

  if (message === "cricketscoreupdate") {

    await getLiveMatches();

    if (liveMatches.length === 0) {
      return res.send("No live matches right now");
    }

    let menu = "Live Matches\n";

    let count = 1;

    liveMatches.slice(0, 3).forEach(match => {

      menu += ${count}. ${match.team1} vs ${match.team2}\n;

      count++;

    });

    menu += "0. More Match\n00. Back";

    return res.send(menu);

  }

  // Match selection
  if (!isNaN(message)) {

    const index = parseInt(message) - 1;

    if (liveMatches[index]) {

      const matchId = liveMatches[index].id;

      const score = await getMatchScore(matchId);

      return res.send(score);

    }

  }

  res.send("Send CRICKETSCOREUPDATE to see live cricket matches");

});

// ===============================
// USSD Listener
// ===============================
app.post("/ussd_listener", (req, res) => {

  res.send("Cricket Live Score Service");

});

// ===============================
// Subscription Listener
// ===============================
app.post("/sub_listener", (req, res) => {

  console.log("Subscription:", req.body);

  res.send("Subscription Successful");

});

// ===============================
// Root
// ===============================
app.get("/", (req, res) => {

  res.send("Sportzfx Cricket Server Running");

});

// ===============================
// Start Server
// ===============================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {

  console.log(Server running on port ${PORT});

});
