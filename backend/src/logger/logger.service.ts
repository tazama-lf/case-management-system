export class LoggerService {
  log(message: string) {
    console.log(message);
  }
  error(message: string, error?: any) {
    console.error(message, error);
  }
  warn(message: string) {
    console.warn(message);
  }
  debug(message: string) {
    console.debug(message);
  }
  verbose(message: string) {
    console.info(message);
  }
}
