import * as uuid from 'uuid';

export default function generateNamespace(isUnique: (name: string) => boolean): string | undefined {
    for (let i = 0; i < 5; i++) {
        let id = uuid.v4()
        if (isUnique(id)) {
            return id;
        }
    }
    return undefined;
}
