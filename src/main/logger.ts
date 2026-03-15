import log from 'electron-log/main';

log.transports.file.level = 'info';
log.transports.console.level = 'debug';

export function createLogger(scope: string) {
  return log.scope(scope);
}

export default log;
