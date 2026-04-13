const express = require("express");
const axios = require("axios");
const config = require("./config.json");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =======================
// CRICKET API
// =======================

const API_KEY = "a0a5a7d4-f83a-4cb6-ae97-91238413ec8c";
const API_URL = "https://api.cricapi.com/v1";

// =======================
// SESSIONS
// =======================

let sessions = {};
let scoreCache = {};
let subscribers = [];

// =======================
// FETCH MATCHES
// =======================

async function fetchMatches(type){

  try{

    const res = await axios.get(
      `${API_URL}/${type}?apikey=${API_KEY}`
    );

    return res.data.data || [];

  }catch(err){

    console.log("Match API error",err.message);
    return [];

  }

}

// =======================
// FETCH BALL BY BALL
// =======================

async function fetchScore(matchId){

  try{

    const res = await axios.get(
      `${API_URL}/match_scorecard?apikey=${API_KEY}&id=${matchId}`
    );

    if(res.data.data){

      scoreCache[matchId] = res.data.data;

    }

  }catch(err){

    console.log("Score API error",err.message);

  }

}

// =======================
// AUTO SCORE UPDATE
// =======================

setInterval(async ()=>{

  const ids = Object.keys(scoreCache);

  for(const id of ids){

    await fetchScore(id);

  }

},5000);

// =======================
// FORMAT SCORE
// =======================

function formatScore(match){

  const name = match.name || "Match";

  let score = "Score not available";

  if(match.score && match.score.length > 0){

    const s = match.score[0];

    score = `${s.r}/${s.w} (${s.o} overs)`;

  }

  const status = match.status || "";

  return `${name}

Score: ${score}

${status}

1. Ball by Ball
2. Refresh
0. Back`;

}

// =======================
// BALL BY BALL
// =======================

function ballByBall(match){

  if(!match.scorecard || !match.scorecard.length){

    return "Ball by ball data not available";

  }

  const innings = match.scorecard[0];

  let text = `${match.name}

Recent Balls:

`;

  innings.balls.slice(-6).forEach(b=>{

    text += `${b.over}.${b.ball} → ${b.runs} run
`;

  });

  text += `
0. Back`;

  return text;

}

// =======================
// AUTO BROADCAST SCORE
// =======================

async function broadcastScore(){

  try{

    const matches = await fetchMatches("currentMatches");

    if(matches.length === 0) return;

    const match = matches[0];

    const text = `${match.name}

${match.status}`;

    subscribers.forEach(number=>{

      console.log("Send SMS to:",number,text);

    });

  }catch(err){

    console.log("Broadcast error",err.message);

  }

}

setInterval(broadcastScore,60000);

// =======================
// SMS LISTENER
// =======================

app.post("/sms_listener", async (req,res)=>{

  try{

    const msg = (req.body.message || "").toLowerCase().trim();
    const user = req.body.sourceAddress || "demo";

    if(!sessions[user]){

      sessions[user] = {
        menu:"main",
        matches:[],
        selected:null
      };

    }

    const session = sessions[user];

    // SUBSCRIBE USER

    if(!subscribers.includes(user)){

      subscribers.push(user);

    }

    // MAIN MENU

    if(msg === config.app.shortcode){

      session.menu="main";

      return res.send(
`Cricket Service

1. Live Matches
2. IPL Matches
3. BPL Matches`
);

    }

    // LIVE MATCHES

    if(msg==="1"){

      session.matches = await fetchMatches("currentMatches");
      session.menu="matches";

    }

    // IPL FILTER

    if(msg==="2"){

      const matches = await fetchMatches("currentMatches");

      session.matches = matches.filter(m=>
        m.name.toLowerCase().includes("ipl")
      );

      session.menu="matches";

    }

    // BPL FILTER

    if(msg==="3"){

      const matches = await fetchMatches("currentMatches");

      session.matches = matches.filter(m=>
        m.name.toLowerCase().includes("bpl")
      );

      session.menu="matches";

    }

    // MATCH LIST

    if(session.menu==="matches"){

      let menu="Top Matches

";

      session.matches.slice(0,10).forEach((m,i)=>{

        menu+=`${i+1}. ${m.name}
`;

      });

      menu+="
0. Back";

      return res.send(menu);

    }

    // SELECT MATCH

    const index = parseInt(msg)-1;

    if(session.matches[index]){

      const match=session.matches[index];

      session.selected=match;
      session.menu="score";

      await fetchScore(match.id);

      return res.send(formatScore(scoreCache[match.id]||match));

    }

    // SCORE MENU

    if(session.menu==="score"){

      if(msg==="1"){

        return res.send(ballByBall(scoreCache[session.selected.id]));

      }

      if(msg==="2"){

        await fetchScore(session.selected.id);

        return res.send(
          formatScore(scoreCache[session.selected.id])
        );

      }

      if(msg==="0"){

        session.menu="main";

        return res.send(config.menu.main);

      }

    }

    res.send("Send CRICKETSCOREUPDATE");

  }catch(err){

    console.log(err.message);
    res.send("Server error");

  }

});

// =======================
// ROOT
// =======================

app.get("/",(req,res)=>{

  res.send("BDapps Cricket Service Running");

});

// =======================
// SERVER
// =======================

const PORT = process.env.PORT || config.server.port;

app.listen(PORT,()=>{

  console.log("Server running on port",PORT);

});
