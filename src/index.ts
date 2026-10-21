import { createServer } from './server.js';

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const host = '0.0.0.0';
const app = createServer();

app.listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port}`);
});
