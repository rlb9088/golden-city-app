const fs = require('fs');
const os = require('os');
const path = require('path');
const dotenv = require('dotenv');

function loadDotenv() {
  if (process.env.NODE_ENV !== 'test') {
    dotenv.config();
  }
}

function bootstrapGoogleCredentialsFromBase64() {
  const encodedCredentials = process.env.GOOGLE_CREDENTIALS_BASE64;
  if (!encodedCredentials) {
    return null;
  }

  const credentialsPath = path.join(os.tmpdir(), 'appgolden-google-creds.json');
  const credentialsBuffer = Buffer.from(encodedCredentials, 'base64');

  fs.writeFileSync(credentialsPath, credentialsBuffer);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;

  return credentialsPath;
}

function bootstrapEnvironment() {
  loadDotenv();
  return {
    googleCredentialsPath: bootstrapGoogleCredentialsFromBase64(),
  };
}

module.exports = {
  bootstrapEnvironment,
  bootstrapGoogleCredentialsFromBase64,
};
