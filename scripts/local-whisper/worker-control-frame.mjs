const CONTROL_FRAME_HEADER_BYTES = 5;
const CONTROL_FRAME_KIND = 1;

/** Encodes one JSON worker-control fixture with the production framing layout. */
export function encodeWorkerControlFrame(message) {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  const frame = Buffer.alloc(CONTROL_FRAME_HEADER_BYTES + body.byteLength);
  frame.writeUInt32BE(body.byteLength, 0);
  frame[4] = CONTROL_FRAME_KIND;
  body.copy(frame, CONTROL_FRAME_HEADER_BYTES);
  return frame;
}
