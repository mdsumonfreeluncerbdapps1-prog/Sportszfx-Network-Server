const express = require("express");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// SMS Listener
app.post("/sms_listener", (req, res) => {

console.log("SMS Received:", req.body);

res.send("Welcome to Cricket Live Score Service");

});

// USSD Listener
app.post("/ussd_listener", (req, res) => {

console.log("USSD Request:", req.body);

res.send("1. Live Match\n2. Bangladesh Match\n3. IPL Match");

});

// Subscription Listener
app.post("/sub_listener", (req, res) => {

console.log("Subscription Event:", req.body);

res.send("Subscription Successful");

});

// Root Test
app.get("/", (req,res)=>{
res.send("BDapps Cricket Server Running");
});

app.listen(10000, () => {

console.log("Server running on port 10000");

});
