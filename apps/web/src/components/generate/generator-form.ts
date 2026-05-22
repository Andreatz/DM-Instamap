export function parseRequiredRooms(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((room) => room.trim())
        .filter(Boolean)
    )
  ];
}
