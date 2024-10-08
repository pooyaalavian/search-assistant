import React from "react";


export function LoadingCard() {
    return (
        <div className="flex flex-col p-4">
            <div className="flex flex-row justify-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-700"></div>
            </div>
            <div className="flex flex-row justify-center mt-8">
                <p className="text-lg">Please wait while we initialize your chat session...</p>
            </div>
        </div>
    );
}