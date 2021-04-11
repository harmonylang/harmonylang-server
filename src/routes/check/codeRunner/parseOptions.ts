import {ArgumentParser} from 'argparse';
import stringArgv from 'string-argv';

const parser = new ArgumentParser();
parser.add_argument('--const','-c', {nargs: 1})
parser.add_argument('--module', '-m', {nargs: 1})


/**
 * Parses a string which declares options to passed into the Harmony compiler.
 * Returns a cleaned string that can be passed for Harmony.
 * Some options are not supported.
 * Only the following are supported: [-C name=value, -m module=version]
 * @param options
 * @throws Error if an error occurs when parsing the options string.
 */
export default function parseOptions(options?: string): string {
    if (options == null) return ""
    const optionsArg = stringArgv(options);
    const [ns, oddities] = parser.parse_known_args(optionsArg);
    if (oddities.length > 0) {
        const key = oddities[0]
        console.log(ns, oddities)
        throw new Error("Invalid option used: " + key);
    }
    return Object.entries(ns).filter(([_, v]) => v != null).map(([k, v]) => {
        return `--${k} ${JSON.stringify((v as string[])[0])}`;
    }).join(" ");
}
