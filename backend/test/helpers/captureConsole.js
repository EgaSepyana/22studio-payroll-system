// Runs fn() while collecting console.warn lines instead of printing them.
export async function captureWarnings(fn) {
  const lines = [];
  const original = console.warn;
  console.warn = (...args) => lines.push(args.join(' '));
  try {
    await fn();
  } finally {
    console.warn = original;
  }
  return lines;
}
