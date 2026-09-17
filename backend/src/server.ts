import 'dotenv/config';
import { createApp } from './app.js';

const port = Number(process.env.PORT || 4000);
const host = '0.0.0.0';
const app = createApp();

app.listen(port, host, () => {
  console.log(`Feedback backend listening on http://localhost:${port}`);
  console.log(`Feedback backend listening on http://${host}:${port}`);
});