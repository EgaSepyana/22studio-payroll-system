import { env } from '../config/env.js';
import { AGENT_ACCOUNTS } from '../config/agentScopes.js';
import { UsersRepo } from '../google-sheet/models.js';
import { SPREADSHEET_ID } from '../google-sheet/sheetClient.js';
import { confirmSheetWrite, fetchSpreadsheetTitle } from '../google-sheet/writeGuard.js';
import { closeRedis } from '../config/redis.js';
import { runAgentsCli } from './agentsCli.js';

const argv = process.argv.slice(2);

const store = {
  getAll: () => UsersRepo.getAll({ fresh: true }),
  insert: (row) => UsersRepo.insert(row),
  updateById: (id, patch) => UsersRepo.updateById(id, patch),
};

const confirm = () => confirmSheetWrite({ argv, spreadsheetId: SPREADSHEET_ID, fetchTitle: fetchSpreadsheetTitle });

if (argv[0] === 'list') {
  console.log(`Target spreadsheet: "${await fetchSpreadsheetTitle(SPREADSHEET_ID)}" (${SPREADSHEET_ID})`);
}

try {
  process.exitCode = await runAgentsCli({
    argv,
    store,
    accounts: AGENT_ACCOUNTS,
    serverSecret: env.agentKeySecret,
    confirm,
  });
} finally {
  await closeRedis();
}
