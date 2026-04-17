// server.js

const express = require("express")
const axios = require("axios")

const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// =======================
// CONFIG
// =======================

const PORT = process.env.PORT || 3000

const START_COMMAND = "cricketscoreupdate"

const SESSION_LIMIT = 5000

// =======================
// APIS
// =======================

const LIVE_API =
"https://cricbuzz.autoaiassistant.com/api.php?action=live&type=all"

const UPCOMING_API =
"https://cricbuzz.autoaiassistant.com/api.php?action=upcoming&type=all"

const RECENT_API =
"https://cricbuzz.autoaiassistant.com/api.php?action=recent&type=all"

const DETAIL_API =
"https://cricbuzz.autoaiassistant.com/api.php?action=match&id="

// =======================
// SESSION STORE
// =======================

let sessions = {}

// =======================
// FETCH MATCH LIST
// =======================

async function fetchMatches(url){

 try{

  const res = await axios.get(url)

  if(Array.isArray(res.data)) return res.data

  return []

 }catch(err){

  console.log("Match API error:",err.message)

  return []

 }

}

// =======================
// FETCH MATCH DETAIL
// =======================

async function fetchMatchDetail(id){

 try{

  const res = await axios.get(`${DETAIL_API}${id}`)

  return res.data || {}

 }catch(err){

  console.log("Detail API error:",err.message)

  return {}

 }

}

// =======================
// TEAM SHORT CODE
// =======================

function shortTeam(name){

 if(!name) return ""

 return name
  .trim()
  .split(" ")
  .map(w => w[0])
  .join("")
  .toUpperCase()
  .substring(0,3)

}

// =======================
// MATCH TITLE
// =======================

function matchTitle(match){

 const name = match.match_name || ""

 const typeMatch =
 name.match(/(\d+(st|nd|rd|th)\sMatch|\d+(st|nd|rd|th)\sODI|\d+(st|nd|rd|th)\sT20I|\d+(st|nd|rd|th)\sTest)/i)

 const matchType = typeMatch ? typeMatch[0] : "Match"

 const team1 = shortTeam(match.team1 || "")
 const team2 = shortTeam(match.team2 || "")

 if(team1 && team2){
  return `${matchType} . ${team1} VS ${team2}`
 }

 return matchType

}

// =======================
// MATCH LIST MENU
// =======================

function showMatches(session){

 const start = session.page * 5
 const end = start + 5

 const list = session.matches.slice(start,end)

 let title = "Matches"

 if(session.type === "live") title = "Live Matches"
 if(session.type === "upcoming") title = "Upcoming Matches"
 if(session.type === "recent") title = "Recent Matches"

 let menu = `${title}\n\n`

 list.forEach((m,i)=>{

  menu += `${i+1}. ${matchTitle(m)}\n`

 })

 if(end < session.matches.length){

  menu += "9 More Matches\n"

 }

 menu += "0 Back"

 return menu

}

// =======================
// MATCH DETAIL SCREEN
// =======================

function formatMatchInfo(match,type){

 let text = `Match Information\n\n`

 text += `${match.match_name || ""}\n\n`

 const team1 = match.team1 || ""
 const team2 = match.team2 || ""

 const score1 = match.score1 || ""
 const score2 = match.score2 || ""

 const overs1 = match.overs1 || ""
 const overs2 = match.overs2 || ""

 if(score1){

  text += `${team1} ${score1} (${overs1})\n`

 }

 if(score2){

  text += `${team2} ${score2} (${overs2})\n`

 }

 if(type === "live"){

  text += "\nLive Match\n"

 }

 if(type === "upcoming"){

  text += "\nUpcoming Match\n"

 }

 if(type === "recent" && match.result){

  text += `\n${match.result}\n`

 }

 text += "\n1 Refresh\n0 Back"

 return text

}

// =======================
// MAIN MENU
// =======================

function mainMenu(){

 return (
"Cricket Score Update\n\n"+
"1 Live Matches\n"+
"2 Upcoming Matches\n"+
"3 Recent Matches"
 )

}

// =======================
// SMS LISTENER
// =======================

app.post("/sms_listener", async (req,res)=>{

 try{

  const message = (req.body.message || "").trim().toLowerCase()
  const user = req.body.sourceAddress || "demo"

  if(Object.keys(sessions).length > SESSION_LIMIT){

   sessions = {}

  }

  if(!sessions[user]){

   sessions[user] = {
    menu:"main",
    matches:[],
    page:0,
    type:"",
    matchId:null
   }

  }

  const session = sessions[user]

  // =======================
  // START COMMAND
  // =======================

  if(message.includes(START_COMMAND)){

   session.menu = "main"

   return res.send(mainMenu())

  }

  // =======================
  // MAIN MENU
  // =======================

  if(session.menu === "main"){

   if(message === "1"){

    session.matches = await fetchMatches(LIVE_API)
    session.type = "live"

   }
   else if(message === "2"){

    session.matches = await fetchMatches(UPCOMING_API)
    session.type = "upcoming"

   }
   else if(message === "3"){

    session.matches = await fetchMatches(RECENT_API)
    session.type = "recent"

   }
   else{

    return res.send(mainMenu())

   }

   session.menu = "matches"
   session.page = 0

   return res.send(showMatches(session))

  }

  // =======================
  // MATCH LIST
  // =======================

  if(session.menu === "matches"){

   if(message === "0"){

    session.menu = "main"

    return res.send(mainMenu())

   }

   if(message === "9"){

    session.page++

    return res.send(showMatches(session))

   }

   const index = (session.page*5) + (parseInt(message)-1)

   if(session.matches[index]){

    const match = session.matches[index]

    session.matchId = match.match_id

    const detail = await fetchMatchDetail(session.matchId)

    session.menu = "score"

    return res.send(formatMatchInfo(detail,session.type))

   }

  }

  // =======================
  // MATCH DETAIL
  // =======================

  if(session.menu === "score"){

   if(message === "1"){

    const detail = await fetchMatchDetail(session.matchId)

    return res.send(formatMatchInfo(detail,session.type))

   }

   if(message === "0"){

    session.menu = "matches"

    return res.send(showMatches(session))

   }

  }

  return res.send(mainMenu())

 }catch(err){

  console.log("SMS error:",err.message)

  res.send("Service temporarily unavailable")

 }

})

// =======================
// HEALTH CHECK
// =======================

app.get("/",(req,res)=>{

 res.send("Cricket SMS Server Running")

})

// =======================
// SERVER START
// =======================

app.listen(PORT,()=>{

 console.log("Server running on port",PORT)

})
