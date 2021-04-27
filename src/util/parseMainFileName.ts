import path from "path";

export function parseMainFileName(args: {
    source?: any;
    version?: any;
    main?: any;
}): {
    source: string;
    version: string;
    main: string;
} {
    const {main, version, source} = args;
    if (main == null || typeof main !== 'string') {
        throw new Error("Request does not declare a main file")
    }
    if (source == null || typeof source !== 'string') {
        console.log("Source in the request not declared", "Assuming the main file is a literal string");
        return {
            main: main,
            source: "",
            version: typeof version === 'string' ? version : "",
        }
    }
    if (source === 'web-ide') {
        return {
            main: JSON.parse(main).join(path.sep),
            source, version: typeof version === 'string' ? version : ""
        };
    } else if (source === 'vscode') {
        if (version == null || typeof version !== 'string') {
            throw new Error(`Request from vscode does not defined a version`);
        }
        const parsedVersion = version.split(".").map(v => Number.parseInt(v));
        if (parsedVersion.length !== 3 || parsedVersion.some(v => Number.isNaN(v))) {
            throw new Error(`The version in the request is invalid: ${version}`);
        }
        const [major, minor, patch] = parsedVersion;
        if (major >= 0 && minor >= 2 && patch >= 6) {
            return {
                main: JSON.parse(main).join(path.sep),
                version,
                source,
            };
        }
        return {
            main,
            version,
            source,
        };
    } else {
        throw new Error(`Request contains an unknown source: ${source}`);
    }
}
