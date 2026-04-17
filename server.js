// server.js

const express = require("express")
const axios = require("axios")

const app = express()

app.use(express.json())
app.use(express.urlencoded({extended:true}))

const PORT = process.env.PORT || 3000
const START_COMMAND = "cricketscoreupdate"

// =====================
// APIs
// =====================

const LIVE_API =
"https://cricbuzz.autoaiassistant.com/api.php?action=live&type=all"

const UPCOMING_API =
"https://cricbuzz.autoaiassistant.com/api.php?action=upcoming&type=all"

const RECENT_API =
"https://cricbuzz.autoaiassistant.com/api.php?action=recent&type=all"

const DETAIL_API =
"https://cricbuzz.autoaiassistant.com/api.php?action=match&id="

// =====================
// SESSION STORE
// =====================

let sessions = {}

const SESSION_LIMIT = 5000

// =====================
// FETCH MATCHES
// =====================

async function fetchMatches(url){

 try{

  const res = await axios.get(url)

  return Array.isArray(res.data) ? res.data : []

 }catch(err){

  console.log("API error:",err.message)

  return []

 }

}

// =====================
// FETCH MATCH DETAIL
// =====================

async function fetchMatchDetail(id){

 try{

  const res = await axios.get(`${DETAIL_API}${id}`)

  return res.data || {}

 }catch(err){

  console.log("Detail error:",err.message)

  return {}

 }

}

// =====================
// TEAM SHORT NAME
// =====================

function shortTeam(name){

 if(!name) return ""

 return name
 .split(" ")
 .map(w=>w[0])
 .join("")
 .toUpperCase()
 .substring(0,3)

}

// =====================
// EXTRACT TEAMS
// =====================

function extractTeams(matchName){

 const regex = /([A-Za-z ]+)\s+vs\s+([A-Za-z ]+)/i

 const m = matchName.match(regex)

 if(!m) return null

 return {
  t1: shortTeam(m[1]),
  t2: shortTeam(m[2])
 }

}

// =====================
// MATCH TITLE
// =====================

function matchTitle(match){

 const name = match.match_name || ""

 const typeMatch =
 name.match(/(\d+(st|nd|rd|th)\sTest|\d+(st|nd|rd|th)\sODI|\d+(st|nd|rd|th)\sT20I|\d+(st|nd|rd|th)\sunofficial\sTest)/i)

 const matchType = typeMatch ? typeMatch[0] : "Match"

 const teams = extractTeams(name)

 if(teams){

  return `${matchType} . ${teams.t1} VS ${teams.t2}`

 }

 return matchType

}

// =====================
// MATCH LIST MENU
// =====================

function showMatches(session){

 const start = session.page * 5
 const end = start + 5

 const list = session.matches.slice(start,end)

 let title = "Matches"

 if(session.type==="live") title="Live Matches"
 if(session.type==="upcoming") title="Upcoming Matches"
 if(session.type==="recent") title="Recent Matches"

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

// =====================
// MATCH INFO
// =====================

function formatMatchInfo(match,type){

 let text = `Match Information\n\n`

 text += `${match.match_name || ""}\n\n`

 if(type==="live") text += "Live Match\n\n"

 if(type==="upcoming") text += "Upcoming Match\n\n"

 if(type==="recent" && match.result){

  text += `${match.result}\n\n`

 }

 text += "1 Refresh\n0 Back"

 return text

}

// =====================
// MAIN MENU
// =====================

function mainMenu(){

 return `Cricket Score Update

1 Live Matches
2 Upcoming Matches
3 Recent Matches`

}

// =====================
// SMS LISTENER
// =====================

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

  // start command
  if(message.includes(START_COMMAND)){

   session.menu="main"

   return res.send(mainMenu())

  }

  // MAIN MENU
  if(session.menu==="main"){

   if(message==="1"){

    session.matches = await fetchMatches(LIVE_API)
    session.type="live"

   }
   else if(message==="2"){

    session.matches = await fetchMatches(UPCOMING_API)
    session.type="upcoming"

   }
   else if(message==="3"){

    session.matches = await fetchMatches(RECENT_API)
    session.type="recent"

   }
   else{

    return res.send(mainMenu())

   }

   session.menu="matches"
   session.page=0

   return res.send(showMatches(session))

  }

  // MATCH LIST
  if(session.menu==="matches"){

   if(message==="0"){

    session.menu="main"

    return res.send(mainMenu())

   }

   if(message==="9"){

    session.page++

    return res.send(showMatches(session))

   }

   const index = (session.page*5)+(parseInt(message)-1)

   if(session.matches[index]){

    const match = session.matches[index]

    session.matchId = match.match_id

    const detail = await fetchMatchDetail(session.matchId)

    session.menu="score"

    return res.send(formatMatchInfo(detail,session.type))

   }

  }

  // MATCH DETAIL
  if(session.menu==="score"){

   if(message==="1"){

    const detail = await fetchMatchDetail(session.matchId)

    return res.send(formatMatchInfo(detail,session.type))

   }

   if(message==="0"){

    session.menu="matches"

    return res.send(showMatches(session))

   }

  }

  return res.send(mainMenu())

 }catch(err){

  console.log("SMS error:",err.message)

  res.send("Service temporarily unavailable")

 }

})

// =====================
// HEALTH CHECK
// =====================

app.get("/",(req,res)=>{

 res.send("Cricket Score Server Running")

})

// =====================
// SERVER START
// =====================

app.listen(PORT,()=>{

 console.log("Server running on port",PORT)

})
