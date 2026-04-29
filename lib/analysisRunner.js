import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAnalysis } from './analysisService.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(currentDir, 'analysisService.py');

async function runRemoteAnalysis(payload) {
    const analysisUrl = process.env.ANALYSIS_API_URL;

    if (!analysisUrl) {
        throw new Error('ANALYSIS_API_URL is not configured.');
    }

    const controller = new AbortController();
    const timeoutMs = Number(process.env.ANALYSIS_API_TIMEOUT_MS || 20000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(analysisUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(process.env.ANALYSIS_API_KEY
                    ? { Authorization: `Bearer ${process.env.ANALYSIS_API_KEY}` }
                    : {}),
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
            cache: 'no-store',
        });

        if (!response.ok) {
            const responseText = await response.text();
            throw new Error(
                `Remote analysis service failed with ${response.status}: ${responseText || response.statusText}`
            );
        }

        return await response.json();
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new Error(`Remote analysis service timed out after ${timeoutMs}ms.`);
        }

        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

function runPythonProcess(payload) {
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

export async function runPythonAnalysis(payload) {
    if (process.env.ANALYSIS_API_URL) {
        return runRemoteAnalysis(payload);
    }

    if (process.env.CHATBOT_ANALYSIS_RUNTIME === 'python') {
        return runPythonProcess(payload);
    }

    return runAnalysis(payload);
}
