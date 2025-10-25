import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { generateImage, GeneratedImage } from '../services/geminiService';
import { getManifest, getRawFileUrl, GithubManifest, GithubManifestItem } from '../services/githubService';
import { LoadingSpinner } from './LoadingSpinner';
import { 
  SparklesIcon, GenerateIcon, UploadIcon, TrashIcon, DownloadIcon, 
  CloseIcon, ChevronLeftIcon, ChevronRightIcon, EditIcon, ImageIcon,
  SuccessIcon, ErrorIcon
} from './Icons';

// --- Helper function for formatting album names ---
const formatAlbumName = (slug: string): string => {
    if (!slug) return '';
    return slug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

// --- Remote Image Component ---
interface RemoteImageProps {
    filePath: string;
    alt: string;
    className?: string;
}

const RemoteImage: React.FC<RemoteImageProps> = ({ filePath, alt, className }) => {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let objectUrl: string | null = null;
        const fetchImage = async () => {
            if (!filePath) {
                setError("Missing file path");
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError(null);
            try {
                const url = getRawFileUrl(filePath);
                const response = await fetch(url); // No token needed for public raw content

                if (!response.ok) {
                    throw new Error(`GitHub Raw Content Error: ${response.statusText}`);
                }

                const blob = await response.blob();
                objectUrl = URL.createObjectURL(blob);
                setImageSrc(objectUrl);
            } catch (err) {
                console.error(err);
                setError(err instanceof Error ? err.message : 'Unknown error fetching image');
            } finally {
                setIsLoading(false);
            }
        };

        fetchImage();

        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [filePath]);

    if (isLoading) {
        return (
            <div className={`flex items-center justify-center bg-slate-700/50 rounded-md ${className}`}>
                <LoadingSpinner className="w-6 h-6 text-slate-400" />
            </div>
        );
    }

    if (error || !imageSrc) {
        return (
            <div className={`flex flex-col items-center justify-center bg-red-900/20 text-red-400 p-2 text-center rounded-md ${className}`}>
                <ImageIcon className="w-6 h-6 mb-1" />
                <p className="text-xs leading-tight">Load failed</p>
            </div>
        );
    }

    return <img src={imageSrc} alt={alt} className={className} />;
};


// --- Types ---
interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

// --- Custom Hook for LocalStorage ---
function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(error);
    }
  };
  return [storedValue, setValue] as const;
}

// --- Helper Functions (moved outside component for better separation) ---
const fileToGenerativePart = async (file: File) => {
    const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = (error) => reject(error);
    });
    return { data: base64, mimeType: file.type };
};

const urlToGenerativePart = async (url: string) => {
    const response = await fetch(url); // No token needed
    const blob = await response.blob();
    const file = new File([blob], "remote-ref.jpg", { type: blob.type });
    return fileToGenerativePart(file);
}


// --- Sub-Components ---

const Header: React.FC = () => {
  const slogans = [
    "Crafting Visions from the Digital Deep.",
    "Where Prompts Become Masterpieces.",
    "The Art of AI, Redefined.",
    "Your Imagination, Rendered.",
    "Beyond the Pixels, Into Reality."
  ];
  const slogan = useMemo(() => slogans[Math.floor(Math.random() * slogans.length)], []);

  return (
    <div className="w-full mb-8">
        <div className="flex items-center gap-3">
          <SparklesIcon className="w-8 h-8 text-amber-400" />
          <h1 className="text-3xl font-bold tracking-tight text-slate-50">
            Image Generation
          </h1>
        </div>
        <p className="text-sm text-slate-400 italic mt-1">"{slogan}"</p>
    </div>
  );
};

const Footer: React.FC = () => (
  <footer className="w-full p-4 mt-8 border-t border-slate-700/50">
    <div className="max-w-7xl mx-auto text-center text-xs text-slate-500">
      <p>Powered by Gemini AI. All generated images are stored locally in your browser.</p>
    </div>
  </footer>
);

interface ReferenceGalleryProps {
    images: GithubManifestItem[];
    onSelect: (item: GithubManifestItem) => void;
    selectedItem: GithubManifestItem | null;
    isDisabled: boolean;
    isLoading: boolean;
    error: string | null;
}

