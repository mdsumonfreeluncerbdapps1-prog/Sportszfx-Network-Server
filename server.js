const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 10000;

const API_KEY = "7fe9f425e3mshff1222adf5c4e45plfc57cjsrn3249e77b5bff";
const API_HOST = "cricbuzz-cricket2.p.rapidapi.com";

let matchList = [];
let selectedMatch = {};


// Get Match Menu
async function getMatchMenu() {

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

    let menu = "Live Matches\n";

    matchList = [];

    const matches = data.typeMatches[0].seriesMatches;

    let count = 1;

    for (let i = 0; i < matches.length; i++) {

      if (matches[i].seriesAdWrapper) {

        const match = matches[i].seriesAdWrapper.matches[0];

        const team1 = match.matchInfo.team1.teamName;
        const team2 = match.matchInfo.team2.teamName;
        const matchId = match.matchInfo.matchId;

        matchList.push(matchId);

        menu += ${count}. ${team1} vs ${team2}\n;

        count++;

        if (count > 3) break;

      }

    }

    menu += "0. More Match\n00. Back";

    return menu;

  } catch (error) {

    console.log(error);

    return "Live matches unavailable";

  }

}


// Get Match Score
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

    const team1 = data.matchHeader.team1.name;
    const team2 = data.matchHeader.team2.name;

    const score = data.scoreCard[0].scoreDetails;

    const runs = score.runs;
    const wickets = score.wickets;
    const overs = score.overs;

    return `${team1} vs ${team2}
Score: ${runs}/${wickets}
Over: ${overs}`;

  } catch (error) {

    console.log(error);

    return "Score unavailable";

  }

}


// SMS Listener
app.post("/sms_listener", async (req, res) => {

  const msisdn = req.body.msisdn || "user";
  const message = (req.body.message || "").toUpperCase().trim();

  // Show Match Menu
  if (message === "CRICKETSCOREUPDATE") {

    const menu = await getMatchMenu();

    res.send(menu);

  }

  // Select Match
  else if (message === "1" || message === "2" || message === "3") {

    const index = parseInt(message) - 1;

    const matchId = matchList[index];

    selectedMatch[msisdn] = matchId;

    const score = await getScore(matchId);

    res.send(`${score}

1. Refresh
0. Back`);

  }

  // Refresh Score
  else if (message === "1" && selectedMatch[msisdn]) {

    const matchId = selectedMatch[msisdn];

    const score = await getScore(matchId);

    res.send(`${score}

1. Refresh
0. Back`);

  }

  // Back to Menu
  else if (message === "0") {

    const menu = await getMatchMenu();

    res.send(menu);

  }

  else {

    res.send("Send CRICKETSCOREUPDATE");

  }

});


// Root
app.get("/", (req, res) => {

  res.send("Sportzfx Cricket Server Running");

});


// Start Server
app.listen(PORT, () => {

  console.log("Server running on port " + PORT);

});
