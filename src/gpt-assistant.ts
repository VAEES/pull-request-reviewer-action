import * as core from '@actions/core';
import OpenAI from 'openai';

export default class GptAssistant {
    private chatGpt: OpenAI;
    private readonly assistantId = core.getInput('ASSISTANT_ID');

    constructor(apiKey: string) {
        this.chatGpt = new OpenAI({ apiKey });
    }

    public async sendMessage(message: string): Promise<string> {
        const assistant = await this.loadAssistant();
        const thread = await this.createThread();
        await this.createMessage(thread.id, message, 'user');
        const run = await this.runAssistant(thread.id, assistant.id);
        
        // Poll the run status until it's completed
        let status = 'incomplete';
        while (status !== 'completed') {
            status = await this.getRunStatus(thread.id, run.id);
        }

        return this.getGptResponse(thread.id);
    }

    private async loadAssistant(): Promise<OpenAI.Beta.Assistants.Assistant> {
        return this.chatGpt.beta.assistants.retrieve(this.assistantId);
    }

    private async createThread(): Promise<OpenAI.Beta.Threads.Thread> {
        return this.chatGpt.beta.threads.create();
    }

    private async createMessage(threadId: string, message: string, role: 'user'): Promise<OpenAI.Beta.Threads.Messages.Message> {
        return this.chatGpt.beta.threads.messages.create(threadId, {
            content: message,
            role,
        });
    }

    private async runAssistant(threadId: string, assistantId: string): Promise<OpenAI.Beta.Threads.Runs.Run> {
        return this.chatGpt.beta.threads.runs.create(threadId, {
            assistant_id: assistantId,
        });
    }

    private async getRunStatus(threadId: string, runId: string): Promise<string> {
        const runningState = await this.chatGpt.beta.threads.runs.retrieve(threadId, runId);
        return runningState.status;
    }

    private async getGptResponse(threadId: string): Promise<string> {
        const { data } = await this.chatGpt.beta.threads.messages.list(threadId);
        const firstMessage = data.find((message: any) => message.role === 'assistant');
        if (firstMessage && firstMessage.content) {
            return (firstMessage.content as any)[0].text.value;
        }
        throw new Error('No response from assistant');
    }
}
