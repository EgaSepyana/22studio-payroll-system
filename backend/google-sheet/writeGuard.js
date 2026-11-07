export function hasYesFlag(argv) {
  return argv.includes('--yes');
}

export async function confirmSheetWrite({ argv, spreadsheetId, fetchTitle, log = console.log }) {
  const title = await fetchTitle(spreadsheetId);
  log(`Target spreadsheet: "${title}" (${spreadsheetId})`);
  if (!hasYesFlag(argv)) {
    log('No changes made. Confirm this is a DEV copy, then re-run with --yes to write.');
    return false;
  }
  return true;
}

// Entry point for write-scripts: prints the target spreadsheet title and exits
// (code 1, nothing written) unless `--yes` was passed.
export async function guardSheetWrite(argv = process.argv.slice(2)) {
  const { getSheetsClient, SPREADSHEET_ID } = await import('./sheetClient.js');
  const fetchTitle = async (spreadsheetId) => {
    const sheets = await getSheetsClient();
    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'properties.title' });
    return meta.data.properties.title;
  };
  const confirmed = await confirmSheetWrite({ argv, spreadsheetId: SPREADSHEET_ID, fetchTitle });
  if (!confirmed) process.exit(1);
}
