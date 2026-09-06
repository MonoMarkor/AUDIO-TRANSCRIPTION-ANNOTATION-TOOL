import express from 'express';
import cors from 'cors';
// import { PrismaClient } from '../generated/prisma'
import uploadRouter from './routes/upload'
import transcriptsRouter from './routes/transcripts'
import itemsRouter from './routes/items'
import pairingRouter from './routes/pairing'
import conditionsRouter from './routes/conditions'
import audioRouter from './routes/audio'

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/api/upload', uploadRouter)
app.use('/api/upload/transcripts', transcriptsRouter)
app.use('/api/items', itemsRouter)
app.use('/api/items', conditionsRouter)
app.use('/api/items', audioRouter)
app.use('/api/pairing', pairingRouter)

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
