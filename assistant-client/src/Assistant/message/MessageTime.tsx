import React from "react";


export default function MessageTime({ timestamp }: { timestamp: number }) {
    const ts = new Date(timestamp*1000);
    const date = ts.toLocaleDateString();
    const time = ts.toLocaleTimeString();
    let timeinfo = `${time} ${date}`;
    if (date === new Date().toLocaleDateString()) {
        timeinfo = time;
    }
    return <span className="text-sm text-gray-500">{timeinfo}</span>

}