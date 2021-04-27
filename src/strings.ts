
type PossibleString = string | undefined | null;

const truthyStrings = new Set<string>(["true", "yes", "ok"]);
const falsyStrings = new Set<string>(["false", "no", "bad"]);

export function parseBool(value: PossibleString, alt?: boolean): boolean {
    if (value != null) {
        const valueToCompare = value.toLowerCase();
        if (truthyStrings.has(valueToCompare)) {
            return true;
        } else if (falsyStrings.has(valueToCompare)) {
            return false;
        }
    }
    if (alt != null) return alt;
    throw new Error("Cannot parse value into a boolean");
}

export function parseInteger(value: PossibleString, alt?: number): number {
    if (value != null) {
        const possibleNumber = Number.parseInt(value);
        if (!isNaN(possibleNumber)) return possibleNumber;
    }
    if (alt != null) return alt;
    throw new Error("Cannot parse value into an integer");
}

export function parseFloat(value: PossibleString, alt?: number): number {
    if (value != null) {
        const possibleNumber = Number.parseFloat(value);
        if (!isNaN(possibleNumber)) return possibleNumber;
    }
    if (alt != null) return alt;
    throw new Error("Cannot parse value into an integer");
}

export function parseObject(value: PossibleString, alt?: Record<string, unknown>): Record<string, unknown> {
    try {
        if (value != null) {
            const possibleObject = JSON.parse(value);
            if (typeof possibleObject === 'object') {
                return possibleObject;
            }
        }
    } catch (e) {
        if (alt != null) {
            return alt;
        }
    }
    throw new Error("Cannot parse value into object");
}

export function parseArray(value: PossibleString, alt?: unknown[]): unknown[] {
    try {
        if (value != null) {
            const possibleObject = JSON.parse(value);
            if (Array.isArray(possibleObject)) {
                return possibleObject;
            }
        }
    } catch (e) {
        if (alt != null) {
            return alt;
        }
    }
    throw new Error("Cannot parse value into array");
}
