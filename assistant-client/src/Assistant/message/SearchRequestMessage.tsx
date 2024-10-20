import React, { useState } from "react";
import { SyncIcon } from "../components/SyncIcon";
import { SearchKey, SearchRequestMessage, } from "../types";
import MessageTime from "./MessageTime";
import { CheckmarkCircle16Regular } from '@fluentui/react-icons';


function InactiveSearchKeyItem({ searchKey, even }: { searchKey: SearchKey; even: boolean }) {
    const name = searchKey.name.split('_').map((s) => s[0].toUpperCase() + s.slice(1)).join(' ');
    return <div className={"flex px-1 select-none " + (even ? 'bg-white' : 'bg-purple-50')}>
        <div className="flex-0 w-16">
            <input type="checkbox" checked={searchKey.selected} disabled />
        </div>
        <div className="flex-0 w-16">
            <input type="checkbox" checked={searchKey.mandatory} disabled />
        </div>
        <div className="flex-1 pl-2 text-sm">
            {name}
        </div>
    </div>
}

export function InactiveSearchRequestMessagePanel({ message, }: { message: SearchRequestMessage; }) {
    const searchKeys = message.query;
    return (
        <div className="flex flex-row-reverse items-end pt-4 relative">
            <div className="flex-0 h-full"></div>
            <div className="flex-col" style={{ flex: "1 1 70%" }}>
                <div className="timeinfo flex-0 text-right"><MessageTime timestamp={message.timestamp} /></div>
                <div className="p-2 rounded-md bg-violet-200 shadow-md">
                    Your search criteria selection:
                    <ul>
                        {searchKeys.map((sk, index) => <InactiveSearchKeyItem searchKey={sk} key={index} even={index % 2 == 0} />)}
                    </ul>
                </div>
            </div>
            <div className="min-w-16" style={{ flex: "1 1 0%" }}></div>
            {!message.messageId && <div className="absolute b-0 r-0 animate-spin">
                <SyncIcon />
            </div>}
            {message.messageId && <div className="absolute b-0 r-0 w-4 h-4 ">
                <CheckmarkCircle16Regular className="text-green-500 bg-white rounded-full" />
            </div>}
        </div>
    )
}


function ToggleSwitch({ value, onChange, style }: { value: boolean, style: [string, string]; onChange: (e: React.ChangeEvent<any>) => void }) {
    const className = `bg-${style[0]} peer-checked:bg-${style[1]} `;
    return <label className="inline-flex items-center mb-1 cursor-pointer">
        <input type="checkbox" className="sr-only peer" checked={value} onChange={onChange} />
        <div className={"relative w-7 h-4 rounded-full peer  peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-black after:border peer-checked:after:border-black peer-checked:after:border  after:rounded-full after:h-3 after:w-3 after:transition-all  " + className}></div>
        <span className="ms-3 text-sm font-medium text-gray-900 "></span>
    </label>
}

function ActiveSearchKeyItem({ searchKey, even }: { searchKey: SearchKey; even: boolean; index: number }) {
    const name = searchKey.name.split('_').map((s) => s[0].toUpperCase() + s.slice(1)).join(' ');
    const [selected, setSelected] = useState(searchKey.selected);
    const [mandatory, setMandatory] = useState(searchKey.mandatory);

    const change_selected = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelected(e.target.checked);
        searchKey.selected = e.target.checked;
    }
    const change_mandatory = (e: React.ChangeEvent<HTMLInputElement>) => {
        setMandatory(e.target.checked);
        searchKey.mandatory = e.target.checked;
    }

    return  <div className={"flex px-1 select-none " + (!even ? 'bg-white' : 'bg-purple-50')}>
            <div className="flex-0 w-16">
                <ToggleSwitch style={['white', 'purple-600']} value={selected} onChange={change_selected} />
            </div>
            <div className="flex-0 w-16">
                <ToggleSwitch style={['white', 'red-600']} value={mandatory} onChange={change_mandatory} />
            </div>
            <div className="flex-1 pl-2 text-sm">
                {name}
            </div>
        </div>
        
}

const SearchKeyList = React.memo(function ({ list }: { list: SearchKey[] }) {
    return list.map((sk: SearchKey, index: number) => (
        <ActiveSearchKeyItem searchKey={sk} index={index} key={sk.id} even={index % 2 == 0} />
    ));

});

export function ActiveSearchRequestMessagePanel({ searchKeys, onDiscard, onSubmit }: { searchKeys: SearchKey[]; onDiscard: () => void; onSubmit: (sk: SearchKey[], countNeeded?: number) => void; }) {
    const [countNeeded, setCountNeeded] = useState(10);
    const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCountNeeded(Number(e.target.value));
    };

    return (
        <div className="flex flex-row-reverse items-end pt-4 relative">
            <div className="flex-0 h-full"></div>
            <div className="flex-col" style={{ flex: "1 1 70%" }}>
                <div className="timeinfo flex-0 text-right"></div>
                <div className="p-2 rounded-md bg-white border border-2 border-dashed border-black shadow-md">
                    Please select your search criteria:
                    <div className="tbl">
                        <div className="headers flex">
                            <div className="flex-0 w-16 text-sm">Selected</div>
                            <div className="flex-0 w-16 text-sm">Mandatory</div>
                            <div className="flex-1 text-sm pl-4">Filter</div>
                        </div>
                        <div className="rounded-md">
                            <SearchKeyList list={searchKeys} />
                            {/* {searchKeys.map((sk, index) => <RenderSearchKey searchKey={sk} key={index} even={index % 2 == 0} active={true} />)} */}
                        </div>
                    </div>
                    <div className="flex flex-row mt-2">
                        <div className="flex-0 text-sm">Number of records to return </div>
                        <div className="flex-1 px-2">
                            <input type="number" className="border-purple-400 w-32 border" value={countNeeded} onChange={handleCountChange} min="1" max="25" step="1" />
                        </div>
                    </div>

                    <div className="my-2">
                        <button className="p-1 mr-2 rounded-md text-sm border border-purple-700 text-purple-700 bg-white" onClick={onDiscard}>Discard</button>
                        <button className="p-1 rounded-md text-sm border border-purple-700 text-purple-700 bg-white" onClick={() => onSubmit(searchKeys, countNeeded)}>Submit</button>
                    </div>
                </div>
            </div>
            <div className="min-w-16" style={{ flex: "1 1 0%" }}></div>
        </div >
    )
}