import app from './app.js';
import { env } from './config/env.js';

app.listen(env.port, () => {
  console.log(`22Studio Payroll backend running on http://localhost:${env.port}`);
});
