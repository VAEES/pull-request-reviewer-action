import * as core from '@actions/core';
import * as github from '@actions/github';

import GptAssistant from './gpt-assistant';

async function run() {
    try {
        const token = core.getInput('GITHUB_TOKEN');
        const apiKey = core.getInput('OPENAI_API_KEY');
        if (!token || !apiKey) {
            throw new Error('GITHUB_TOKEN or OPENAI_API_KEY is not set');
        }

        const octokit = github.getOctokit(token);
        const { context } = github;
        const { pull_request } = context.payload;

        if (!pull_request) {
            throw new Error('No pull request found in context payload');
        }

        const prNumber = pull_request.number;
        const prTitle = pull_request.title;
        const prBody = pull_request.body;
        const owner = context.repo.owner;
        const repo = context.repo.repo;

        const prFiles = await octokit.rest.pulls.listFiles({
            owner,
            repo,
            pull_number: prNumber
        });

        const filesChanged = prFiles.data.map(file => ({
            filename: file.filename,
            additions: file.additions,
            deletions: file.deletions,
            changes: file.changes,
            status: file.status,
            patch: file.patch
        }));

        const gptAssistant = new GptAssistant(apiKey);
        const message = `Review the following pull request:\n\nTitle: ${prTitle}\n\nDescription: ${prBody}\n\nFiles Changed: ${JSON.stringify(filesChanged, null, 2)}`;
        console.log(message);
        
        const reviewResult = await gptAssistant.sendMessage(message);

        await octokit.rest.issues.createComment({
            owner,
            repo,
            body: reviewResult,
            issue_number: prNumber,
        });
    } catch (error) {
        console.log(error);
        core.setFailed((error as Error).message);
    }
}

run();
