import { parseAlphaSmokeCommand, type AlphaSmokeCommand } from './AlphaSmokeProtocol';

/** Keeps executable argument parsing separate from the network and physical adapters. */
export class AlphaSmokeCommandParser {
  public parse(arguments_: readonly string[]): AlphaSmokeCommand {
    return parseAlphaSmokeCommand(arguments_);
  }
}
