import express, {json} from 'express';
import { MongoClient } from 'mongodb';
import cors from 'cors';
import chalk from 'chalk';
import dayjs from 'dayjs';
import dotenv from 'dotenv';
dotenv.config();


const server = express();
server.use(json());
server.use(cors());

//Se conectando ao banco do mongo
const mongoClient = new MongoClient(process.env.MONGO_URI);
await mongoClient.connect();
const db = mongoClient.db("api_bate_papo_uol");

server.get("/participants", async (req,res) => {
  try {
    const participantsCollection = db.collection("participants");
    const participants = await participantsCollection.find().toArray();
    res.send(participants);
  } catch(e) {
      console.log(e);
      res.sendStatus(500);
  }
});

server.post("/participants", async(req,res) => {
  const  user = req.body;
  try {
    const participantsCollection = db.collection("participants");
    //Encontrar participante
    const participant = await participantsCollection.findOne({ name: user.name });
    if(participant) {
      res.sendStatus(409);
      return;
    }

    //Salvando o participante
    await participantsCollection.insertOne({name: user.name, lastStatus: Date.now()});

    const messagesCollection = db.collection("messages");
    messagesCollection.insertOne({
      from: user.name, 
      to: 'Todos', 
      text: 'entra na sala...', 
      type: 'status', 
      time: dayjs().locale('pt-br').format('HH:mm:ss')
    });
    res.sendStatus(201);

  } catch(e) {
      console.log(e);
  }
});


const port = process.env.PORT;
server.listen(port, () => {
  console.log(chalk.bold.green(`Running on http://localhost:${port}`));
})
