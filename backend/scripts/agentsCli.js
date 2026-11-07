import { parseArgs } from 'node:util';
import * as agentAdmin from '../services/agentAdminService.js';

const USAGE = `Usage:
  npm run agents:create -- --yes
  npm run agents:list
  npm run agents:rotate-key -- --username=<name> --yes
  npm run agents:rotate-key -- --all --yes
  npm run agents:disable -- --username=<name> [--enable] --yes`;

const COMMANDS = ['create', 'list', 'rotate-key', 'disable'];
const WRITE_COMMANDS = ['create', 'rotate-key', 'disable'];
const NEEDS_KEY_SECRET = ['create', 'rotate-key'];

export function parseAgentsArgs(argv) {
  const [command, ...rest] = argv;
  if (!COMMANDS.includes(command)) throw new Error(`Unknown command "${command ?? ''}"`);
  const { values } = parseArgs({
    args: rest,
    allowPositionals: false,
    options: {
      yes: { type: 'boolean' },
      all: { type: 'boolean' },
      enable: { type: 'boolean' },
      username: { type: 'string' },
    },
  });

  const allowed = { create: ['yes'], list: [], 'rotate-key': ['yes', 'username', 'all'], disable: ['yes', 'username', 'enable'] }[command];
  for (const flag of Object.keys(values)) {
    if (!allowed.includes(flag)) throw new Error(`--${flag} is not valid for agents:${command}`);
  }
  if (command === 'rotate-key' && Boolean(values.username) === Boolean(values.all)) {
    throw new Error('rotate-key needs exactly one of --username=<name> or --all');
  }
  if (command === 'disable' && !values.username) throw new Error('disable needs --username=<name>');
  return { command, ...values };
}

function printKeys(log, results) {
  log('');
  log('Keys are shown once and cannot be recovered. Store them now:');
  for (const { username, key } of results) log(`  ${username}  ${key}`);
}

// Returns the process exit code. Write commands call `confirm()` (prints the
// spreadsheet title, false without --yes) before touching the sheet.
export async function runAgentsCli({ argv, store, accounts, serverSecret, confirm, log = console.log, error = console.error }) {
  let args;
  try {
    args = parseAgentsArgs(argv);
  } catch (err) {
    error(`${err.message}\n\n${USAGE}`);
    return 1;
  }
  const { command } = args;

  if (NEEDS_KEY_SECRET.includes(command) && !serverSecret) {
    error('AGENT_KEY_SECRET is not set. Set it in backend/.env first.');
    return 1;
  }
  if (WRITE_COMMANDS.includes(command) && !(await confirm())) return 1;

  let partial = [];
  try {
    if (command === 'list') {
      const agents = await agentAdmin.listAgents({ store });
      if (agents.length === 0) log('No agent accounts.');
      for (const a of agents) {
        log(`${a.username}  prefix=${a.prefix || '-'}  ${a.disabled ? 'DISABLED' : 'enabled'}  scopes=${a.scopes.join(',') || '-'}`);
      }
    } else if (command === 'create') {
      const results = await agentAdmin.createAgents({ store, accounts, serverSecret });
      partial = results;
      for (const r of results) {
        const note = r.status !== 'created' && r.hasKey === false ? ' (no key yet: run agents:rotate-key)' : '';
        log(`${r.username}: ${r.status}${note}`);
      }
      const created = results.filter((r) => r.key);
      if (created.length > 0) printKeys(log, created);
    } else if (command === 'rotate-key') {
      const results = await agentAdmin.rotateKeys({ store, username: args.username, all: args.all, serverSecret });
      partial = results;
      if (results.length === 0) log('No agent accounts to rotate.');
      else {
        log(`Rotated ${results.length} key(s). The old keys no longer work.`);
        printKeys(log, results);
      }
    } else {
      const result = await agentAdmin.setDisabled({ store, username: args.username, disabled: !args.enable });
      log(`${result.username}: ${result.disabled ? 'disabled' : 'enabled'}`);
    }
    return 0;
  } catch (err) {
    error(`Failed: ${err.message}`);
    const issued = (err.partialResults ?? partial).filter((r) => r.key);
    if (issued.length > 0) {
      error('These keys were already issued before the failure. Store them:');
      printKeys(log, issued);
    }
    return 1;
  }
}
