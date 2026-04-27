
export class RangesList<T> {
  // TODO write an efficient implementation
  private items: Array<[number, number, T]> = [];

  insert(start: number, end: number, value: T) {
    const index = this.findIndex((start + end) / 2);
    this.items.splice(index, 0, [start, end, value]);
  }

  find(position: number): T | null {
    const index = this.findIndex(position);
    const item = this.items[index];
    if (!item || item[0] > position || item[1] < position) {
      return null;
    }
    return item[2];
  }

  private findIndex(position: number): number {
    let low = 0;
    let high = this.items.length;
    let index = 0;
    while (low < high) {
      index = low + Math.floor((high - low) / 2);
      const item = this.items[index];
      if (item[0] > position) {
        if (index === low) {
          return index
        }
        high = index;
        continue;
      }
      if (item[1] <= position) {
        if (index === high - 1) {
          return index + 1
        }
        low = index + 1;
        continue;
      }
      break;
    }
    return index;
  }
}
