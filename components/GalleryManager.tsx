import React, { useState, useEffect } from 'react';
import { GithubManifest, GithubManifestItem, getRawFileUrl } from '../services/githubService';
import { LoadingSpinner } from './LoadingSpinner';
import { FolderIcon, TrashIcon, EditIcon } from './Icons';
import { SettingsImageViewerModal } from './SettingsImageViewerModal';

interface GalleryManagerProps {
    manifest: GithubManifest | null;
    onDeleteImage: (albumName: string, imagePath: string) => void;
    onDeleteAlbum: (albumName: string) => void;
    onRenameAlbum: (oldName: string, newName: string) => void;
    isDisabled: boolean;
}

// Helper function for formatting album names
const formatAlbumName = (slug: string): string => {
    if (!slug) return '';
    return slug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

const RemoteThumbnail: React.FC<{ filePath: string; alt: string }> = ({ filePath, alt }) => {
    const [src, setSrc] = useState<string | null>(null);
    useEffect(() => {
        setSrc(null); // Reset src on path change
        const url = getRawFileUrl(filePath);
        const img = new Image();
        img.src = url;
        img.onload = () => setSrc(url);
    }, [filePath]);

    if (!src) return <div className="w-full h-full bg-slate-700 animate-pulse rounded-md" />;
    return <img src={src} alt={alt} className="w-full h-full object-cover" />;
};


export const GalleryManager: React.FC<GalleryManagerProps> = ({ manifest, onDeleteImage, onDeleteAlbum, onRenameAlbum, isDisabled }) => {
    const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
    const [modalState, setModalState] = useState<{ isOpen: boolean; imageIndex: number | null }>({ isOpen: false, imageIndex: null });
    const [isRenaming, setIsRenaming] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const IMAGES_PER_PAGE = 20;

    const sortedAlbums = manifest ? Object.keys(manifest.albums).sort() : [];

    useEffect(() => {
        if (!selectedAlbum && sortedAlbums.length > 0) {
            setSelectedAlbum(sortedAlbums[0]);
        }
        if (selectedAlbum && !sortedAlbums.includes(selectedAlbum)) {
            setSelectedAlbum(sortedAlbums.length > 0 ? sortedAlbums[0] : null);
        }
        // Reset pagination when album changes
        setCurrentPage(1);
    }, [sortedAlbums, selectedAlbum]);

    if (!manifest) {
        return <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-lg flex justify-center items-center"><LoadingSpinner /></div>;
    }

    const handleStartRename = (albumName: string) => {
        setIsRenaming(albumName);
        setNewName(albumName);
    };

    const handleRenameConfirm = () => {
        if (isRenaming && newName.trim() && newName !== isRenaming) {
            onRenameAlbum(isRenaming, newName);
        }
        setIsRenaming(null);
        setNewName('');
    };

    const imagesForSelectedAlbum = selectedAlbum ? manifest.albums[selectedAlbum] || [] : [];
    
    // Pagination logic
    const totalPages = Math.ceil(imagesForSelectedAlbum.length / IMAGES_PER_PAGE);
    const paginatedImages = imagesForSelectedAlbum.slice(
        (currentPage - 1) * IMAGES_PER_PAGE,
        currentPage * IMAGES_PER_PAGE
    );
    
    const handleNextPage = () => {
        if (currentPage < totalPages) setCurrentPage(currentPage + 1);
    };
    
    const handlePrevPage = () => {
        if (currentPage > 1) setCurrentPage(currentPage - 1);
    };

    const handleViewImage = (paginatedIndex: number) => {
        const overallIndex = ((currentPage - 1) * IMAGES_PER_PAGE) + paginatedIndex;
        setModalState({ isOpen: true, imageIndex: overallIndex });
    };

    const handleCloseModal = () => {
        setModalState({ isOpen: false, imageIndex: null });
    };
    
    const handleModalDelete = (imagePath: string) => {
        if (selectedAlbum) {
            onDeleteImage(selectedAlbum, imagePath);
            handleCloseModal();
        }
    }

    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 h-full flex flex-col">
            <h2 className="text-xl font-semibold text-slate-100 border-b border-slate-600 pb-3 mb-4">Gallery Manager</h2>
            <div className="flex-grow grid grid-cols-12 gap-6 min-h-0">
                {/* Left Panel: Album List */}
                <div className="col-span-4 overflow-y-auto pr-2 space-y-2">
                    {sortedAlbums.map(albumName => (
                        <div key={albumName} className="group">
                            {isRenaming === albumName ? (
                                <input 
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    onBlur={handleRenameConfirm}
                                    onKeyDown={(e) => e.key === 'Enter' && handleRenameConfirm()}
                                    className="w-full bg-slate-900 text-white p-2 rounded"
                                    autoFocus
                                />
                            ) : (
                                <button 
                                    onClick={() => setSelectedAlbum(albumName)}
                                    disabled={isDisabled}
                                    className={`w-full flex justify-between items-center text-left p-2 rounded-md transition-colors ${
                                        selectedAlbum === albumName 
                                            ? 'bg-amber-500/20 text-amber-300' 
                                            : 'text-slate-300 hover:bg-slate-700/50'
                                    }`}
                                >
                                    <span className="flex items-center gap-2 font-medium truncate">
                                        <FolderIcon className="w-5 h-5 flex-shrink-0" />
                                        <span className="truncate">{formatAlbumName(albumName)}</span>
                                        <span className="text-xs text-slate-400">({manifest.albums[albumName]?.length || 0})</span>
                                    </span>
                                    {albumName !== 'normal' && (
                                        <span className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={(e) => { e.stopPropagation(); handleStartRename(albumName); }} disabled={isDisabled} className="p-1 hover:text-amber-400 disabled:text-slate-600"><EditIcon className="w-4 h-4" /></button>
                                            <button onClick={(e) => { e.stopPropagation(); onDeleteAlbum(albumName); }} disabled={isDisabled} className="p-1 hover:text-red-500 disabled:text-slate-600"><TrashIcon className="w-4 h-4" /></button>
                                        </span>
                                    )}
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                {/* Right Panel: Image Grid */}
                <div className="col-span-8 bg-slate-900/50 rounded-lg p-4 flex flex-col min-h-0">
                    <div className="flex-grow overflow-y-auto pr-2">
                        {selectedAlbum && imagesForSelectedAlbum.length === 0 && (
                            <div className="flex items-center justify-center h-full text-slate-500">
                                This album is empty.
                            </div>
                        )}
                        {selectedAlbum && imagesForSelectedAlbum.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {paginatedImages.map((image, index) => (
                                    <div key={image.path} className="relative aspect-square group/image">
                                        <div onClick={() => handleViewImage(index)} className="cursor-pointer w-full h-full rounded-md overflow-hidden">
                                            <RemoteThumbnail filePath={image.path} alt={image.path} />
                                        </div>
                                        <button onClick={() => selectedAlbum && onDeleteImage(selectedAlbum, image.path)} disabled={isDisabled} className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white opacity-0 group-hover/image:opacity-100 hover:bg-red-500 transition-opacity disabled:hidden">
                                            <TrashIcon className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {!selectedAlbum && (
                            <div className="flex items-center justify-center h-full text-slate-500">
                                Select an album to view images.
                            </div>
                        )}
                    </div>
                    {totalPages > 1 && (
                       <div className="flex-shrink-0 flex items-center justify-center gap-4 pt-4 mt-auto">
                           <button
                               onClick={handlePrevPage}
                               disabled={isDisabled || currentPage === 1}
                               className="px-4 py-1 bg-slate-700 rounded-md hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                           >
                               Previous
                           </button>
                           <span className="text-sm text-slate-400 font-medium">
                               Page {currentPage} of {totalPages}
                           </span>
                           <button
                               onClick={handleNextPage}
                               disabled={isDisabled || currentPage === totalPages}
                               className="px-4 py-1 bg-slate-700 rounded-md hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                           >
                               Next
                           </button>
                       </div>
                    )}
                </div>
            </div>
            
            {modalState.isOpen && selectedAlbum && modalState.imageIndex !== null && (
                <SettingsImageViewerModal 
                    images={imagesForSelectedAlbum}
                    currentIndex={modalState.imageIndex}
                    onClose={handleCloseModal}
                    onDelete={handleModalDelete}
                />
            )}
        </div>
    );
};