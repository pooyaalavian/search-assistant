import React from "react";
import { Message } from "../types";
import UserMessage from "./UserMessage";
import AssistantMessage from "./AssistantMessage";
import { SearchResultMessage } from "./SearchResultMessage";
import { InactiveSearchRequestMessagePanel } from "./SearchRequestMessage";



export default function MessagePanel({ message, onSendFeedback,  }: { message: Message; onSendFeedback: CallableFunction; }) {
    if (message.sender === 'user') {
        return <UserMessage message={message} />;
    }
    if (message.sender === 'assistant') {
        return <AssistantMessage message={message} onSendFeedback={onSendFeedback}/>;
    }
    if (message.sender === 'search_results') {
        return <SearchResultMessage message={message}/>;
    }
    if (message.sender === 'search_request') {
        return <InactiveSearchRequestMessagePanel message={message}/>;
    }    
    return <div>
        Unknown message type
        <pre>{JSON.stringify(message,null,2)}</pre>
    </div>;
};