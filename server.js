const express = require("express");
const axios = require("axios");
const config = require("./config.json");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =======================
// API
// =======================

const LIVE_API =
"https://cricbuzz.autoaiassistant.com/api.php?action=live&type=all";

const UPCOMING_API =
"https://cricbuzz.autoaiassistant.com/api.php?action=upcoming&type=all";

const RECENT_API =
"https://cricbuzz.autoaiassistant.com/api.php?action=recent&type=all";

const DETAIL_API =
"https://cricbuzz.autoaiassistant.com/api.php?action=match&id=";


// =======================
// SESSION
// =======================

let sessions = {};
const SESSION_LIMIT = 5000;


// =======================
// FETCH MATCH LIST
// =======================

async function fetchMatches(url) {

 try {

  const res = await axios.get(url);
  return res.data || [];

 } catch (err) {

  console.log("API Error:", err.message);
  return [];

 }

}


// =======================
// FETCH MATCH DETAIL
// =======================

async function fetchMatchDetail(id) {

 try {

  const res = await axios.get(`${DETAIL_API}${id}`);
  return res.data || {};

 } catch (err) {

  console.log("Detail API Error:", err.message);
  return {};

 }

}


// =======================
// SHORT MATCH NAME
// =======================

function shortMatch(match) {

 const name = match.match_name || "";

 const matchType = name.match(/(\d+(st|nd|rd|th)\sMatch|\d+(st|nd|rd|th)\sODI|\d+(st|nd|rd|th)\sT20I|\d+(st|nd|rd|th)\sTest)/i);

 const type = matchType ? matchType[0] : "Match";

 const teams = name.match(/[A-Z]{2,3}/g);

 if (teams && teams.length >= 2) {

  return `${type} . ${teams[0]} VS ${teams[1]}`;

 }

 return type;

}


// =======================
// SHOW MATCH LIST
// =======================

function showMatches(session) {

 const start = session.page * 5;
 const end = start + 5;

 const list = session.matches.slice(start, end);

 let title = "Matches";

 if (session.type === "live") title = "Live Matches";
 if (session.type === "upcoming") title = "Upcoming Matches";
 if (session.type === "recent") title = "Recent Matches";

 let menu = `${title}\n\n`;

 list.forEach((m, i) => {

  menu += `${i + 1}. ${shortMatch(m)}\n`;

 });

 if (end < session.matches.length) {

  menu += `9 More Matches\n`;

 }

 menu += `0 Back`;

 return menu;

}


// =======================
// MATCH INFORMATION
// =======================

function matchInfo(match, type) {

 let text = `Match Information\n\n`;

 text += `${shortMatch(match)}\n\n`;

 const venue = match.location || "Unknown";

 if (match.score && match.score.length) {

  match.score.forEach(s => {

   text += `${s}\n`;

  });

  text += "\n";

 }

 text += `Venue: ${venue}\n`;

 if (type === "live") {

  text += `Live\n\n`;

 }

 else if (type === "upcoming") {

  text += `Date: ${match.start_date_time}\n`;
  text += `Upcoming\n\n`;

 }

 else if (type === "recent") {

  text += `${match.status}\n\n`;

 }

 text += `1 Refresh\n0 Back`;

 return text;

}


// =======================
// SMS LISTENER
// =======================

app.post("/sms_listener", async (req, res) => {

 try {

  const message = (req.body.message || "").trim().toLowerCase();
  const user = req.body.sourceAddress || "demo";

  if (Object.keys(sessions).length > SESSION_LIMIT) {

   sessions = {};

  }

  if (!sessions[user]) {

   sessions[user] = {
    menu: "main",
    matches: [],
    selected: null,
    page: 0,
    type: ""
   };

  }

  const session = sessions[user];


  // START

  if (message.includes(config.app.shortcode)) {

   session.menu = "main";
   session.page = 0;

   return res.send(config.menu.main);

  }


  // MAIN MENU

  if (session.menu === "main") {

   if (message === "1") {

    session.matches = await fetchMatches(LIVE_API);
    session.type = "live";

   }

   else if (message === "2") {

    session.matches = await fetchMatches(UPCOMING_API);
    session.type = "upcoming";

   }

   else if (message === "3") {

    session.matches = await fetchMatches(RECENT_API);
    session.type = "recent";

   }

   else {

    return res.send(config.menu.default);

   }

   session.menu = "matches";
   session.page = 0;

   return res.send(showMatches(session));

  }


  // MATCH LIST

  if (session.menu === "matches") {

   if (message === "0") {

    session.menu = "main";
    return res.send(config.menu.main);

   }

   if (message === "9") {

    session.page++;
    return res.send(showMatches(session));

   }

   const index = (session.page * 5) + (parseInt(message) - 1);

   if (session.matches[index]) {

    const match = session.matches[index];

    const matchId = match.match_id;

    const detail = await fetchMatchDetail(matchId);

    session.selected = detail;
    session.menu = "info";

    return res.send(matchInfo(detail, session.type));

   }

   return res.send("Invalid option\n\n0 Back");

  }


  // MATCH INFO

  if (session.menu === "info") {

   if (message === "1") {

    return res.send(matchInfo(session.selected, session.type));

   }

   if (message === "0") {

    session.menu = "matches";
    return res.send(showMatches(session));

   }

  }

  return res.send(config.menu.default);

 } catch (err) {

  console.log("SMS Error:", err.message);
  res.send("Service temporarily unavailable");

 }

});


// =======================
// HEALTH CHECK
// =======================

app.get("/", (req, res) => {

 res.send("BDApps Cricket Server Running");

});


// =======================
// SERVER START
// =======================

const PORT = process.env.PORT || config.server.port;

app.listen(PORT, () => {

 console.log("Server running on port", PORT);

});
