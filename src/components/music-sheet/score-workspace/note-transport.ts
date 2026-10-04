/** Pitch spelling and chord labels may change while the score's rhythmic anchor stays valid. */
export function noteEditKeepsRhythm(previous: string, next: string): boolean {
  const signature = (abc: string) => abc.split('\n').map(line => {
    if (/^\s*(?:[A-Za-z]:|%)/.test(line)) return line;
    return line.replace(/"[^"]*"|![^!]*!/g, '').replace(/[_^=]{0,2}[A-Ga-g][,']*/g, 'n');
  }).join('\n');
  return signature(previous) === signature(next);
}
export function retainedScorePosition(seconds: number, previousMeasureSeconds: number, nextMeasureSeconds: number, duration: number): number {
  return Math.max(0, Math.min(duration, previousMeasureSeconds > 0 ? seconds / previousMeasureSeconds * nextMeasureSeconds : 0));
}
