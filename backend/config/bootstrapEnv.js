const fs = require('fs');
const os = require('os');
const path = require('path');
const dotenv = require('dotenv');

function loadDotenv() {
  if (process.env.NODE_ENV !== 'test') {
    dotenv.config();
  }
}

function ensureGoogleCredentialsFile() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || !process.env.GOOGLE_CREDENTIALS_BASE64) {
    return null;
  }

  const credentialsBuffer = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64');
  const tempDir = path.join(os.tmpdir(), 'appgolden-google-creds');
  const credentialsPath = path.join(tempDir, 'google-credentials.json');

  fs.mkdirSync(tempDir, { recursive: true });
  fs.writeFileSync(credentialsPath, credentialsBuffer);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;

  return credentialsPath;
}

function bootstrapEnvironment() {
  loadDotenv();
  ensureGoogleCredentialsFile();
  return null;
}

module.exports = {
  bootstrapEnvironment,
  ensureGoogleCredentialsFile,
  loadDotenv,
};
