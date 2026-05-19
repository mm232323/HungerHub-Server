export function serializeDates<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString() as unknown as T;
  if (Array.isArray(obj)) return obj.map(serializeDates) as unknown as T;
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = serializeDates(value);
    }
    return result as T;
  }
  return obj;
}

function toCamelCase(str: string): string {
  return str.replace(/([-_][a-z])/gi, (match) => {
    return match.toUpperCase().replace("-", "").replace("_", "");
  });
}

export function camelCaseKeys<T>(obj: T): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(camelCaseKeys);
  if (typeof obj === "object" && !(obj instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const camelKey = toCamelCase(key);
      result[camelKey] = camelCaseKeys(value);
    }
    return result;
  }
  return obj;
}

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function snakeCaseKeys<T>(obj: T): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(snakeCaseKeys);
  if (typeof obj === "object" && !(obj instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const snakeKey = toSnakeCase(key);
      result[snakeKey] = snakeCaseKeys(value);
    }
    return result;
  }
  return obj;
}


