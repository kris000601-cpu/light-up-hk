/** 「11.19」這種月·日寫法（香港時間） */
export function monthDay(ms: number): string {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Hong_Kong', month: 'numeric', day: 'numeric' }).formatToParts(ms)
  const get = (t: string) => p.find((x) => x.type === t)?.value
  return `${get('month')}.${get('day')}`
}
