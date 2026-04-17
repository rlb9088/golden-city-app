const authService = require('../services/auth.service');

async function login(req, res) {
  const { username, password } = req.body;
  const result = await authService.login(username, password);
  res.json({ status: 'success', data: result });
}

async function refresh(req, res) {
  const { refreshToken } = req.body;
  const result = await authService.refresh(refreshToken);
  res.json({ status: 'success', data: result });
}

async function me(req, res) {
  res.json({ status: 'success', data: req.auth });
}

module.exports = { login, refresh, me };
