const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =======================
// API CONFIG
// =======================

const API_KEY = "a0a5a7d4-f83a-4cb6-ae97-91238413ec8c";
const API_URL = "https://api.cricapi.com/v1";

let matches = [];
let selectedMatch = null;
let state = "menu";

// =======================
// FETCH MATCHES
// =======================

async function fetchMatches(type){

  try{

    const response = await axios.get(
      `${API_URL}/${type}?apikey=${API_KEY}&offset=0`
    );

    const data = response.data;

    if(!data || !data.data) return [];

    return data.data;

  }catch(error){

    console.log("API Error:",error.message);
    return [];

  }

}

// =======================
// SCORE VIEW
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

  console.log("SMS:",message);

  // MAIN MENU

  if(message === "cricketscoreupdate" || message === "0"){

    state = "menu";

    let menu = "Cricket Matches\n\n";

    menu += "1. Live Matches\n";
    menu += "2. Upcoming Matches\n";
    menu += "3. Recent Matches\n";

    menu += "\n0. Back";

    return res.send(menu);

  }

  // LIVE MATCHES

  if(message === "1" && state === "menu"){

    matches = await fetchMatches("currentMatches");

    state = "list";

  }

  // UPCOMING MATCHES

  if(message === "2" && state === "menu"){

    matches = await fetchMatches("matches");

    state = "list";

  }

  // RECENT MATCHES

  if(message === "3" && state === "menu"){

    matches = await fetchMatches("matches");

    state = "list";

  }

  // SHOW MATCH LIST

  if(state === "list"){

    if(matches.length === 0){

      return res.send("No matches available");

    }

    let menu = "Matches\n\n";

    matches.slice(0,3).forEach((match,index)=>{

      menu += `${index+1}. ${match.name}\n`;

    });

    menu += "\n0. Back";

    state = "select";

    return res.send(menu);

  }

  // SELECT MATCH

  if(state === "select" && !isNaN(message)){

    const index = parseInt(message)-1;

    if(matches[index]){

      selectedMatch = matches[index];

      state = "score";

      return res.send(getScore(selectedMatch));

    }

  }

  // REFRESH SCORE

  if(message === "1" && state === "score"){

    return res.send(getScore(selectedMatch));

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
