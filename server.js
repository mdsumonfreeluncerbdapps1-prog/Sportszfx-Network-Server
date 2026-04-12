const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 10000;

const API_KEY = "7fe9f425e3mshff1222adf5c4e45plfc57cjsrn3249e77b5bff";
const API_HOST = "cricbuzz-cricket2.p.rapidapi.com";

async function getMatches() {

  const response = await axios.get(
    "https://cricbuzz-cricket2.p.rapidapi.com/matches/v1/live",
    {
      headers: {
        "X-RapidAPI-Key": API_KEY,
        "X-RapidAPI-Host": API_HOST
      }
    }
  );

  return response.data;

}

app.post("/sms_listener", async (req, res) => {

  const message = (req.body.message || "").toUpperCase();

  if (message === "CRICKETSCOREUPDATE") {

    const data = await getMatches();

    let reply = "Live Matches\n";

    const matches = data.typeMatches[0].seriesMatches;

    for (let i = 0; i < 3; i++) {

      const match = matches[i].seriesAdWrapper.matches[0];

      const team1 = match.matchInfo.team1.teamName;
      const team2 = match.matchInfo.team2.teamName;

      reply += ${i + 1}. ${team1} vs ${team2}\n;

    }

    reply += "0. More Match\n00. Back";

    res.send(reply);

  } else {

    res.send("Send CRICKETSCOREUPDATE");

  }

});

app.get("/", (req, res) => {

  res.send("Cricket SMS Server Running");

});

app.listen(PORT, () => {

  console.log("Server running on port " + PORT);

});
