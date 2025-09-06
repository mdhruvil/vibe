export function stripIndents(value: string) {
  return (
    value
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .trimStart()
      // biome-ignore lint/performance/useTopLevelRegex: <idc>
      .replace(/[\r\n]$/, "")
  );
}
