/**
 * Serializes mutations of the one persistent background browser context.
 *
 * A failed operation must not prevent the next lifecycle request from running.
 */
export class BackgroundBrowserOperationQueue {
  private tail: Promise<void> = Promise.resolve();

  run<Result>(operation: () => Result | Promise<Result>): Promise<Result> {
    const result = this.tail.then(operation);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
