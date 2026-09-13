import { spawn } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const processes = [
  spawn(npmCommand, ['run', 'dev', '--workspace=apps/web'], {
    stdio: 'inherit',
    env: process.env,
  }),
  spawn(npmCommand, ['run', 'dev', '--workspace=apps/worker'], {
    stdio: 'inherit',
    env: process.env,
  }),
];

let stopping = false;

function stopAll(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  for (const child of processes) {
    if (!child.killed) child.kill(signal);
  }
}

for (const child of processes) {
  child.once('error', (error) => {
    console.error(`[dev] Could not start a development process: ${error.message}`);
    process.exitCode = 1;
    stopAll();
  });
  child.once('exit', (code, signal) => {
    if (stopping) return;
    if (code && code !== 0) {
      console.error(`[dev] A development process exited with code ${code}.`);
      process.exitCode = code;
    } else if (signal) {
      console.error(`[dev] A development process exited after ${signal}.`);
    }
    stopAll();
  });
}

process.once('SIGINT', () => stopAll('SIGINT'));
process.once('SIGTERM', () => stopAll('SIGTERM'));
