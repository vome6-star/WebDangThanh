import React, { useState, useEffect } from 'react';
import { GithubManifestItem, getRawFileUrl } from '../services/githubService';
import { LoadingSpinner } from './LoadingSpinner';
import { CloseIcon, ChevronLeftIcon, ChevronRightIcon, TrashIcon } from './Icons';

interface SettingsImageViewerModalProps {
    images: GithubManifestItem[];
    currentIndex: number;
    onClose: () => void;
    onDelete: (imagePath: string) => void;
}

const FullSizeImage: React.FC<{ filePath: string; alt: string }> = ({ filePath, alt }) => {
    const [src, setSrc] = useState<string | null>(null);
    const [error, setError] = useState(false);
    
    useEffect(() => {
        setSrc(null);
        setError(false);
        const url = getRawFileUrl(filePath);
        const img = new Image();
        img.src = url;
        img.onload = () => setSrc(url);
        img.onerror = () => setError(true);
    }, [filePath]);

    if (error) return <div className="text-red-400">Failed to load image.</div>;
    if (!src) return <LoadingSpinner className="w-12 h-12" />;
    return <img src={src} alt={alt} className="max-w-full max-h-[85vh] object-contain" />;
};


export const SettingsImageViewerModal: React.FC<SettingsImageViewerModalProps> = ({ images, currentIndex, onClose, onDelete }) => {
    const [index, setIndex] = useState(currentIndex);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight' && index < images.length - 1) setIndex(i => i + 1);
            if (e.key === 'ArrowLeft' && index > 0) setIndex(i => i - 1);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [index, images.length, onClose]);
    
    const image = images[index];
    if (!image) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="relative w-full h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
                
                <FullSizeImage filePath={image.path} alt={image.path} />

                <div className="absolute top-4 right-4 flex gap-2">
                    <button onClick={() => onDelete(image.path)} className="p-2 bg-slate-800/80 rounded-full hover:bg-red-600">
                        <TrashIcon className="w-6 h-6" />
                    </button>
                    <button onClick={onClose} className="p-2 bg-slate-800/80 rounded-full hover:bg-slate-700">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>

                {index > 0 && (
                    <button onClick={() => setIndex(i => i - 1)} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-slate-800/80 rounded-full hover:bg-slate-700">
                        <ChevronLeftIcon className="w-8 h-8" />
                    </button>
                )}
                {index < images.length - 1 && (
                    <button onClick={() => setIndex(i => i + 1)} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-slate-800/80 rounded-full hover:bg-slate-700">
                        <ChevronRightIcon className="w-8 h-8" />
                    </button>
                )}

                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-3 py-1 rounded-full">
                   {index + 1} / {images.length}
                </div>
            </div>
        </div>
    );
};
