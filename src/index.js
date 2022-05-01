import express, {json} from 'express';
import { MongoClient } from 'mongodb';
import cors from 'cors';
import chalk from 'chalk';
import dayjs from 'dayjs';
import dotenv from 'dotenv';
import joi from 'joi';
dotenv.config();


const server = express();
server.use(json());
server.use(cors());

//Se conectando ao banco do mongo
const mongoClient = new MongoClient(process.env.MONGO_URI);
await mongoClient.connect();
const db = mongoClient.db("api_bate_papo_uol");

const userSchema = joi.object({
  name: joi.string().required()
});


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

server.post("/participants", async (req,res) => {
  const  user = req.body;
  //Só vai validar uma propriedade chamada "name".
  const validation = userSchema.validate(user);
  if (validation.error) {
    console.log(validation.error.details);
    res.sendStatus(422);
  }
  try {
    const participantsCollection = db.collection("participants");
    //Encontrar participante
    const participant = await participantsCollection.findOne({ name: user.name });
    //Se der tempo dar conflito quando valores do name tiverem caracteres iguais.
    if(participant) {
      res.sendStatus(409);
      return;
    }

    //Salvando o participante
    await participantsCollection.insertOne({name: user.name, lastStatus: Date.now()});

    const messagesCollection = db.collection("messages");
    await messagesCollection.insertOne({
      from: user.name, 
      to: 'Todos', 
      text: 'entra na sala...', 
      type: 'status', 
      time: dayjs().locale('pt-br').format('HH:mm:ss')
    });
    res.sendStatus(201);

  } catch(e) {
      console.log(e);
      res.sendStatus(500);
  }
});

server.post("/messages", async (req,res) => {
  const message = req.body;
  const sender = req.headers.user;

  try {
    const messagesCollection = db.collection("participants");
    await messagesCollection.insertOne({
        ...message,
        from: sender,
        time: dayjs().locale('pt-br').format('HH:mm:ss')

    })
    res.sendStatus(201);
  } catch(e) {
      console.log(e);
      res.sendStatus(500);
  }
});


const port = process.env.PORT;
server.listen(port, () => {
  console.log(chalk.bold.green(`Running on http://localhost:${port}`));
})
