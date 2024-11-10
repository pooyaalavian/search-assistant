import React, { useState } from "react";
import { ChassisAiSearchResult, SearchResultsMessage } from "../types";
import MessageTime from "./MessageTime";
import copilot from '../assets/copilot.svg';
import ReactDOM from 'react-dom';
import { Dismiss16Filled } from '@fluentui/react-icons';


export function SearchResultMessage({ message, onSendMessage }: { message: SearchResultsMessage, onSendMessage: (content: string) => Promise<void> }) {
    const onCompare = (comparedRows: number[]) => {
        onSendMessage(`Compare the base chassis with chassis ${comparedRows.join(', ')}. Show differences in bold.`);
    };
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
                        </div>
                    </div>
                    <div className="body p-2 ">
                        Here's the results matching your current selection.
                        <SearchTable data={message.results} stale={message.stale} onCompare={onCompare} />
                    </div>
                </div>
            </div>
        </div>
    )
}

function SearchTable({ data, stale, onCompare }: { data: ChassisAiSearchResult[]; stale?: boolean; onCompare: (comparedRows: number[]) => void }) {
    const columns = [
        { title: 'ID', show: false, key: 'ID', },
        { title: '', show: true },
        { title: 'Chassis no.', show: true, key: 'chassis_number', },
        { title: 'Order Year', show: true, key: 'chassis_year', },
        { title: 'Customer', show: true, key: 'customer_name', },
        { title: 'Schedule Date', show: true, key: 'schedule_date', },
        { title: 'Matching Score', show: true, key: '_score', },
        { title: 'Defects', show: true, key: 'defects', },
        { title: 'Links', show: true, key: 'links', },
        { title: 'Compare', show: true, },
    ];

    const [comparedRows, setComparedRows] = useState<number[]>([]);
    const [comparisonMsg, setComparisonMsg] = useState<string | null>(
        stale ? 'The search results are stale. Please scroll down to the most recent search results for comparison.' : null
    );
    const toggleRowForComparison = (rowId: number) => {
        if (stale) {
            return;
        }
        const index = comparedRows.findIndex(r => r == rowId);
        if (index > -1) {
            const newRows = [...comparedRows];
            newRows.splice(index, 1);
            setComparedRows(newRows);
        } else {
            if (comparedRows.length >= 3) {
                setComparisonMsg('You can compare up to 3 items with the base chassis.');
                setTimeout(() => setComparisonMsg(null), 3000);
                return;
            }
            setComparedRows([...comparedRows, rowId]);
        }
    };

    const onCompareClick = () => {
        console.log('compare clicked', comparedRows);
        onCompare(comparedRows);
    };

    return <>
        <div className="overflow-x-auto">
            {comparisonMsg && <div className="text-red-500 text-sm bg-red-100 p-1 rounded-md">{comparisonMsg}</div>}
            <table className="text-sm">
                <thead>
                    <tr>
                        {columns.map((col, index) => {
                            if (col.show) {
                                return <th className="px-1" key={index}>{col.title}</th>
                            }
                        })}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, id) => <SearchRow data={row} rowNumber={id + 1} key={id} compareChecked={!!comparedRows.find(r => r == (id + 1))} compareChange={toggleRowForComparison} />)}
                </tbody>
            </table>
            {comparedRows.length > 0 && <div className="flex flex-row justify-end">
                <button className="p-1 rounded-md border-purple-900 border" onClick={onCompareClick}>Compare</button>
            </div>}
        </div>
    </>;
}

function LinksInfo({ data, close }: { data: ChassisAiSearchResult; close: () => void }) {
    const element = document.getElementById('paccar-assistant-portal');
    if (!element) return <></>;
    return ReactDOM.createPortal(<div className="bg-gray-600 bg-opacity-50 h-full w-full absolute top-0" onClick={(e) => e.target === e.currentTarget && close()}>
        <div className="card m-4 p-4 bg-white rounded-lg">
            <div className="flex flex-col">
                <div className="flex flex-row-reverse">
                    <button onClick={close}>
                        <Dismiss16Filled />
                    </button>
                </div>
                <p>
                    The selected chassis has {data.links.length} associated CAD files from WindChill. {
                        data.links.length > 0 && 'Please select from the list.'}
                </p>
                {data.links.map((link, id) => {
                    return <div className="py-1 border-b">
                        <a href={link.part_url} target="_blank" rel="noreferrer" className="text-blue-500 underline" key={id}>{link.part_name}</a>
                        <br />
                        <span title="Part number" className="rounded-full text-xs bg-gray-200 px-1 mr-1">{link.part_number} </span>
                        <span className="text-sm border border-gray-500 px-1 rounded-l-md" title="Part state">{link.part_state} </span>
                        <span className="text-sm border border-gray-500 px-1  rounded-r-md" title="Part version">{link.part_version}</span>
                        <span className="px-1">(as of {new Date(link.last_modified_date).toLocaleDateString()})</span>
                    </div>
                })}
            </div>

        </div>
    </div>, element);
}

function SearchRow({ data, rowNumber, compareChange, compareChecked }: {
    data: ChassisAiSearchResult;
    rowNumber: number;
    compareChecked: boolean;
    compareChange: (rowId: number) => void;
}) {
    const rowColor = rowNumber % 2 === 0 ? 'bg-gray-50' : 'bg-white';
    let score = data._score || 0;
    score = Math.round(score * 1000);
    const tdClass = 'text-center px-1';

    const [showLinks, setShowLinks] = useState(false);

    const onLinkClick = () => {
        setShowLinks(true);
    }

    return (
        <tr className={rowColor + ' h-8'}>
            <td>
                <div className="rounded-full text-white bg-purple-800 w-4 h-4 flex items-center justify-center">
                    <div className="flex-0 text-sm">
                        {rowNumber}
                    </div>
                </div>
            </td>
            <td className={tdClass}>{data.chassis_number}
                <span className="bg-sky-400 px-1 rounded-md ml-1">{data.division}</span>
            </td>
            <td className={tdClass}>{data.chassis_year}</td>
            <td className={tdClass}>{data.customer_name}</td>
            <td className={tdClass}>{new Date(data.schedule_date).toLocaleDateString()}</td>
            <td className={tdClass}>{score / 10}%</td>
            <td className={tdClass}>{data.defects}</td>
            <td className={tdClass}>
                <button className="px-1 w-14 rounded-md border border-purple-700 text-purple-800 hover:text-black hover:bg-purple-200" onClick={onLinkClick}>{data.links.length} links</button>
            </td>
            <td className={tdClass}><input type="checkbox" checked={compareChecked} onChange={() => compareChange(rowNumber)} /></td>
            {showLinks && <LinksInfo data={data} close={() => setShowLinks(false)} />}
        </tr>
    )
}