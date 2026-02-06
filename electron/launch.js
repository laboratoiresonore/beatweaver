#!/usr/bin/env node
/**
 * Electron launcher - ensures ELECTRON_RUN_AS_NODE is not set
 * This prevents issues where npm sets this variable and breaks electron
 */
const { spawn } = require('child_process');
const path = require('path');

// Remove the problematic env var
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

// Find electron executable
const electronPath = require.resolve('electron/cli.js');

// Spawn electron with clean environment
const child = spawn(process.execPath, [electronPath, '.'], {
  env,
  stdio: 'inherit',
  cwd: path.dirname(__dirname)
});

child.on('close', (code) => {
  process.exit(code);
});
