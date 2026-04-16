const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ======================
   API CONFIG
====================== */

const LIVE_API =
"https://cricbuzz.autoaiassistant.com/api.php?action=live&type=all";

const UPCOMING_API =
"https://cricbuzz.autoaiassistant.com/api.php?action=upcoming&type=all";

const RECENT_API =
"https://cricbuzz.autoaiassistant.com/api.php?action=recent&type=all";


/* ======================
   SESSION STORE
====================== */

let sessionMatches = [];


/* ======================
   TEAM SHORT CODE
====================== */

function shortTeam(name) {

 if (!name) return "";

 return name
  .split(" ")
  .map(w => w[0])
  .join("")
  .toUpperCase();
}


/* ======================
   MATCH NAME PARSER
====================== */

function parseMatchName(name) {

 if (!name) return "Match";

 let typeMatch = name.match(
 /(\d+(st|nd|rd|th)\sMatch|\d+(st|nd|rd|th)\sODI|\d+(st|nd|rd|th)\sT20I|\d+(st|nd|rd|th)\sTest|\d+(st|nd|rd|th)\sT10)/i
 );

 let matchType = typeMatch ? typeMatch[0] : "Match";

 let vsMatch = name.match(/([A-Za-z ]+)\s+vs\s+([A-Za-z ]+)/i);

 if (vsMatch) {

  let team1 = shortTeam(vsMatch[1]);
  let team2 = shortTeam(vsMatch[2]);

  return `${matchType} . ${team1} VS ${team2}`;
 }

 return matchType;
}


/* ======================
   DATE FORMAT
====================== */

function formatDate(date) {

 if (!date) return "";

 const d = new Date(date);

 return d.toDateString();
}


/* ======================
   MAIN SMS LISTENER
====================== */

app.post("/sms_listener", async (req, res) => {

 const message = (req.body.message || "").trim();


/* ======================
   MAIN MENU
====================== */

 if (message === "CRICKETSCOREUPDATE") {

  return res.send(`Cricket Score Service

1 Live Matches
2 Upcoming Matches
3 Recent Matches

0 Exit`);
 }


/* ======================
   LIVE MATCH LIST
====================== */

 if (message === "1") {

  const api = await axios.get(LIVE_API);

  const matches = api.data.data || api.data;

  sessionMatches = matches;

  let output = "Live Matches\n\n";

  matches.slice(0,5).forEach((m,i)=>{

   const name = parseMatchName(m.match_name);

   output += `${i+1}. ${name}\n`;

  });

  output += "\n9 More Matches\n0 Back";

  return res.send(output);
 }


/* ======================
   UPCOMING MATCH LIST
====================== */

 if (message === "2") {

  const api = await axios.get(UPCOMING_API);

  const matches = api.data.data || api.data;

  sessionMatches = matches;

  let output = "Upcoming Matches\n\n";

  matches.slice(0,5).forEach((m,i)=>{

   const name = parseMatchName(m.match_name);

   output += `${i+1}. ${name}\n`;

  });

  output += "\n9 More Matches\n0 Back";

  return res.send(output);
 }


/* ======================
   RECENT MATCH LIST
====================== */

 if (message === "3") {

  const api = await axios.get(RECENT_API);

  const matches = api.data.data || api.data;

  sessionMatches = matches;

  let output = "Recent Matches\n\n";

  matches.slice(0,5).forEach((m,i)=>{

   const name = parseMatchName(m.match_name);

   output += `${i+1}. ${name}\n`;

  });

  output += "\n9 More Matches\n0 Back";

  return res.send(output);
 }


/* ======================
   MATCH DETAIL
====================== */

 const index = parseInt(message) - 1;

 if (sessionMatches[index]) {

  const match = sessionMatches[index];

  const name = parseMatchName(match.match_name);

  const venue = match.location || "Unknown";

  const date = formatDate(match.start_date_time);

  const status = match.status || "";

  const score1 = match.team1_score || "";
  const score2 = match.team2_score || "";

  const result = match.result || "";

  let output = `Match Information

${name}

${score1}
${score2}

Venue: ${venue}
Date: ${date}

`;

  if (result) {

   output += `Result: ${result}\n\n`;

  } else {

   output += `${status}\n\n`;
  }

  output += "1 Refresh\n0 Back";

  return res.send(output);
 }


/* ======================
   BACK
====================== */

 if (message === "0") {

  return res.send(`Cricket Score Service

1 Live Matches
2 Upcoming Matches
3 Recent Matches

0 Exit`);
 }


 return res.send("Invalid Option");

});


/* ======================
   SERVER START
====================== */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

 console.log("Server Running on " + PORT);

});
