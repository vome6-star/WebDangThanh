// --- GitHub Service ---

const GITHUB_API_BASE = 'https://api.github.com';
const REPO_OWNER = 'dangthanhktdhumg-eng';
const REPO_NAME = 'ImageLibrary';
const TOKEN_PART_URL = 'https://raw.githubusercontent.com/dangthanhktdhumg-eng/Info/refs/heads/main/DataAccess';
const TOKEN_PREFIX = 'github_pat_11BZIASXI0J3haEYiQGPJl_H8nGXELGxNZOSiLPwmh';

// --- Types ---
export interface GithubManifestItem {
    path: string;
    createdAt: string;
}

export interface GithubManifest {
    albums: {
        [albumName: string]: GithubManifestItem[];
    };
}


// --- Helper Functions ---

const makeRequest = async (url: string, token: string, options: RequestInit = {}, expectJson = true) => {
    const response = await fetch(url, {
        ...options,
        headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            ...options.headers,
        },
    });
    if (!response.ok) {
        // Don't throw for 404, as we handle it specifically in consumer functions
        if (response.status === 404) {
            return null;
        }
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(`GitHub API Error (${response.status}): ${errorData.message || 'Unknown error'}`);
    }
    return expectJson ? response.json() : response;
};

// --- Exported Service Functions ---

export const getApiToken = async (): Promise<string> => {
    try {
        const response = await fetch(TOKEN_PART_URL);
        if (!response.ok) {
            throw new Error(`Failed to fetch token data: ${response.statusText}`);
        }
        const textContent = await response.text();
        const lines = textContent.split('\n');
        
        const imageLibraryLine = lines.find(line => line.includes('ImageLibrary'));

        if (!imageLibraryLine) {
            throw new Error("'ImageLibrary' key not found in the token data file.");
        }

        const parts = imageLibraryLine.split('|');
        if (parts.length < 2 || !parts[1].trim()) {
            throw new Error("Invalid format for 'ImageLibrary' token line.");
        }

        const tokenPart = parts[1].trim();
        return `${TOKEN_PREFIX}${tokenPart}`;
    } catch (error) {
        console.error("Error constructing GitHub API token:", error);
        const errorMessage = error instanceof Error ? error.message : "Could not construct GitHub API token.";
        throw new Error(errorMessage);
    }
};

export const getManifest = async (token: string): Promise<GithubManifest> => {
    const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/manifest.json`;
    const defaultManifest: GithubManifest = { albums: { normal: [] } };
    
    try {
        const data = await makeRequest(url, token, { cache: 'no-store' });
        
        // If manifest doesn't exist, return a default structure
        if (!data) {
            return defaultManifest;
        }

        const content = atob(data.content);
        const parsed = JSON.parse(content);

        // Migration logic: If old format ("images" array) is detected, convert it
        if (parsed.images && Array.isArray(parsed.images)) {
            return { albums: { normal: parsed.images } };
        }

        // If new format is missing 'albums' key for some reason, fix it
        if (!parsed.albums) {
            return defaultManifest;
        }
        
        return parsed as GithubManifest;

    } catch (error) {
        console.error("Error fetching or parsing manifest:", error);
        // Return default structure on any failure
        return defaultManifest;
    }
};

export const getRawFileUrl = (filePath: string): string => {
    return `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${filePath}`;
}

export const getFileSha = async (token: string, filePath: string): Promise<string | null> => {
    const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`;
    const data = await makeRequest(url, token, { cache: 'no-store' });
    return data ? data.sha : null;
};

export const getRawFileContent = async (filePath: string): Promise<string> => {
    const url = getRawFileUrl(filePath);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch raw file content from ${url}`);
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export const uploadFile = async (token: string, filePath: string, contentBase64: string): Promise<void> => {
    const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`;
    await makeRequest(url, token, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: `feat: add file ${filePath}`,
            content: contentBase64,
        }),
    }, false); // Dont expect JSON response for this call on success (201)
};

export const updateFile = async (token: string, filePath: string, contentBase64: string, sha: string): Promise<void> => {
    const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`;
    await makeRequest(url, token, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: `feat: update ${filePath}`,
            content: contentBase64,
            sha: sha,
        }),
    });
};

export const deleteFile = async (token: string, filePath: string, sha: string): Promise<void> => {
    const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`;
    await makeRequest(url, token, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: `feat: delete file ${filePath}`,
            sha: sha,
        }),
    }, false);
};