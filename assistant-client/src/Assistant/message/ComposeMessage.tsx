import React, { useState } from 'react';
import { Editable, withReact, Slate, ReactEditor } from 'slate-react'
import {
  Transforms,
  createEditor,
  Descendant,
  BaseEditor,
  // Element as SlateElement,
} from 'slate';
import { Send24Regular, Send24Filled, bundleIcon } from '@fluentui/react-icons';

const SendIcon = bundleIcon(Send24Filled, Send24Regular);

type CustomElement = { type: 'paragraph'; children: CustomText[] }
type CustomText = { text: string }

declare module 'slate' {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor
    Element: CustomElement
    Text: CustomText
  }
}

const initialValue: Descendant[] = [
  {
    type: 'paragraph',
    children: [{ text: '' }],
  },
];


export default function ComposeMessage({ disabled, sendMessage }: { disabled: boolean, sendMessage: (content: string) => Promise<void> }) {
  const [editor] = useState(() => withReact(createEditor()));
  const [editorDisabled, setEditorDisabled] = useState(false);

  const onSubmit = async () => {
    const userInput = editor.string([]);
    editor.delete({
      at: {
        anchor: editor.start([]),
        focus: editor.end([]),
      }
    });
    console.log('User input:', userInput);
    setEditorDisabled(true);
    await sendMessage(userInput);
    setEditorDisabled(false);
  };

  if (disabled) { return null; }

  return <>
    <div className="flex w-full items-center">
      <div className="flex-1 p-1">
        <Slate editor={editor} initialValue={initialValue} >
          <Editable className="p-1 border border-gray-400 max-h-16 overflow-x-auto rounded-md bg-white focus:border-b-2 focus:border-b-violet-500 outline-none"
            onKeyDown={(event:any) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (event.ctrlKey) {
                  Transforms.insertText(editor, '\n');
                }
                else {
                  onSubmit();
                }
              }
            }}
            readOnly={editorDisabled} />
        </Slate>
      </div>
      <div className="flex-0 pr-2 hover-icon cursor-pointer" >
        <Send24Regular className="text-purple-700 regular" />
        <Send24Filled className="text-purple-700 filled" />
      </div>
    </div>
  </>;
}