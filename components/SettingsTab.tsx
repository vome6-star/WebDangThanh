import React, { useState, useEffect, useCallback } from 'react';
import { 
    getManifest, updateFile, uploadFile, deleteFile, getFileSha, getRawFileContent,
    GithubManifest, GithubManifestItem 
} from '../services/githubService';
import { ImageIcon } from './Icons';
import { UploadPanel, FileToUpload } from './UploadPanel';
import { GalleryManager } from './GalleryManager';
import { LoadingSpinner } from './LoadingSpinner';

interface SettingsTabProps {
    githubToken: string;
}

const slugify = (text: string): string => {
    if (!text) return '';
    return text.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-');
};

const getFileNameParts = (fileName: string): { name: string, extension: string } => {
    const lastDot = fileName.lastIndexOf('.');
    if (lastDot === -1 || lastDot === 0) return { name: fileName, extension: '' };
    return { name: fileName.substring(0, lastDot), extension: fileName.substring(lastDot + 1) };
};


const SettingsTab: React.FC<SettingsTabProps> = ({ githubToken }) => {
    const [manifest, setManifest] = useState<GithubManifest | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const fetchManifestData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const manifestData = await getManifest(githubToken);
            setManifest(manifestData);
        } catch (err) {
            console.error("Failed to fetch manifest:", err);
            setError(err instanceof Error ? err.message : "Could not load repository manifest.");
        } finally {
            setIsLoading(false);
        }
    }, [githubToken]);

    useEffect(() => {
        fetchManifestData();
    }, [fetchManifestData]);
    
    const updateAndPushManifest = async (newManifest: GithubManifest, summaryMessage: string) => {
        const manifestSha = await getFileSha(githubToken, 'manifest.json');
        const updatedContent = JSON.stringify(newManifest, null, 2);
        const updatedBase64 = btoa(updatedContent);

        if (manifestSha) {
            await updateFile(githubToken, 'manifest.json', updatedBase64, manifestSha);
        } else {
            await uploadFile(githubToken, 'manifest.json', updatedBase64);
        }
        setManifest(newManifest); // Update local state
        setActionMessage(summaryMessage);
        setTimeout(() => setActionMessage(null), 5000);
    };

    const handleUploadComplete = async (uploadedFiles: FileToUpload[]) => {
        if (!manifest) return;
        setIsProcessing(true);
        setActionMessage(`Uploading ${uploadedFiles.length} file(s)...`);
        
        try {
            let currentManifest = manifest;
            // Re-fetch manifest to ensure we have the latest version before updating
            currentManifest = await getManifest(githubToken);
            
            const newEntriesByAlbum: { [albumName: string]: GithubManifestItem[] } = {};

            for (const [index, { file, albumName }] of uploadedFiles.entries()) {
                 const { name: originalName, extension } = getFileNameParts(file.name);
                 const newFileName = `${slugify(albumName)}_${Date.now() + index}_${slugify(originalName)}.${extension}`;
                 const imagePath = `${albumName}/${newFileName}`;

                 const contentBase64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => resolve((reader.result as string).split(',')[1]);
                    reader.onerror = reject;
                });

                await uploadFile(githubToken, imagePath, contentBase64);

                if (!newEntriesByAlbum[albumName]) newEntriesByAlbum[albumName] = [];
                newEntriesByAlbum[albumName].push({ path: imagePath, createdAt: new Date().toISOString() });
            }

            const updatedAlbums = { ...currentManifest.albums };
            for (const albumName in newEntriesByAlbum) {
                if (updatedAlbums[albumName]) {
                    updatedAlbums[albumName].push(...newEntriesByAlbum[albumName]);
                } else {
                    updatedAlbums[albumName] = newEntriesByAlbum[albumName];
                }
            }
            const newManifest: GithubManifest = { albums: updatedAlbums };

            await updateAndPushManifest(newManifest, `Successfully uploaded ${uploadedFiles.length} file(s)!`);

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Upload failed.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteImage = async (albumName: string, imagePath: string) => {
        if (!manifest || !window.confirm('Are you sure you want to delete this image? This action is permanent.')) return;
        
        setIsProcessing(true);
        setActionMessage(`Deleting ${imagePath}...`);
        try {
            const sha = await getFileSha(githubToken, imagePath);
            if (!sha) throw new Error("Could not find file to delete.");
            await deleteFile(githubToken, imagePath, sha);

            const newManifest = { ...manifest };
            newManifest.albums[albumName] = newManifest.albums[albumName].filter(img => img.path !== imagePath);

            await updateAndPushManifest(newManifest, `Successfully deleted ${imagePath}.`);
        } catch(err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Failed to delete image.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteAlbum = async (albumName: string) => {
        if (!manifest || albumName === 'normal' || !window.confirm(`Are you sure you want to delete the album "${albumName}" and all its images? This is permanent.`)) return;

        setIsProcessing(true);
        setActionMessage(`Deleting album ${albumName}...`);
        try {
            const imagesToDelete = manifest.albums[albumName] || [];
            for (const image of imagesToDelete) {
                const sha = await getFileSha(githubToken, image.path);
                if (sha) {
                    await deleteFile(githubToken, image.path, sha);
                }
            }

            const newManifest = { ...manifest };
            delete newManifest.albums[albumName];
            
            await updateAndPushManifest(newManifest, `Successfully deleted album ${albumName}.`);

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Failed to delete album.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRenameAlbum = async (oldName: string, newName: string) => {
        const newSlug = slugify(newName);
        if (!manifest || oldName === 'normal' || !newSlug || oldName === newSlug || manifest.albums[newSlug]) {
            setError("Cannot rename: Invalid or duplicate name, or trying to rename the default 'normal' album.");
            return;
        }

        setIsProcessing(true);
        setActionMessage(`Renaming album ${oldName} to ${newSlug}...`);
        try {
            const imagesToMove = manifest.albums[oldName] || [];
            const newImageEntries: GithubManifestItem[] = [];

            for (const image of imagesToMove) {
                const newPath = image.path.replace(new RegExp(`^${oldName}/`), `${newSlug}/`);
                const content = await getRawFileContent(image.path);
                await uploadFile(githubToken, newPath, content);
                newImageEntries.push({ ...image, path: newPath });
                
                const sha = await getFileSha(githubToken, image.path);
                if (sha) await deleteFile(githubToken, image.path, sha);
            }

            const newManifest = { ...manifest };
            delete newManifest.albums[oldName];
            newManifest.albums[newSlug] = newImageEntries;

            await updateAndPushManifest(newManifest, `Successfully renamed album to ${newSlug}.`);

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Failed to rename album.');
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleAddAlbum = async (albumName: string) => {
        const newSlug = slugify(albumName);
        if (!manifest || !newSlug || manifest.albums[newSlug]) {
            setError("Cannot add album: Invalid or duplicate name.");
            return;
        }
        
        const newManifest = { ...manifest };
        newManifest.albums[newSlug] = [];
        await updateAndPushManifest(newManifest, `Successfully added album ${newSlug}.`);
    };


    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><LoadingSpinner /></div>;
    }

    return (
        <>
            <div className="flex items-center gap-3 mb-2">
                <ImageIcon className="w-8 h-8 text-amber-400" />
                <h1 className="text-3xl font-bold tracking-tight text-slate-50">
                    Manage Reference Gallery
                </h1>
            </div>
            <p className="text-sm text-slate-400 mb-8">
                Upload images to your library or manage existing albums and files. All changes are saved to your `ImageLibrary` GitHub repository.
            </p>
             {isProcessing && (
                <div className="fixed top-20 right-8 bg-blue-900/80 text-white p-4 rounded-lg z-50 flex items-center gap-3 backdrop-blur-sm">
                    <LoadingSpinner />
                    <span>{actionMessage || 'Processing...'}</span>
                </div>
            )}
             {error && (
                <div className="fixed top-20 right-8 bg-red-900/80 text-white p-4 rounded-lg z-50">
                    <p>{error}</p>
                    <button onClick={() => setError(null)} className="text-xs underline mt-1">Dismiss</button>
                </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                    <UploadPanel 
                        albums={manifest ? Object.keys(manifest.albums).sort() : ['normal']}
                        onUpload={handleUploadComplete}
                        onAddAlbum={handleAddAlbum}
                        isDisabled={isProcessing}
                    />
                </div>
                <div className="lg:col-span-2">
                    <GalleryManager 
                        manifest={manifest}
                        onDeleteImage={handleDeleteImage}
                        onDeleteAlbum={handleDeleteAlbum}
                        onRenameAlbum={handleRenameAlbum}
                        isDisabled={isProcessing}
                    />
                </div>
            </div>
        </>
    );
};

export default SettingsTab;