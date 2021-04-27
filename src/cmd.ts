import child_process from "child_process";

type ExecResult = {
    error: child_process.ExecException | null;
    stdout: string;
    stderr: string;
}

export async function executeCommand(cmd: string, options?: child_process.ExecOptions): Promise<ExecResult> {
    return new Promise<ExecResult>(resolve => {
        child_process.exec(cmd, options || {}, (error, stdout, stderr) => {
            resolve({
                error: error,
                stdout: stdout,
                stderr: stderr,
            });
        });
    });
}
