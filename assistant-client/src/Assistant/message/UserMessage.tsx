import React from "react";
import { SyncIcon } from "../components/SyncIcon";
import { UserMessage } from "../types";
import MessageTime from "./MessageTime";
import {CheckmarkCircle16Regular} from '@fluentui/react-icons';



export default function UserMessagePanel({ message }: { message: UserMessage }) {
    return (
        <div className="flex flex-row-reverse items-end pt-4 relative">
            <div className="flex-0 h-full"></div>
            <div className="flex-col" style={{flex:"1 1 70%"}}>
                <div className="timeinfo flex-0 text-right"><MessageTime timestamp={message.timestamp}/></div>
                <div className="p-2 rounded-md bg-violet-200 shadow-md">{message.content}</div>
            </div>
            <div className="min-w-16" style={{flex:"1 1 0%"}}></div>
            {!message.messageId &&<div className="absolute b-0 r-0 animate-spin">
                <SyncIcon/>
            </div>}
            {message.messageId && <div className="absolute b-0 r-0 w-4 h-4 ">
                <CheckmarkCircle16Regular className="text-green-500 bg-white rounded-full"/>
                </div>}
        </div>
    )
}