import React from "react";



export function SvgImg({ content }: { content: string, alt: string }) {
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(content)}`
        .replace(/'/g, '%27')
        .replace(/"/g, '%22');
    return <img src={dataUrl} />;
}