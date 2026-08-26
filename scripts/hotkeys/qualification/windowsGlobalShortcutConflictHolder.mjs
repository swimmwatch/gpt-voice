import { app, globalShortcut } from 'electron';

const CONFLICT_ACCELERATOR = 'Ctrl+Shift+F10';
const EXIT_CODE_CONFIGURATION_INVALID = 64;
const EXIT_CODE_REGISTRATION_REJECTED = 2;
const PRIVATE_ROOT_ENVIRONMENT_VARIABLE = 'WINDOWS_HOTKEY_QUALIFICATION_PRIVATE_ROOT';
const STATUS_CONFIGURATION_INVALID = 'configuration-invalid\n';
const STATUS_REGISTERED = 'registered\n';
const STATUS_REJECTED = 'rejected\n';

let disposed = false;

function dispose() {
  if (disposed) return;
  disposed = true;
  try {
    globalShortcut.unregister(CONFLICT_ACCELERATOR);
  } catch {
    // The process owns only this one best-effort cleanup operation.
  }
}

function exit(code) {
  dispose();
  app.exit(code);
}

function register() {
  try {
    if (!globalShortcut.register(CONFLICT_ACCELERATOR, () => undefined)) {
      process.stdout.write(STATUS_REJECTED);
      exit(EXIT_CODE_REGISTRATION_REJECTED);
      return;
    }
    if (!globalShortcut.isRegistered(CONFLICT_ACCELERATOR)) {
      process.stdout.write(STATUS_REJECTED);
      exit(EXIT_CODE_REGISTRATION_REJECTED);
      return;
    }
    process.stdout.write(STATUS_REGISTERED);
  } catch {
    process.stdout.write(STATUS_REJECTED);
    exit(EXIT_CODE_REGISTRATION_REJECTED);
  }
}

const privateRoot = process.env[PRIVATE_ROOT_ENVIRONMENT_VARIABLE];
if (!privateRoot) {
  process.stdout.write(STATUS_CONFIGURATION_INVALID);
  app.exit(EXIT_CODE_CONFIGURATION_INVALID);
} else {
  app.setPath('userData', privateRoot);
  app.on('will-quit', dispose);
  process.once('SIGINT', () => exit(0));
  process.once('SIGTERM', () => exit(0));
  void app.whenReady().then(register, () => exit(EXIT_CODE_REGISTRATION_REJECTED));
}