const ReferenceGallery: React.FC<ReferenceGalleryProps> = ({ images, onSelect, selectedItem, isDisabled, isLoading, error }) => {
    if (isLoading) {
        return (
            <div className="h-28 flex items-center justify-center bg-slate-700/50 rounded-lg">
                <LoadingSpinner className="w-6 h-6 text-slate-400" />
            </div>
        )
    }

    if (error) {
        return <div className="h-28 flex items-center justify-center bg-red-900/20 text-red-400 rounded-lg text-sm p-4">{error}</div>
    }

    if (images.length === 0) {
        return (
            <div className="h-28 flex flex-col items-center justify-center bg-slate-700/50 text-slate-400 rounded-lg text-sm p-4">
                <p>No reference images in this album.</p>
                <p className="text-xs">Upload images in the Settings tab.</p>
            </div>
        )
    }

    return (
        <div className="flex space-x-3 overflow-x-auto p-2 bg-slate-700/50 rounded-lg">
            {images.map(item => (
                <div key={item.path} className="flex-shrink-0">
                    <button
                        onClick={() => onSelect(item)}
                        disabled={isDisabled}
                        className={`w-24 h-24 rounded-md overflow-hidden border-2 transition-all duration-200 ${selectedItem?.path === item.path ? 'border-amber-500 scale-105' : 'border-transparent hover:border-slate-500'} disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-transparent`}
                    >
                        <RemoteImage 
                            filePath={item.path}
                            alt={item.path}
                            className="w-full h-full object-cover"
                        />
                    </button>
                </div>
            ))}
        </div>
    )
}


interface ControlPanelProps {
  prompt: string;
  setPrompt: (p: string) => void;
  referenceImage: { file: File, preview: string } | null;
  setReferenceImage: (f: { file: File, preview: string } | null) => void;
  selectedRemoteRef: GithubManifestItem | null;
  setSelectedRemoteRef: (item: GithubManifestItem | null) => void;
  onGenerate: () => void;
  isLoading: boolean;
  // Album props
  albums: string[];
  selectedAlbum: string;
  setSelectedAlbum: (album: string) => void;
  galleryImages: GithubManifestItem[];
  isGalleryLoading: boolean;
  galleryError: string | null;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ 
    prompt, setPrompt, referenceImage, setReferenceImage, 
    selectedRemoteRef, setSelectedRemoteRef,
    onGenerate, isLoading,
    albums, selectedAlbum, setSelectedAlbum,
    galleryImages, isGalleryLoading, galleryError
}) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedRemoteRef(null); // Deselect remote ref
      setReferenceImage({ file, preview: URL.createObjectURL(file) });
    }
  };

  const handleRemoteSelect = (item: GithubManifestItem) => {
      setReferenceImage(null); // Deselect local file
      setSelectedRemoteRef(item);
  }
  
  const clearReference = () => {
    setReferenceImage(null);
    setSelectedRemoteRef(null);
  }

  const activeReferencePreview = referenceImage?.preview;

  return (
    <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700 h-full flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-slate-100 border-b border-slate-600 pb-3">Controls</h2>
      
      <div>
        <label className="block mb-2 text-sm font-medium text-slate-300">1. Choose Reference Image</label>
        <p className="text-xs text-slate-400 mb-2">Select an album, then an image. Or upload a local file below. Only one can be active.</p>
        
        <div className="mb-3">
             <label htmlFor="album-select" className="block mb-1 text-xs font-medium text-slate-400">Album</label>
             <select 
                id="album-select"
                value={selectedAlbum}
                onChange={e => setSelectedAlbum(e.target.value)}
                disabled={isLoading}
                className="w-full p-2 bg-slate-700/80 border border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none transition-shadow text-slate-200"
            >
                {albums.map(album => <option key={album} value={album}>{formatAlbumName(album)}</option>)}
            </select>
        </div>

        <ReferenceGallery 
            images={galleryImages}
            onSelect={handleRemoteSelect} 
            selectedItem={selectedRemoteRef}
            isDisabled={isLoading}
            isLoading={isGalleryLoading}
            error={galleryError}
        />
      </div>

      <div>
        <label className="block mb-2 text-sm font-medium text-slate-300">Or Upload Local File</label>
        <div className="relative w-full h-48 border-2 border-dashed border-slate-600 rounded-lg flex items-center justify-center text-slate-500 hover:border-amber-500 transition-colors">
          {activeReferencePreview ? (
            <>
              <img src={activeReferencePreview} alt="Reference" className="object-contain w-full h-full rounded-md" />
              <button onClick={clearReference} className="absolute top-2 right-2 p-1.5 bg-slate-900/50 rounded-full hover:bg-red-500/80 transition-colors">
                <TrashIcon className="w-5 h-5" />
              </button>
            </>
          ) : selectedRemoteRef ? (
             <>
              <RemoteImage 
                  filePath={selectedRemoteRef.path}
                  alt="Reference"
                  className="object-contain w-full h-full rounded-md"
              />
              <button onClick={clearReference} className="absolute top-2 right-2 p-1.5 bg-slate-900/50 rounded-full hover:bg-red-500/80 transition-colors">
                <TrashIcon className="w-5 h-5" />
              </button>
            </>
          ) : (
            <div className="text-center">
              <UploadIcon className="w-10 h-10 mx-auto" />
              <p>Click to upload</p>
            </div>
          )}
          <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileChange} disabled={isLoading} />
        </div>
      </div>
      
      <div>
        <label htmlFor="prompt-input" className="block mb-2 text-sm font-medium text-slate-300">2. Describe Your Image</label>
        <textarea
          id="prompt-input"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="A miner working in a dark coal mine tunnel..."
          className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg resize-none focus:ring-2 focus:ring-amber-500 focus:outline-none transition-shadow text-slate-200 placeholder-slate-500"
          rows={6}
          disabled={isLoading}
        />
      </div>

      <div className="mt-auto">
        <button
          onClick={onGenerate}
          disabled={isLoading || !prompt.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 text-slate-900 font-bold rounded-md hover:bg-amber-400 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:text-slate-400 transition-all duration-200 transform hover:scale-105 disabled:scale-100"
        >
          {isLoading ? <><LoadingSpinner className="w-5 h-5 text-slate-900" /> Generating...</> : <><GenerateIcon className="w-5 h-5" /><span>Generate Image</span></>}
        </button>
      </div>
    </div>
  );
};

