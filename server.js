const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 10000;

// RapidAPI key
const API_KEY = "YOUR_RAPIDAPI_KEY";

// User temporary session
const userSessions = {};

// Get Live Matches
async function getLiveMatches() {

  try {

    const response = await axios.get(
      "https://cricbuzz-cricket2.p.rapidapi.com/matches/v1/live",
      {
        headers: {
          "X-RapidAPI-Key": API_KEY,
          "X-RapidAPI-Host": "cricbuzz-cricket2.p.rapidapi.com"
        }
      }
    );

    const matches = [];

    const data = response.data.typeMatches;

    data.forEach(type => {

      type.seriesMatches.forEach(series => {

        if (series.seriesAdWrapper) {

          series.seriesAdWrapper.matches.forEach(match => {

            const team1 = match.matchInfo.team1.teamName;
            const team2 = match.matchInfo.team2.teamName;

            matches.push({
              teams: `${team1} vs ${team2}`
            });

          });

        }

      });

    });

    return matches.slice(0,5);

  } catch (error) {

    console.log(error);
    return [];

  }

}

// SMS Listener
app.post("/sms_listener", async (req, res) => {

  const msisdn = req.body.msisdn;
  const message = (req.body.message || "").trim().toLowerCase();

  // Step 1 → show live matches
  if (message === "cricketscoreupdate") {

    const matches = await getLiveMatches();

    userSessions[msisdn] = matches;

    let reply = "Live Matches\n";

    matches.forEach((m, i) => {

      reply += `${i + 1}. ${m.teams}\n`;

    });

    res.send(reply);

  }

  // Step 2 → user selects match
  else if (!isNaN(message)) {

    const index = parseInt(message) - 1;

    const matches = userSessions[msisdn];

    if (!matches || !matches[index]) {

      res.send("Invalid option");

    } else {

      const match = matches[index];

      res.send(`${match.teams}\nScore update coming soon`);

    }

  }

  else {

    res.send("Send CRICKETSCOREUPDATE to see live matches");

  }

});

// USSD Listener
app.post("/ussd_listener", (req, res) => {

  res.send("1. Live Cricket Score");

});

// Subscription Listener
app.post("/sub_listener", (req, res) => {

  console.log("Subscription:", req.body);
  res.send("Subscription Successful");

});

// Root test
app.get("/", (req, res) => {

  res.send("BDapps Cricket Server Running");

});

// Start server
app.listen(PORT, () => {

  console.log("Server running on port " + PORT);

});
