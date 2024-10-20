import React from "react";
import { AssistantMessage } from "../types";
import MessageTime from "./MessageTime";
import copilot from '../assets/copilot.svg';
import {
    ThumbLike20Filled, ThumbLike20Regular,
    ThumbDislike20Filled, ThumbDislike20Regular,
} from '@fluentui/react-icons';
import { useState } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function LikeDislike({ message, onSendFeedback }: { message: AssistantMessage, onSendFeedback: CallableFunction }) {
    const [isLoading, setIsLoading] = useState(false);

    const sendLike = async (state: 1 | 0 | -1) => {
        const oldState = message.liked;
        if (state === message.liked) state = 0;
        setIsLoading(true);
        const success = await onSendFeedback(message, state);
        if (success) {
            message.liked = state;
        } else {
            message.liked = oldState;
        }
        setIsLoading(false);
    };
    return (
        <div className="flex flex-row text-violet-700">
            <div className={isLoading ? 'not-allowed' : "cursor-pointer"} onClick={() => sendLike(1)}>
                {message.liked === 1 ? <ThumbLike20Filled /> : <ThumbLike20Regular />}
            </div>
            <div className="cursor-pointer drop-shadow-lg" onClick={() => sendLike(-1)}>
                {message.liked === -1 ? <ThumbDislike20Filled /> : <ThumbDislike20Regular className="drop-shadow-lg" />}
            </div>
        </div>
    );
}

export default function AssistantMessagePanel({ message, onSendFeedback }: { message: AssistantMessage, onSendFeedback: CallableFunction }) {
    const completed = message.state === 'completed';

    return (
        <div className="pt-4 flex-col">
            <div className="flex-0"><MessageTime timestamp={message.timestamp} /></div>
            <div className="bg-white w-full border border-gray-200 rounded-md shadow-md">
                <div className="flex-col">
                    <div className="header p-2 border-b border-gray-200">
                        <div className="flex items-center align-center">
                            <div className="flex-0">
                                <img className="h-6 object-contain" src={copilot} alt="" />
                            </div>
                            <div className="font-bold pr-2">AI Assistant</div>
                            <div className="bubble">
                                {completed &&
                                    <span className="text-xs italic p-0.5 rounded bg-gray-100">
                                        AI-generated content may be incorrect
                                    </span>
                                }
                            </div>
                        </div>
                    </div>
                     {!completed && <div className="body p-2">...</div>}
                    {completed && <>
                        <div className="body p-2 overflow-x-auto">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {message.content}
                            </ReactMarkdown>
                            </div>
                        <div className="footer p-2 border-t border-gray-200">
                            <LikeDislike message={message} onSendFeedback={onSendFeedback} />
                        </div>
                    </>}
                </div>
            </div>
            {/* <div className="followup flex flex-row">
                <div className="m-1">
                    <div className="px-1 border border-violet-400 rounded-lg text-xs bg-white"> Hi</div>
                </div>
            </div> */}
        </div>
    )
}