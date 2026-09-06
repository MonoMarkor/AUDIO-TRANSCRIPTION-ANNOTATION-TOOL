import express from 'express';
import cors from 'cors';
// import { PrismaClient } from '../generated/prisma'
import uploadRouter from './routes/upload'

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/api/upload', uploadRouter)

// app.get('/api/hello', (req, res) => {
//   const name = typeof req.query.name === 'string' ? req.query.name : 'World';
//   res.json({ message: `Hello ${name}`});
// });

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