interface ImageViewerProps {
  images: GeneratedImage[];
  onImageClick: (index: number) => void;
  isLoading: boolean;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ images, onImageClick, isLoading }) => {
  return (
    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 h-full">
      <h2 className="text-xl font-semibold text-slate-100 border-b border-slate-600 pb-3 mb-4">Generated Gallery</h2>
      {images.length === 0 && !isLoading && (
         <div className="flex flex-col h-full items-center justify-center text-slate-500 text-center p-4">
            <ImageIcon className="w-20 h-20 mb-4 text-slate-600" />
            <h3 className="text-lg font-semibold text-slate-400">Your gallery is empty</h3>
            <p className="mt-1 text-sm">Use the controls on the left to generate your first image.</p>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto" style={{maxHeight: 'calc(100vh - 350px)'}}>
        {images.map((image, index) => (
          <div key={image.id} className="relative aspect-square group cursor-pointer" onClick={() => onImageClick(index)}>
            <img src={image.src} alt={image.prompt} className="w-full h-full object-cover rounded-md" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs text-center p-2">
              <p>{image.prompt.substring(0, 50)}...</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface GalleryModalProps {
  images: GeneratedImage[];
  currentIndex: number | null;
  onClose: () => void;
  onNavigate: (direction: 'next' | 'prev') => void;
  onDelete: (id: string) => void;
  onEdit: (image: GeneratedImage, editPrompt: string) => Promise<void>;
}

const GalleryModal: React.FC<GalleryModalProps> = ({ images, currentIndex, onClose, onNavigate, onDelete, onEdit }) => {
    const [editPrompt, setEditPrompt] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight' && currentIndex !== null && currentIndex < images.length - 1) onNavigate('next');
            if (e.key === 'ArrowLeft' && currentIndex !== null && currentIndex > 0) onNavigate('prev');
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, images.length, onClose, onNavigate]);

    useEffect(() => {
        // Reset edit state when modal opens for a new image
        setEditPrompt('');
        setIsEditing(false);
    }, [currentIndex]);

    if (currentIndex === null) return null;

    const image = images[currentIndex];
    
    const handleEditSubmit = async () => {
        if (!editPrompt.trim()) return;
        setIsEditing(true);
        try {
            await onEdit(image, editPrompt);
            setEditPrompt('');
        } catch (e) {
            // Error toast is shown by the caller (onEdit)
        } finally {
            setIsEditing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 rounded-lg shadow-2xl flex flex-col md:flex-row gap-4 p-4" onClick={e => e.stopPropagation()}>
                <div className="flex-grow flex items-center justify-center relative">
                    <img src={image.src} alt={image.prompt} className="max-w-full max-h-[80vh] object-contain" />
                </div>
                <div className="w-full md:w-80 flex-shrink-0 flex flex-col gap-4 text-slate-300">
                    <div>
                      <h3 className="font-bold text-lg text-slate-100 mb-2">Details</h3>
                      <p className="text-xs bg-slate-800 p-2 rounded"><strong>Created:</strong> {new Date(image.createdAt).toLocaleString()}</p>
                      <p className="text-xs bg-slate-800 p-2 rounded mt-1 max-h-32 overflow-y-auto"><strong>Prompt:</strong> {image.prompt}</p>
                    </div>

                    <div className="mt-4">
                      <h3 className="font-bold text-lg text-slate-100 mb-2">Edit Image</h3>
                      <textarea
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        placeholder="e.g., 'add a canary in a cage'"
                        className="w-full p-2 bg-slate-800 border border-slate-600 rounded-lg resize-none focus:ring-2 focus:ring-amber-500 focus:outline-none transition-shadow text-slate-200 placeholder-slate-500 text-sm"
                        rows={3}
                      />
                      <button onClick={handleEditSubmit} disabled={isEditing || !editPrompt.trim()} className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white font-bold rounded-md hover:bg-green-500 disabled:bg-slate-600">
                        {isEditing ? <LoadingSpinner className="w-4 h-4" /> : <EditIcon className="w-4 h-4" />} Apply Edit
                      </button>
                    </div>

                    <div className="mt-auto flex gap-2">
                        <a href={image.src} download={`generated-image-${image.id}.jpg`} className="flex-grow flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-500">
                            <DownloadIcon className="w-4 h-4" /> Download
                        </a>
                        <button onClick={() => onDelete(image.id)} className="flex-grow flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white font-bold rounded-md hover:bg-red-500">
                            <TrashIcon className="w-4 h-4" /> Delete
                        </button>
                    </div>
                </div>

                <button onClick={onClose} className="absolute top-2 right-2 p-2 bg-slate-800/50 rounded-full hover:bg-slate-700">
                    <CloseIcon className="w-6 h-6" />
                </button>
                {currentIndex > 0 && (
                    <button onClick={() => onNavigate('prev')} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-slate-800/50 rounded-full hover:bg-slate-700">
                        <ChevronLeftIcon className="w-6 h-6" />
                    </button>
                )}
                {currentIndex < images.length - 1 && (
                    <button onClick={() => onNavigate('next')} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-slate-800/50 rounded-full hover:bg-slate-700">
                        <ChevronRightIcon className="w-6 h-6" />
                    </button>
                )}
            </div>
        </div>
    );
};

// --- MainTab Component ---
interface MainTabProps {
    githubToken: string;
    apiKey: string;
}

const MainTab: React.FC<MainTabProps> = ({ githubToken, apiKey }) => {
  const [images, setImages] = useLocalStorage<GeneratedImage[]>('generatedImages', []);
  const [prompt, setPrompt] = useState<string>('A dark, wet coal mine tunnel, with glistening walls and a single rail track disappearing into the darkness.');
  const [referenceImage, setReferenceImage] = useState<{ file: File, preview: string } | null>(null);
  const [selectedRemoteRef, setSelectedRemoteRef] = useState<GithubManifestItem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Gallery state
  const [manifest, setManifest] = useState<GithubManifest | null>(null);
  const [isGalleryLoading, setIsGalleryLoading] = useState(true);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState('normal');


  useEffect(() => {
    const fetchManifest = async () => {
        try {
            setIsGalleryLoading(true);
            setGalleryError(null);
            const manifestData = await getManifest(githubToken);
            setManifest(manifestData);
            // Ensure selected album exists, otherwise default
            if (!manifestData.albums[selectedAlbum]) {
                const firstAlbum = Object.keys(manifestData.albums)[0] || 'normal';
                setSelectedAlbum(firstAlbum);
            }
        } catch (err) {
            setGalleryError("Failed to load reference gallery.");
            console.error(err);
        } finally {
            setIsGalleryLoading(false);
        }
    };
    fetchManifest();
}, [githubToken]);

  const albumNames = useMemo(() => {
    if (!manifest) return ['normal'];
    const keys = Object.keys(manifest.albums);
    return keys.length > 0 ? keys : ['normal'];
  }, [manifest]);

  const galleryImages = useMemo(() => {
      if (!manifest) return [];
      return manifest.albums[selectedAlbum] || [];
  }, [manifest, selectedAlbum]);


  const showToast = (message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 5000);
  };

  const handleGenerate = useCallback(async (basePrompt: string, baseImage: GeneratedImage | null) => {
    if (!basePrompt.trim()) {
        showToast("Prompt cannot be empty.", "error");
        return;
    }
    setIsLoading(true);
    if (modalIndex !== null) { // Close modal if editing from it
        setModalIndex(null);
    }

    try {
      let refImgPart: { data: string; mimeType: string; } | null = null;
      if (baseImage) {
          // Editing existing image
          const response = await fetch(baseImage.src);
          const blob = await response.blob();
          const file = new File([blob], "edit-base.jpg", { type: blob.type });
          refImgPart = await fileToGenerativePart(file);
      } else if (referenceImage) {
          // Using uploaded local image
          refImgPart = await fileToGenerativePart(referenceImage.file);
      } else if (selectedRemoteRef) {
          // Using remote gallery image
          refImgPart = await urlToGenerativePart(getRawFileUrl(selectedRemoteRef.path));
      }
      
      const imageUrl = await generateImage(apiKey, basePrompt, refImgPart);
      const newImage: GeneratedImage = {
        id: crypto.randomUUID(),
        src: imageUrl,
        prompt: basePrompt,
        createdAt: new Date().toISOString()
      };
      setImages(prev => [newImage, ...prev]);
      showToast("Image generated successfully!", "success");

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      showToast(`Generation failed: ${errorMessage}`, 'error');
      // Re-throw for upstream handlers (like in modal)
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [referenceImage, selectedRemoteRef, setImages, modalIndex, apiKey]);

  const handleDeleteImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
    setModalIndex(null); // Close modal after deletion
  };
  
  const handleEditImage = async (image: GeneratedImage, editPrompt: string) => {
      const combinedPrompt = `${image.prompt}, edited to ${editPrompt}`;
      await handleGenerate(combinedPrompt, image);
  };

  const handleNavigateModal = (direction: 'next' | 'prev') => {
    if (modalIndex === null) return;
    const newIndex = direction === 'next' ? modalIndex + 1 : modalIndex - 1;
    if (newIndex >= 0 && newIndex < images.length) {
      setModalIndex(newIndex);
    }
  };

  return (
    <>
      <Header />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
        <div className="lg:col-span-1">
          <ControlPanel 
            prompt={prompt}
            setPrompt={setPrompt}
            referenceImage={referenceImage}
            setReferenceImage={setReferenceImage}
            selectedRemoteRef={selectedRemoteRef}
            setSelectedRemoteRef={setSelectedRemoteRef}
            onGenerate={() => handleGenerate(prompt, null)}
            isLoading={isLoading}
            albums={albumNames}
            selectedAlbum={selectedAlbum}
            setSelectedAlbum={setSelectedAlbum}
            galleryImages={galleryImages}
            isGalleryLoading={isGalleryLoading}
            galleryError={galleryError}
          />
        </div>
        <div className="lg:col-span-2">
          <ImageViewer 
            images={images}
            onImageClick={setModalIndex}
            isLoading={isLoading}
          />
        </div>
      </div>
      <Footer />
      <GalleryModal
        images={images}
        currentIndex={modalIndex}
        onClose={() => setModalIndex(null)}
        onNavigate={handleNavigateModal}
        onDelete={handleDeleteImage}
        onEdit={handleEditImage}
      />
      {/* --- Toast Container --- */}
      <div className="fixed bottom-4 right-4 z-[100] w-full max-w-sm flex flex-col gap-3">
        {toasts.map(toast => {
          const Icon = toast.type === 'success' ? SuccessIcon : ErrorIcon;
          const borderColor = toast.type === 'success' ? 'border-green-500' : 'border-red-500';
          return (
            <div key={toast.id} className={`flex items-start gap-3 w-full p-4 rounded-lg shadow-2xl bg-slate-800/80 backdrop-blur-sm border-l-4 ${borderColor} animate-fade-in-right`}>
              <Icon className="w-6 h-6 flex-shrink-0 mt-0.5" />
              <p className="flex-grow text-sm text-slate-100">{toast.message}</p>
              <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className="p-1 -m-1 rounded-full hover:bg-slate-700">
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default MainTab;