const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// RapidAPI
const API_KEY = "7fe9f425e3mshff1222adf5c4e45plfc57cjsrn3249e77b5bff";
const API_HOST = "cricbuzz-cricket2.p.rapidapi.com";

// store matches
let liveMatches = [];
let selectedMatch = null;

// =====================
// Get Live Matches
// =====================
async function getMatches() {

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

    if (data.typeMatches) {

      data.typeMatches.forEach(type => {

        if (type.seriesMatches) {

          type.seriesMatches.forEach(series => {

            if (series.seriesAdWrapper && series.seriesAdWrapper.matches) {

              series.seriesAdWrapper.matches.forEach(match => {

                liveMatches.push({
                  id: match.matchInfo.matchId,
                  team1: match.matchInfo.team1.teamName,
                  team2: match.matchInfo.team2.teamName
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

// =====================
// Get Score
// =====================
async function getScore(matchId) {

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

    const team1 = data.matchHeader?.team1?.name || "Team A";
    const team2 = data.matchHeader?.team2?.name || "Team B";

    const scoreData = data.matchScore?.team1Score?.inngs1;

    if (!scoreData) {
      return ${team1} vs ${team2}\nScore not available;
    }

    const runs = scoreData.runs;
    const wickets = scoreData.wickets;
    const overs = scoreData.overs;

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

// =====================
// SMS LISTENER
// =====================
app.post("/sms_listener", async (req, res) => {

  const message = (req.body.message || "").toLowerCase().trim();

  console.log("SMS:", message);

  // show matches
  if (message === "cricketscoreupdate") {

    await getMatches();

    let menu = "Live Matches\n";

    liveMatches.slice(0,3).forEach((match,index) => {

      menu += ${index+1}. ${match.team1} vs ${match.team2}\n;

    });

    menu += "0. More Match\n00. Back";

    return res.send(menu);

  }

  // refresh score
  if (message === "1" && selectedMatch) {

    const score = await getScore(selectedMatch);

    return res.send(score);

  }

  // select match
  if (!isNaN(message)) {

    const index = parseInt(message) - 1;

    if (liveMatches[index]) {

      selectedMatch = liveMatches[index].id;

      const score = await getScore(selectedMatch);

      return res.send(score);

    }

  }

  res.send("Send CRICKETSCOREUPDATE for live matches");

});

// =====================
// USSD
// =====================
app.post("/ussd_listener",(req,res)=>{

  res.send("Cricket Live Score Service");

});

// =====================
// SUBSCRIPTION
// =====================
app.post("/sub_listener",(req,res)=>{

  res.send("Subscription Successful");

});

// =====================
// ROOT
// =====================
app.get("/",(req,res)=>{

  res.send("BDapps Cricket Server Running");

});

// =====================
const PORT = process.env.PORT || 10000;

app.listen(PORT,()=>{

  console.log("Server running on port",PORT);

});
