const express = require("express")
const axios = require("axios")
var qs = require('qs')
const app = express()
const port = 3000

app.get("/", async (req, res) => {
    var cityName = "Limbe"
    var apiKey = "646753a1fce30c7f34f6a6fff605ec5a"
    var result = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${cityName}&appid=${apiKey}`)
    var main = result.data.weather[0].main
    var description = result.data.weather[0].description
    console.log(main)
    res.send(`the weather today is ${main} and the description is ${description}`)


    //done getting the weather
    //sending the weather as a whatsApp message
    
    var token = "dnq6xy7px5kwiue5"
    var data = qs.stringify({
        "token": token,
        "to": "+237675920113",
        "body": `Hello Cash the weather today is ${description}`
    });

    var INSTANCE_ID = "instance113969"
    var config = {
        method: 'post',
        url: `https://api.ultramsg.com/${INSTANCE_ID}/messages/chat`,
        headers: {
            'Content-type': 'application/x-www-form-urlencoded'
        },
        data: data
    };

    axios(config)
        .then(function (response) {
            try{
                console.log(JSON.stringify(response.data));
            }catch(error){
                console.log(error)
            }
        })
        .catch(function (error) {
            console.log(error);

        });
            
    })
app.listen(port, (req, res) => {
    console.log("Server is running on port 3000")

})