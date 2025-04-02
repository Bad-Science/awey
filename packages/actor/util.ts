export class IdentitySet<T> {
  private map = new Map<any, T>();
  private idKey: keyof T;

  constructor(idKey: keyof T) {
    this.idKey = idKey;
  }

  add(value: T): this {
    this.map.set(value[this.idKey], value);
    return this;
  }

  has(value: T): boolean {
    return this.map.has(value[this.idKey]);
  }

  hasKey(key: any): boolean {
    return this.map.has(key);
  }

  delete(value: T): boolean {
    return this.map.delete(value[this.idKey]);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }

  *[Symbol.iterator](): Iterator<T> {
    yield* this.map.values();
  }
}