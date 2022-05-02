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
  const userSchema = joi.object({
    name: joi.string().required()
  });

  const validation = userSchema.validate(user, { abortEarly: true });
  if (validation.error) {
    console.log(validation.error.details.map(detail => detail.message));
    res.sendStatus(422);
    return;
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
  const sender = req.headers.user;
  const message = {...req.body, from: sender};
  const participantsCollection = db.collection("participants");
  const participant = await participantsCollection.findOne({ name: sender });
  console.log('participante existente:', participant);

  const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid('message','private_message').required(),
    from: joi.string().valid(participant.name).required(),
  });

  const validation = messageSchema.validate(message, { abortEarly: true });
  if (validation.error) {
    console.log(validation.error.details);
    res.sendStatus(422);
    return;
  }

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

server.get("/messages", async (req,res) => {
  const limit = parseInt(req.query.limit);
  const user = req.headers.user;

  function filteredMessages(messages){
    if(messages.type === 'message' || messages.from === user || messages.to === user || messages.to === 'Todos'){
      return true;
    } else {
      return false;
    }
  }

  try {
    const messagesCollection = db.collection("messages");
    const messages = await messagesCollection.find().toArray();

    const messagesFilter = messages.filter(messages => filteredMessages(messages));
    if(!limit || limit === NaN){
      res.send(messagesFilter.slice(-limit));
      return;
    }

    res.send(messagesFilter);
  } catch(e) {
      console.log(e);
      res.sendStatus(500);
  }
});

server.post('/status', async (req,res) => {
  const user = req.headers.user;
  if(!user){
    res.sendStatus(404);
    return;
  }

  try {
    const participantsCollection = db.collection("participants");
    //Encontrar participante
    const participant = await participantsCollection.findOne({ name: user.name });
    if(!participant) {
      res.sendStatus(404);
      return;
    }

    //Atualizando o atributo lastStatus se o participante existir
    //O $set vai sobrescrever o valor de uma propriedade
    await participantsCollection.updateOne({ 
			_id: user._id 
		}, { $set: {lastStatus: Date.now()} });

    res.sendStatus(200);

  } catch(e) {
      console.log(e);
      res.sendStatus(500);
  }
})


const port = process.env.PORT;
server.listen(port, () => {
  console.log(chalk.bold.green(`Running on http://localhost:${port}`));
})
