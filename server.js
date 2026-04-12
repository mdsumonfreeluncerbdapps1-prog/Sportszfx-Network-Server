const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =========================
// RAPID API CONFIG
// =========================

const API_KEY = "7fe9f425e3mshff1222adf5c4e45plfc57cjsrn3249e77b5bff";
const API_HOST = "cricbuzz-official-apis.p.rapidapi.com";

let matches = [];
let selectedMatch = null;

// =========================
// FETCH MATCHES
// =========================

async function fetchMatches(type){

  try{

    const response = await axios.get(
      `https://${API_HOST}/matches/${type}`,
      {
        headers:{
          "X-RapidAPI-Key":API_KEY,
          "X-RapidAPI-Host":API_HOST
        }
      }
    );

    const data = response.data;

    let list = [];

    if(!data || !data.typeMatches) return [];

    data.typeMatches.forEach(typeMatch=>{

      if(!typeMatch.seriesMatches) return;

      typeMatch.seriesMatches.forEach(series=>{

        if(!series.seriesAdWrapper) return;

        const seriesMatches = series.seriesAdWrapper.matches;

        if(!seriesMatches) return;

        seriesMatches.forEach(match=>{

          list.push({

            id: match.matchInfo.matchId,

            team1: match.matchInfo.team1.teamName,

            team2: match.matchInfo.team2.teamName

          });

        });

      });

    });

    return list;

  }catch(error){

    console.log("API Error:",error.message);
    return [];

  }

}

// =========================
// GET MATCHES
// =========================

async function getMatches(){

  let list = await fetchMatches("live");

  if(list.length>0){
    console.log("Live matches found");
    return list;
  }

  list = await fetchMatches("upcoming");

  if(list.length>0){
    console.log("Upcoming matches found");
    return list;
  }

  list = await fetchMatches("recent");

  if(list.length>0){
    console.log("Recent matches found");
    return list;
  }

  return [];

}

// =========================
// GET SCORE
// =========================

async function getScore(matchId){

  try{

    const response = await axios.get(
      `https://${API_HOST}/mcenter/${matchId}`,
      {
        headers:{
          "X-RapidAPI-Key":API_KEY,
          "X-RapidAPI-Host":API_HOST
        }
      }
    );

    const data = response.data;

    const team1 = data.matchHeader?.team1?.name || "Team A";
    const team2 = data.matchHeader?.team2?.name || "Team B";

    const score = data.matchScore?.team1Score?.inngs1;

    if(!score){

      return `${team1} vs ${team2}
Score not available`;

    }

    return `${team1} vs ${team2}
Score: ${score.runs}/${score.wickets}
Overs: ${score.overs}

1. Refresh
0. Back`;

  }catch(error){

    console.log("Score Error:",error.message);

    return "Score unavailable";

  }

}

// =========================
// SMS LISTENER
// =========================

app.post("/sms_listener",async(req,res)=>{

  const message = (req.body.message || "").toLowerCase().trim();

  console.log("SMS:",message);

  if(message === "cricketscoreupdate"){

    matches = await getMatches();

    if(matches.length === 0){

      return res.send("No matches available");

    }

    let menu = "Live Matches\n\n";

    matches.slice(0,3).forEach((match,index)=>{

      menu += `${index+1}. ${match.team1} vs ${match.team2}\n`;

    });

    menu += "\n0. Back";

    return res.send(menu);

  }

  // refresh

  if(message === "1" && selectedMatch){

    const score = await getScore(selectedMatch);

    return res.send(score);

  }

  // select match

  if(!isNaN(message)){

    const index = parseInt(message) - 1;

    if(matches[index]){

      selectedMatch = matches[index].id;

      const score = await getScore(selectedMatch);

      return res.send(score);

    }

  }

  res.send("Send CRICKETSCOREUPDATE");

});

// =========================
// USSD
// =========================

app.post("/ussd_listener",(req,res)=>{

  res.send("Cricket Live Score Service");

});

// =========================
// SUB
// =========================

app.post("/sub_listener",(req,res)=>{

  res.send("Subscription Successful");

});

// =========================
// ROOT
// =========================

app.get("/",(req,res)=>{

  res.send("BDapps Cricket Server Running");

});

// =========================

const PORT = process.env.PORT || 10000;

app.listen(PORT,()=>{

  console.log("Server running on port",PORT);

});
