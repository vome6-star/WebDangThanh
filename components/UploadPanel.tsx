import React, { useState, useRef, useCallback } from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import { UploadIcon, SuccessIcon, ErrorIcon } from './Icons';

export interface FileToUpload {
    file: File;
    albumName: string;
}

interface UploadPanelProps {
    albums: string[];
    onUpload: (files: FileToUpload[]) => Promise<void>;
    onAddAlbum: (albumName: string) => void;
    isDisabled: boolean;
}

type UploadStatus = 'idle' | 'processing' | 'success' | 'error';

// Helper function for formatting album names
const formatAlbumName = (slug: string): string => {
    if (!slug) return '';
    return slug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

const getFilesFromDataTransfer = async (dataTransfer: DataTransfer): Promise<File[]> => {
    const files: File[] = [];
    const queue: (FileSystemFileEntry | FileSystemDirectoryEntry)[] = [];
    for (const item of Array.from(dataTransfer.items)) {
        const entry = item.webkitGetAsEntry();
        if (entry) queue.push(entry as FileSystemFileEntry | FileSystemDirectoryEntry);
    }
    while (queue.length > 0) {
        const entry = queue.shift();
        if (!entry) continue;
        if (entry.isFile) {
            try {
                const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
                if (file.type.startsWith('image/')) files.push(file);
            } catch (err) { console.error('Error reading file entry:', err); }
        } else if (entry.isDirectory) {
            const reader = (entry as FileSystemDirectoryEntry).createReader();
            try {
                const entries = await new Promise<(FileSystemFileEntry | FileSystemDirectoryEntry)[]>((resolve, reject) => {
                    reader.readEntries(results => resolve(results as any), reject);
                });
                queue.push(...entries);
            } catch (err) { console.error('Error reading directory entry:', err); }
        }
    }
    return files;
};

export const UploadPanel: React.FC<UploadPanelProps> = ({ albums, onUpload, onAddAlbum, isDisabled }) => {
    const [status, setStatus] = useState<UploadStatus>('idle');
    const [message, setMessage] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [selectedAlbum, setSelectedAlbum] = useState('normal');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newAlbumName, setNewAlbumName] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAddNewAlbum = () => {
        if (!newAlbumName.trim()) return;
        onAddAlbum(newAlbumName);
        setNewAlbumName('');
        setIsModalOpen(false);
    };

    const processFiles = async (filesToProcess: File[]) => {
        if (filesToProcess.length === 0) {
            setMessage('No valid image files to upload.');
            setStatus('error');
            return;
        }
        setStatus('processing');
        setMessage(`Preparing to upload ${filesToProcess.length} file(s)...`);
        try {
            const filesToUpload: FileToUpload[] = filesToProcess.map(file => ({ file, albumName: selectedAlbum }));
            await onUpload(filesToUpload);
            setStatus('success');
            setMessage('Upload complete!');
        } catch (err) {
            setStatus('error');
            setMessage(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) processFiles(Array.from(files));
    };

    const handleDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        const files = await getFilesFromDataTransfer(event.dataTransfer);
        processFiles(files);
    }, [selectedAlbum]);

    const handleDragEvents = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (isDisabled) return;
        if (event.type === 'dragenter' || event.type === 'dragover') setIsDragging(true);
        else if (event.type === 'dragleave') setIsDragging(false);
    };

    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 h-full flex flex-col">
            <h2 className="text-xl font-semibold text-slate-100 border-b border-slate-600 pb-3 mb-4">Upload Images</h2>
            <div className="mb-4">
                <label className="block mb-2 text-sm font-medium text-slate-300">Target Album</label>
                <div className="flex gap-2">
                    <select
                        value={selectedAlbum}
                        onChange={e => setSelectedAlbum(e.target.value)}
                        disabled={isDisabled}
                        className="flex-grow p-2 bg-slate-800 border border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none transition-shadow text-slate-200 disabled:opacity-50"
                    >
                        {albums.map(album => <option key={album} value={album}>{formatAlbumName(album)}</option>)}
                    </select>
                    <button onClick={() => setIsModalOpen(true)} disabled={isDisabled} className="px-4 py-2 bg-slate-600 text-slate-100 font-semibold rounded-md hover:bg-slate-500 transition-colors disabled:opacity-50">
                        Add New
                    </button>
                </div>
            </div>

            <div
                className={`relative flex-grow border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-slate-500 transition-colors ${isDisabled ? 'cursor-not-allowed bg-slate-800/50' : isDragging ? 'border-amber-500 bg-amber-500/10' : 'border-slate-600 hover:border-amber-500'}`}
                onDragEnter={handleDragEvents}
                onDragLeave={handleDragEvents}
                onDragOver={handleDragEvents}
                onDrop={handleDrop}
                onClick={() => !isDisabled && fileInputRef.current?.click()}
            >
                <div className="text-center pointer-events-none">
                    <UploadIcon className="w-12 h-12 mx-auto" />
                    <p className="mt-2 font-semibold">Drag & drop files or a folder here</p>
                    <p className="text-xs">or click to select files</p>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} disabled={isDisabled} />
            </div>

             {status !== 'idle' && message && (
                <div className={`mt-4 p-3 rounded-lg text-sm flex items-center gap-3 ${
                    status === 'processing' ? 'bg-blue-900/30 text-blue-300' :
                    status === 'success' ? 'bg-green-900/30 text-green-300' :
                    'bg-red-900/30 text-red-300'
                }`}>
                    {status === 'processing' && <LoadingSpinner className="w-5 h-5" />}
                    {status === 'success' && <SuccessIcon className="w-5 h-5" />}
                    {status === 'error' && <ErrorIcon className="w-5 h-5" />}
                    <span className="break-all">{message}</span>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 rounded-lg p-6 w-full max-w-sm shadow-xl">
                        <h2 className="text-lg font-bold mb-4">Add New Album</h2>
                        <input
                            type="text"
                            value={newAlbumName}
                            onChange={e => setNewAlbumName(e.target.value)}
                            placeholder="e.g., Character Designs"
                            className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddNewAlbum()}
                        />
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-600 rounded-md hover:bg-slate-500">Cancel</button>
                            <button onClick={handleAddNewAlbum} className="px-4 py-2 bg-amber-500 text-slate-900 font-bold rounded-md hover:bg-amber-400">Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};