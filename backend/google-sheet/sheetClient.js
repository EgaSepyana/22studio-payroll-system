import { google } from 'googleapis';
import { env } from '../config/env.js';

let sheetsClient = null;

export async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const authOptions = { scopes: ['https://www.googleapis.com/auth/spreadsheets'] };
  if (env.googleServiceAccountJson) {
    authOptions.credentials = JSON.parse(env.googleServiceAccountJson);
  } else {
    authOptions.keyFile = env.googleServiceAccountPath;
  }

  const auth = new google.auth.GoogleAuth(authOptions);

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

export const SPREADSHEET_ID = env.googleSheetsId;
