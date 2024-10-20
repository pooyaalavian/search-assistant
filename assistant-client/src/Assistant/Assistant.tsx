import React, { useEffect, useRef, useState } from "react";
import { AssistantState, Message, SearchKey } from "./types";
import chatBubbleActive from './assets/chat-bubbles.svg';
import chatBubbleInactive from './assets/chat-bubbles-gray.svg';
import MessagePanel from "./message/Message";
import { AssistantApi } from "./api";
import { Dismiss20Filled } from '@fluentui/react-icons';
import ComposeMessage from "./message/ComposeMessage";
import { useLocation } from "react-router-dom";
import './styles.css';
import { LoadingCard } from "./components/LoadingCard";
import { ActiveSearchRequestMessagePanel } from "./message/SearchRequestMessage";
import { ErrorCard } from "./components/ErrorCard";

declare global {
    interface Window {
        assistant_state: AssistantInputs;
    }
}

export interface AssistantInputs {
    apiServer: string;
    chassisElementId: string;
    userNameElementId: string;
}

const RETRY_TIMER = [500, 1000, 1000, 2000, 2000, 2000, 2000];

export default function Assistant(props: AssistantInputs) {
    const [myState, setMyState] = useState<AssistantState>({
        inContextChassisId: null,
        inContextUserName: null,
        shown: false,
        active: false,
        conversation: null,
        status: 'ready',
    });
    const [showNewSearch, setShowNewSearch] = useState(false);
    const [searchKeys, setSearchKeys] = useState<SearchKey[]>([]);
    window.assistant_state = props;
    const api = new AssistantApi(props.apiServer, props.chassisElementId);
    const [retries, setRetries] = useState(0);
    const location = useLocation();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        setRetries(0);
        console.log('reset retries to 0');
    }, [location]);
    useEffect(() => {
        console.log(`fetch context at ${location.pathname} at ${Date.now()}`);
        const inContextChassisId = api.getInContextChassisId();
        const inContextUserName = api.getInContextUserName();
        setMyState({
            ...myState,
            inContextChassisId,
            inContextUserName,
        });
        console.log('context: ', inContextChassisId, inContextUserName);

        if (!inContextChassisId && retries < 5) {
            console.log('retrying in x second');
            setTimeout(() => {
                setRetries(retries + 1);
            }, RETRY_TIMER[retries]);
        }

    }, [location, retries]);

    const initOrLoadConversation = async (inContextChassisId: string, inContextUserName: string) => {
        try {
            const conversation = await api.initOrLoadConversation(inContextChassisId, inContextUserName);
            setMyState(s => ({
                ...s,
                conversation,
                error: undefined,
            }));
            setShowNewSearch(false);

        }
        catch (e) {
            const err: Error = e as any;
            console.error('Error getting conversation:', e);
            setMyState(s => ({
                ...s,
                error: err.message,
            }));
        }
    };

    useEffect(() => {
        if (!myState.inContextChassisId) {
            return setMyState(s => ({
                ...s,
                conversation: null,
            }));
        }
        if (myState.inContextChassisId && myState.inContextUserName && !myState.conversation) {
            initOrLoadConversation(myState.inContextChassisId, myState.inContextUserName);
        }
    }, [myState.inContextChassisId, myState.inContextUserName]);

    const pollMessage = async () => {
        if (!myState.conversation || !myState.inContextUserName) return;
        const pendingMsg = myState.conversation.messages.find((m) => m.sender === 'assistant' && m.state === 'pending');
        if (!pendingMsg) return;
        const msgId = pendingMsg.messageId;
        try {
            const res = await api.pollMessage(myState.conversation.conversationId, msgId, myState.inContextUserName);
            if (res && res.state === 'pending') {
                return setTimeout(pollMessage, 1000);
            }
            setMyState(s => ({
                ...s, conversation: {
                    ...s.conversation!,
                    messages: s.conversation!.messages.map((m) => m.messageId === msgId ? res : m)
                }
            }));
        }
        catch (e) {
            console.error('Error polling message:', e);
            setTimeout(() => {
                pollMessage();
            }, 2000);
        }
    }

    const toggleShow = (shown: boolean) => () => {
        setMyState({
            ...myState,
            shown,
        });
    };
    const onSendMessage = async (content: string): Promise<void> => {
        if (!myState.conversation || !myState.inContextUserName) return;
        const old_messages = [...myState.conversation.messages];
        const newTempMessage: Message = {
            conversationId: myState.conversation.conversationId,
            messageId: '',
            sender: 'user',
            content,
            timestamp: Date.now(),
        };
        setMyState({
            ...myState,
            conversation: {
                ...myState.conversation,
                messages: [...old_messages, newTempMessage],
            }
        });
        try {
            const { userMessage, assistantMessage } = await api.sendMessage(myState.conversation.conversationId, content, myState.inContextUserName);
            const newMessages = [...old_messages, userMessage, assistantMessage];
            const newState = { ...myState };
            if (newState.conversation) {
                newState.conversation.messages = newMessages;
            }
            setMyState(newState);
            setTimeout(pollMessage, 1000);
        }
        catch (e) {
            console.error('Error sending message:', e);
            setMyState({
                ...myState,
                conversation: {
                    ...myState.conversation,
                    messages: old_messages,
                }
            });
        }

    };
    const onSendFeedback = async (msg: Message, liked: 1 | 0 | -1): Promise<boolean> => {
        if (!myState.conversation || !myState.inContextUserName) return false;
        try {
            const updatedMessage = await api.sendFeedback(myState.conversation.conversationId, msg.messageId, liked, myState.inContextUserName);

            const msgIndex = myState.conversation.messages.findIndex((m) => m.messageId === msg.messageId);
            const newMessages = [...myState.conversation.messages];
            newMessages[msgIndex] = updatedMessage;

            const newState = { ...myState };
            if (newState.conversation) {
                newState.conversation.messages = newMessages;
            }

            setMyState(newState);
            return true;
        }
        catch (e) {
            console.error('Error sending feedback:', e);
            return false;
        }
    };

    const handleDeleteChat = async () => {
        if (!myState.conversation || !myState.inContextUserName) return;
        const counts = await api.deleteConversation(myState.conversation.conversationId, myState.inContextUserName!);

        if (counts.conversation > 0) {
            setMyState(s => ({
                ...s,
                conversation: null,
            }));
            await initOrLoadConversation(myState.inContextChassisId!, myState.inContextUserName!);
        }
    };

    const initiateNewSearch = async () => {
        const searchKeys = await api.getSearchKeys();
        setSearchKeys(searchKeys);
        setShowNewSearch(true);
    };
    const discardNewSearch = () => {
        setShowNewSearch(false);
        setSearchKeys([]);
    };

    const submitNewSearch = async (searchKeys: SearchKey[], countNeeded?: number) => {
        console.log('submitting search keys:', searchKeys);
        setShowNewSearch(false);
        try {
            const conversation = await api.performCustomSearch(myState.conversation!.conversationId, searchKeys, myState.inContextUserName!, countNeeded);
            setMyState(s => ({
                ...s,
                conversation,
                error: undefined,
            }));
        }
        catch (e) {
            const err: Error = e as any;
            console.error('Error performing search:', e);
            setMyState(s => ({
                ...s,
                error: err.message,
            }));
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };
    useEffect(scrollToBottom, [myState.conversation, showNewSearch]);

    if (!myState.inContextChassisId) {
        return (
            <div className="fixed bottom-4 right-4 w-16 h-16 rounded-full shadow-xl shadow-gray-400/50 overflow-hidden cursor-pointer border-gray-500 border bg-white"
                onClick={toggleShow(true)}
                title="PACCAR Copilot is not available on this page. Navigate to a chassis page.">
                <img className="w-10 h-10 m-3 object-contain" src={chatBubbleInactive} />
            </div>
        )
    }

    if (!myState.shown) {
        return (
            <div className="fixed bottom-4 right-4 w-16 h-16 rounded-full shadow-xl shadow-gray-400/50 overflow-hidden cursor-pointer border-cyan-500 border bg-white"
                onClick={toggleShow(true)}
                title="PACCAR Copilot">
                <img className="w-10 h-10 m-3 object-contain" src={chatBubbleActive} />
            </div>
        )
    }

    return (
        <div className="fixed bottom-0 right-0 w-[700px] h-[720px] max-h-screen pb-4 pr-4">
            <div className="relative w-full h-full overflow-hidden border-gray-300 border shadow-md shadow-gray-800/50 flex flex-col rounded-sm">
                <div id="header" className="flex-0 h-12 bg-gray-100 p-4 flex items-center border-b border-gray-300">
                    <img src="" alt="" className="icon" />
                    <h1 className="flex-1 font-bold">PACCAR AI Assistant</h1>
                    <button onClick={toggleShow(false)}>
                        <Dismiss20Filled className="text-violet-900" />
                    </button>
                </div>
                <div id="messages" className="flex-1 bg-gray-100 p-4 overflow-y-auto">
                    {!myState.conversation && !myState.error && <LoadingCard />}
                    {myState.error && <ErrorCard error={myState.error} />}
                    {myState.conversation && myState.conversation.messages && myState.conversation.messages.map((message, index) => <MessagePanel message={message} key={index} onSendFeedback={onSendFeedback} />)}

                    {myState.conversation?.messages.length && <div className="" ref={messagesEndRef}>
                        {showNewSearch &&
                            <ActiveSearchRequestMessagePanel searchKeys={searchKeys} onDiscard={discardNewSearch} onSubmit={submitNewSearch} />
                        }
                        {!showNewSearch &&
                            <div className="flex pt-2 justify-center">
                                <div className="m-1">
                                    <button onClick={handleDeleteChat} className="border border-red-700 text-red-700 p-1 rounded-md hover:bg-red-700 hover:text-white text-sm">Delete chat </button>
                                </div>
                                <div className="m-1">
                                    <button onClick={initiateNewSearch} className="border border-purple-700 text-purple-700 p-1 rounded-md hover:bg-purple-700 hover:text-white text-sm">Search again</button>
                                </div>
                            </div>
                        }
                    </div>}
                </div>
                <div id="input" className="flex-0 h-28 bg-gray-100 flex items-center border-t border-gray-300">
                    <ComposeMessage disabled={!myState.conversation} sendMessage={onSendMessage} />
                </div>
                <div id="paccar-assistant-portal"></div>
            </div>
            <div id="unused-classes" className="bg-purple-800 w-[1px] h-[1px] overflow-hidden peer-checked:bg-purple-600">a</div>
        </div>
    )
}