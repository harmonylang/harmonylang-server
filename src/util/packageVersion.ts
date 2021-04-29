
type UnparsedPackageVersion = {parsed: false};
type ParsedPackageVersion = {
    parsed: true;
    major: number;
    minor: number;
    patch: number;
};

type PackageVersionValue = UnparsedPackageVersion | ParsedPackageVersion;

export default class PackageVersion {
    public readonly version: PackageVersionValue;
    constructor(version: string) {
        const parsedVersion = version.split(".").map(v => Number.parseInt(v));
        if (parsedVersion.length !== 3 || parsedVersion.some(v => Number.isNaN(v))) {
            this.version = {parsed: false};
        } else {
            const [major, minor, patch] = parsedVersion;
            this.version = {
                parsed: true,
                major, minor, patch
            }
        }
    }

    isGreaterVersionThan(version: Partial<ParsedPackageVersion>, ifUnparsed: boolean = false): boolean {
        if (!this.version.parsed) {
            return ifUnparsed;
        }
        const lhs = this.version;
        const rhs: ParsedPackageVersion = {
            parsed: true,
            major: version.major || 0,
            minor: version.minor || 0,
            patch: version.patch || 0
        };
        return lhs.major > rhs.major
            || lhs.major >= rhs.major && lhs.minor > rhs.minor
            || lhs.major >= rhs.major && lhs.minor >= rhs.minor && lhs.patch > rhs.patch;
    }

    isLesserVersionThan(version: Partial<ParsedPackageVersion>, ifUnparsed: boolean = false): boolean {
        if (!this.version.parsed) {
            return ifUnparsed;
        }
        const lhs = this.version;
        const rhs: ParsedPackageVersion = {
            parsed: true,
            major: version.major || 0,
            minor: version.minor || 0,
            patch: version.patch || 0
        };
        return lhs.major < rhs.major
            || lhs.major <= rhs.major && lhs.minor < rhs.minor
            || lhs.major <= rhs.major && lhs.minor <= rhs.minor && lhs.patch < rhs.patch;
    }
}

