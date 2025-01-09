type Id<T> = T extends string ? (a: T) => string : never;

type Serializer<T> = (v: T) => string;
type Deserializer<T> = (v: string) => T;

const id = (a: string) => a

const usePersistence = <T>(key: string, s: Serializer<T>, d: Deserializer<T>) => ({
  set(value: T) {
    localStorage.setItem(key, s(value));
  },
  get(defaultValue?: T): T | undefined {
    const value = localStorage.getItem(key);
    if (value === null) {
      return defaultValue;
    }
    return d(value);
    // return unserialized === undefined ? defaultValue : unserialized;
  }
});

export default usePersistence;