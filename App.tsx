import React, { useState, useEffect } from 'react';
import { getApiToken } from './services/githubService';
import MainTab from './components/MainTab';
import SettingsTab from './components/SettingsTab';
import { HomeIcon, SettingsIcon, ErrorIcon } from './components/Icons';
import { LoadingSpinner } from './components/LoadingSpinner';

type Tab = 'generator' | 'settings';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('generator');
  const [githubToken, setGithubToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        setError(null);
        setIsLoading(true);
        const token = await getApiToken();
        setGithubToken(token);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred while initializing.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    initialize();
  }, []);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
          <LoadingSpinner className="w-12 h-12 mb-4" />
          <p>Initializing application...</p>
        </div>
      );
    }

    if (error || !githubToken) {
      return (
         <div className="flex flex-col items-center justify-center h-64 text-red-400 bg-red-900/20 border border-red-500/30 rounded-lg p-8">
          <ErrorIcon className="w-12 h-12 mb-4" />
          <h2 className="text-xl font-bold mb-2">Initialization Failed</h2>
          <p className="text-center">{error || 'Could not retrieve GitHub token.'}</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'generator':
        return <MainTab githubToken={githubToken} />;
      case 'settings':
        return <SettingsTab githubToken={githubToken} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col font-sans">
      <header className="w-full p-4 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight text-slate-50">
                Mine Tunnel Image Generator
            </h1>
            <nav className="flex items-center gap-2 p-1 rounded-lg bg-slate-800/50 border border-slate-700">
                <TabButton
                    label="Generator"
                    icon={<HomeIcon />}
                    isActive={activeTab === 'generator'}
                    onClick={() => setActiveTab('generator')}
                />
                <TabButton
                    label="Settings"
                    icon={<SettingsIcon />}
                    isActive={activeTab === 'settings'}
                    onClick={() => setActiveTab('settings')}
                />
            </nav>
        </div>
      </header>
      <main className="flex-grow w-full max-w-7xl mx-auto p-4 md:p-8">
        {renderContent()}
      </main>
    </div>
  );
};

interface TabButtonProps {
    label: string;
    // Fix: Made icon prop type more specific to allow passing className with React.cloneElement.
    icon: React.ReactElement<{ className?: string }>;
    isActive: boolean;
    onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ label, icon, isActive, onClick }) => {
    return (
        <button 
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                isActive 
                ? 'bg-amber-500 text-slate-900 shadow-md' 
                : 'text-slate-300 hover:bg-slate-700/50'
            }`}
        >
            {React.cloneElement(icon, { className: 'w-5 h-5' })}
            <span>{label}</span>
        </button>
    )
}


export default App;