export class VerifiedReleaseLifecycle {
  #orchestrator;

  constructor({ orchestrator }) {
    this.#orchestrator = orchestrator;
  }

  async execute(options) {
    await this.#orchestrator.run(options);
    return await this.#orchestrator.verifyFinal();
  }
}
