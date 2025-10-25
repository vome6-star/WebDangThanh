import React, { useState } from 'react';
import { CloseIcon, SettingsIcon } from './Icons';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (key: string) => void;
    currentApiKey: string | null;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave, currentApiKey }) => {
    const [keyInput, setKeyInput] = useState(currentApiKey || '');

    const handleSave = () => {
        if (keyInput.trim()) {
            onSave(keyInput.trim());
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md shadow-xl border border-slate-700">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold flex items-center gap-2"><SettingsIcon className="w-5 h-5"/> Configure API Key</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-700"><CloseIcon className="w-5 h-5" /></button>
                </div>
                <p className="text-sm text-slate-400 mb-4">
                    Your Gemini API key is stored securely in your browser's local storage and is never sent to any other servers.
                </p>
                <input
                    type="password"
                    value={keyInput}
                    onChange={e => setKeyInput(e.target.value)}
                    placeholder="Enter your Gemini API Key"
                    className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
                 <p className="text-xs text-slate-500 mt-2">
                    You can get your key from{' '}
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-amber-400 underline hover:text-amber-300">
                        Google AI Studio
                    </a>.
                </p>
                <div className="flex justify-end gap-2 mt-6">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-600 rounded-md hover:bg-slate-500 text-sm font-medium">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-amber-500 text-slate-900 font-bold rounded-md hover:bg-amber-400 text-sm">Save Key</button>
                </div>
            </div>
        </div>
    );
};