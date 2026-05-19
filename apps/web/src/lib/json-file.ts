export function parseJsonFileContent(content: string): unknown {
  return JSON.parse(stripByteOrderMark(content));
}

export function stripByteOrderMark(content: string): string {
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
}
