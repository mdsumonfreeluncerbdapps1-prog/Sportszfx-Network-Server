const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const API_KEY = "a0a5a7d4-f83a-4cb6-ae97-91238413ec8c";

// Get Live Score
async function getLiveScore() {

  try {

    const response = await axios.get(
      https://api.cricapi.com/v1/currentMatches?apikey=${API_KEY}
    );

    const match = response.data.data[0];

    if (!match || !match.score || match.score.length === 0) {
      return "No live match right now";
    }

    const team1 = match.teams[0];
    const team2 = match.teams[1];

    const score = match.score[0].r + "/" + match.score[0].w;
    const over = match.score[0].o;

    return ${team1} vs ${team2}\nScore: ${score}\nOver: ${over};

  } catch (error) {

    console.log(error);
    return "Score unavailable";

  }

}

// SMS Listener
app.post("/sms_listener", async (req, res) => {

  console.log("SMS Received:", req.body);

  const message = req.body.message || "";
  const text = message.toLowerCase();

  if (text === "cricketscoreupdate") {

    const score = await getLiveScore();

    res.send(score);

  } else {

    res.send("Send CRICKETSCOREUPDATE to get live cricket score");

  }

});

// USSD Menu
app.post("/ussd_listener", (req, res) => {

  res.send("1. Live Match\n2. Bangladesh Match\n3. IPL Match");

});

// Subscription Listener
app.post("/sub_listener", (req, res) => {

  console.log("Subscription Event:", req.body);

  res.send("Subscription Successful");

});

// Root
app.get("/", (req, res) => {

  res.send("BDapps Cricket Server Running");

});

app.listen(10000, () => {

  console.log("Server running on port 10000");

});
