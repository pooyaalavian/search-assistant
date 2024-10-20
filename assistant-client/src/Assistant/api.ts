import { AssistantMessage, Conversation, IdString, Message, MessagePair, SearchKey, UserMessage } from "./types";

const K_SELECTORS = [
    ["-kwr"],
    ["webapp-test", "/REI/"],
];

const P_SELECTORS = [
    ["pbdenton"],
    ["webapp-test.", "/PB_REI/"],
];

const SessionIdKey = 'ms-ai-assistant-session-id';
export class AssistantApi {
    apiServer: string;
    chassisElementId: string;

    constructor(apiServer: string, chassisElementId: string) {
        this.apiServer = apiServer + '/api';
        this.chassisElementId = chassisElementId;
    }

    async initOrLoadConversation(chassisId: string, userId: string): Promise<Conversation> {
        const qp = new URLSearchParams({ chassisId, userId }).toString();
        const response = await fetch(`${this.apiServer}/conversation?${qp}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        const data: Conversation = await response.json();
        return data;
    };

    async sendMessage(conversationId: string, message: string, userId: string): Promise<MessagePair> {
        const qp = new URLSearchParams({ userId }).toString();
        const response = await fetch(`${this.apiServer}/conversation/${conversationId}/message?${qp}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify({ content: message }),
        });
        const data: MessagePair = await response.json();
        return data;
    }

    async pollMessage(conversationId: string, msgId: string, userId: string): Promise<AssistantMessage> {
        const qp = new URLSearchParams({ userId }).toString();
        const response = await fetch(`${this.apiServer}/conversation/${conversationId}/message/${msgId}?${qp}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', },
        });
        const data: AssistantMessage = await response.json();
        return data;
    }

    async sendFeedback(conversationId: string, msgId: string, liked: 1 | 0 | -1, userId: string): Promise<AssistantMessage> {
        const qp = new URLSearchParams({ userId }).toString();
        const response = await fetch(`${this.apiServer}/conversation/${conversationId}/message/${msgId}/feedback?${qp}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify({ liked }),
        });
        const data: AssistantMessage = await response.json();
        return data
    }

    async getSearchKeys(): Promise<SearchKey[]> {
        const response = await fetch(`${this.apiServer}/search/keys`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', },
        });
        const data: SearchKey[] = await response.json();
        data.forEach((sk,idx) => sk.id = `${idx}`);
        return data;
    }

    async performCustomSearch(conversationId: string, searchKeys: SearchKey[], userId: string, countNeeded?: number): Promise<Conversation> {
        const qp = new URLSearchParams({ userId }).toString();
        const response = await fetch(`${this.apiServer}/conversation/${conversationId}/search?${qp}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify({ searchKeys, countNeeded }),
        });
        const data: Conversation = await response.json();
        return data;
    }

    async deleteConversation(conversationId: string, userId: string) {
        const qp = new URLSearchParams({ userId }).toString();
        const response = await fetch(`${this.apiServer}/conversation/${conversationId}?${qp}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', },
        });
        const data: { status: 'ok'; conversation: number; message: number } = await response.json();
        return data;
    }

    getInContextChassisId(): IdString | null {
        const element = document.getElementById(this.chassisElementId);
        if (!element) return null;
        const { chassisNo, orderYear, reiUrl } = element.dataset;
        if (!chassisNo || !orderYear || !reiUrl) return null;
        let div = 'X';
        K_SELECTORS.forEach(selectorSet => {
            if (selectorSet.every(selector => reiUrl.includes(selector))) div = 'K';
        });
        P_SELECTORS.forEach(selectorSet => {
            if (selectorSet.every(selector => reiUrl.includes(selector))) div = 'P';
        });
        return `C${chassisNo}_${div}20${orderYear}`;
    }

    getInContextUserName(): string | null {
        const element = document.querySelector('li.user > a > span');
        if (!element || !element.textContent) return null;
        const text = element.textContent;
        const name = text?.replace('Hello, ', '').trim();
        return name;
    }
}


export async function getActiveSessionId(): Promise<string | undefined> {
    const sessionId = localStorage.getItem(SessionIdKey);
    if (sessionId) {
        return sessionId;
    }
    return undefined;
}

export async function setActiveSessionId(sessionId: string): Promise<void> {
    localStorage.setItem(SessionIdKey, sessionId);
}

export async function clearActiveSessionId(): Promise<void> {
    localStorage.removeItem(SessionIdKey);
}



