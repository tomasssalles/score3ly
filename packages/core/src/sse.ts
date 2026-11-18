// Reads a response of server-sent events as it arrives (a provider's streamed answer in the Worker, the Worker's in
// the browser), and hands each event's data (a "data:" line's text, trimmed) to `onData` as soon as its line is
// complete; other lines (comments, empty lines) are skipped. Throws what reading or `onData` throws (an abort, a
// broken connection), for the caller to translate.
export async function readSse(response: Response, onData: (data: string) => void): Promise<void> {
  if (!response.body) return;
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let rest = "";
  const lines = (text: string) => {
    for (const line of text.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data !== "") onData(data);
    }
  };
  let finished = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      rest += value;
      const end = rest.lastIndexOf("\n");
      if (end < 0) continue;
      lines(rest.slice(0, end));
      rest = rest.slice(end + 1);
    }
    finished = true;
    lines(rest);
  } finally {
    // Stopped early (`onData` threw, or reading failed): the body is cancelled, so its connection is let go.
    if (!finished) await reader.cancel().catch(() => {});
  }
}

// One event as a stream of server-sent events carries it, the way `readSse` reads it back: a string as it is (one line,
// e.g. OpenRouter's "[DONE]"), anything else as its JSON.
export function sseData(data: unknown): string {
  return `data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`;
}
