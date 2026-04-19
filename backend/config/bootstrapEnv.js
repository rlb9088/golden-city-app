const dotenv = require('dotenv');

function loadDotenv() {
  if (process.env.NODE_ENV !== 'test') {
    dotenv.config();
  }
}

function bootstrapEnvironment() {
  loadDotenv();
  return null;
}

module.exports = {
  bootstrapEnvironment,
  loadDotenv,
};
