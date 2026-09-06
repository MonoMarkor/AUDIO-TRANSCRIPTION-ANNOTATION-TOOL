import express from 'express';
import cors from 'cors';
// import { PrismaClient } from '../generated/prisma'
import uploadRouter from './routes/upload'
import transcriptsRouter from './routes/transcripts'
import itemsRouter from './routes/items'
import pairingRouter from './routes/pairing'

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/api/upload', uploadRouter)
app.use('/api/upload/transcripts', transcriptsRouter)
app.use('/api/items', itemsRouter)
app.use('/api/pairing', pairingRouter)
// app.get('/api/hello', (req, res) => {
//   const name = typeof req.query.name === 'string' ? req.query.name : 'World';
//   res.json({ message: `Hello ${name}`});
// });

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
