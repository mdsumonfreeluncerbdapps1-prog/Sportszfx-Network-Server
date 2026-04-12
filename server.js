const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 10000;

const API_KEY = "7fe9f425e3mshff1222adf5c4e45plfc57cjsrn3249e77b5bff";
const API_HOST = "cricbuzz-cricket2.p.rapidapi.com";


// Cricbuzz API থেকে Live Match আনবে
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

    const matches = data.typeMatches[0].seriesMatches;

    let count = 1;

    for (let i = 0; i < matches.length; i++) {

      if (matches[i].seriesAdWrapper) {

        const match = matches[i].seriesAdWrapper.matches[0];

        const team1 = match.matchInfo.team1.teamName;
        const team2 = match.matchInfo.team2.teamName;

        menu += ${count}. ${team1} vs ${team2}\n;

        count++;

        if (count > 3) break;

      }

    }

    menu += "0. More Match\n00. Back";

    return menu;

  } catch (error) {

    console.log(error);

    return "Live score unavailable";

  }

}


// SMS Listener
app.post("/sms_listener", async (req, res) => {

  const message = (req.body.message || "").toUpperCase().trim();

  if (message === "CRICKETSCOREUPDATE") {

    const menu = await getMatchMenu();

    res.send(menu);

  } else {

    res.send("Send CRICKETSCOREUPDATE to see live cricket matches");

  }

});


// Root
app.get("/", (req, res) => {

  res.send("BDapps Cricket Server Running");

});


// Start Server
app.listen(PORT, () => {

  console.log("Server running on port " + PORT);

});
