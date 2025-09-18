const { createClient } =  require ('@supabase/supabase-js')
const express = require("express")
const bodyparser = require("body-parser")
const app = express()

app.use(bodyparser.urlencoded())
app.set('view engine', 'ejs')
app.use(express.static(__dirname + '/public'))


// Create a single supabase client for interacting with your database
const supabase = createClient('https://pibvwljdhclnzopeznsz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpYnZ3bGpkaGNsbnpvcGV6bnN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ0OTA1NzIsImV4cCI6MjA2MDA2NjU3Mn0.DfKWUb4e37xeoG3NOnOot3D2NWE4mtx0xZvzy6xEYiA')

var fruits = ''
var arrayOfFruits = []
var arrayOfIDs = []
app.get("/", async (req, res) =>{
    var date = new Date()
    var day = date.toDateString()
    var {data} = await supabase.from("Fruits").select().not('id', 'in', `(${arrayOfIDs.join(',')})`)

    for (var i = 0; i < data.length; i++) {
        arrayOfFruits.push(data[i].name)
        arrayOfIDs.push(data[i].id)
    }

    res.render("home", {date : day, newFruits: arrayOfFruits})
})

app.get("/try", (req, res) => {
    res.render("try")
})

app.post("/", async (req, res) => {
    fruits = req.body.newFruit;
    var button = req.body.button;
    var newValue = req.body.newValue;
    var oldValue = req.body.oldValue;
    var deletedItem = req.body.delete;

    if (button == 'insert'){
        // write operation
        await supabase
            .from('Fruits')
            .insert({ name: fruits })
    } else if(button == 'update'){
        //update operation
        const {data} = await supabase
            .from('Fruits')
            .update({name: newValue})
            .eq('name', oldValue)
        for (var i=0; i < arrayOfFruits.length; i++){
            if (arrayOfFruits[i] == oldValue){
                 arrayOfIDs.pop(arrayOfIDs[i])
                 arrayOfFruits.pop(arrayOfFruits[i])
            }
        }
    } else {
        // delete querry 
        await supabase
            .from('Fruits')
            .delete()
            .eq('name', deletedItem)
        for (var i = 0; i < arrayOfFruits.length; i++){
             if (arrayOfFruits[i] == deletedItem){
                 arrayOfFruits.pop(arrayOfFruits[i])
                 arrayOfIDs.pop(arrayOfIDs[i])
             }
        }


    }           

    res.redirect("/")
})


app.listen(3000, (req, res) =>{
    console.log("server is running on port 3000")
})