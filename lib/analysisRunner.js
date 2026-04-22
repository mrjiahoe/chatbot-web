import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(currentDir, 'analysisService.py');

export async function runPythonAnalysis(payload) {
    return new Promise((resolve, reject) => {
        const pythonBinary = process.env.CHATBOT_PYTHON_BIN || 'python3';
        const child = spawn(pythonBinary, [scriptPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
        });

        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });

        child.on('error', (error) => {
            reject(new Error(`Failed to start Python analysis service: ${error.message}`));
        });

        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(stderr.trim() || `Python analysis exited with code ${code}.`));
                return;
            }

            try {
                resolve(JSON.parse(stdout));
            } catch (error) {
                reject(new Error(`Invalid JSON returned from Python analysis: ${error.message}`));
            }
        });

        child.stdin.write(JSON.stringify(payload));
        child.stdin.end();
    });
}
