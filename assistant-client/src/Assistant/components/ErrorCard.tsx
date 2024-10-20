import React from "react";


export function ErrorCard({ error }: { error: string }) {
    return (
        <div className="flex flex-col p-4">
            <div className="flex flex-row justify-center">
                <div className="rounded-full h-32 w-32 border-2 border-red-700 flex items-center justify-center overflow-hidden">
                    <div className="text-red-700 text-6xl font-bold ">
                        <svg width="64" height="64">
                            <line x1="0%" y1="0%" x2="100%" y2="100%" stroke="currentColor" strokeWidth="5%" />
                            <line x1="100%" y1="0%" x2="0%" y2="100%" stroke="currentColor" strokeWidth="5%" />
                        </svg>
                    </div>
                </div>
            </div>
            <div className="flex flex-row justify-center mt-8">
                <p className="text-lg">
                    {error}
                </p>
            </div>
            <div className="flex flex-row justify-center mt-4">
                <p>Consider refreshing the page. If the error persists, contact PACCAR Assistant team.</p>
            </div>
        </div>
    );
}