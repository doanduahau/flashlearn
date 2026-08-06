export function streakLabel(streak: number, completedToday: boolean): string {
  const status = completedToday ? "hôm nay đã hoàn thành" : "hôm nay chưa hoàn thành";
  return `Chuỗi ${streak} ngày, ${status}`;
}
