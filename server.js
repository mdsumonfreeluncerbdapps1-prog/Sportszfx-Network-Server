const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =======================
// API CONFIG
// =======================

const API_KEY = "a0a5a7d4-f83a-4cb6-ae97-91238413ec8c";

let matches = [];
let selectedMatch = null;

// =======================
// GET LIVE MATCHES
// =======================

async function getMatches(){

  try{

    const response = await axios.get(
      `https://api.cricketdata.org/v1/currentMatches?apikey=${API_KEY}`
    );

    const data = response.data;

    if(!data || !data.data) return [];

    return data.data;

  }catch(error){

    console.log("API Error:", error.message);

    return [];

  }

}

// =======================
// GET SCORE
// =======================

function getScore(match){

  const name = match.name || "Match";
  const status = match.status || "Score not available";

  return `${name}

${status}

1. Refresh
0. Back`;

}

// =======================
// SMS LISTENER
// =======================

app.post("/sms_listener", async (req,res)=>{

  const message = (req.body.message || "").toLowerCase().trim();

  console.log("SMS:", message);

  // START

  if(message === "cricketscoreupdate"){

    matches = await getMatches();

    if(matches.length === 0){

      return res.send("No live matches right now");

    }

    let menu = "Live Matches\n\n";

    matches.slice(0,3).forEach((match,index)=>{

      menu += `${index+1}. ${match.name}\n`;

    });

    menu += "\n0. Back";

    return res.send(menu);

  }

  // REFRESH

  if(message === "1" && selectedMatch){

    const score = getScore(selectedMatch);

    return res.send(score);

  }

  // SELECT MATCH

  if(!isNaN(message)){

    const index = parseInt(message) - 1;

    if(matches[index]){

      selectedMatch = matches[index];

      const score = getScore(selectedMatch);

      return res.send(score);

    }

  }

  res.send("Send CRICKETSCOREUPDATE");

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

const PORT = process.env.PORT || 10000;

app.listen(PORT,()=>{

  console.log("Server running on port",PORT);

});
