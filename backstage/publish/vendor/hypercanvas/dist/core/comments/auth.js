/**
 * PAT authentication for comments.
 *
 * Stores and retrieves the GitHub PAT from localStorage.
 * Provides validation by fetching the authenticated user and
 * verifying the token can access repository discussions.
 */
import { getCommentsConfig } from './config.js';
const STORAGE_KEY = 'sb-comments-token';
const USER_KEY = 'sb-comments-user';
const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isCachedCommentUser(value) {
    return isRecord(value)
        && typeof value.login === 'string'
        && typeof value.avatarUrl === 'string'
        && (value.scopes === undefined || (Array.isArray(value.scopes) && value.scopes.every((scope) => typeof scope === 'string')));
}
function parseGitHubUser(value) {
    if (!isRecord(value) || typeof value.login !== 'string' || typeof value.avatar_url !== 'string') {
        throw new Error('Invalid token — GitHub returned an invalid user response');
    }
    return { login: value.login, avatar_url: value.avatar_url };
}
/**
 * Get the stored PAT token.
 * @returns {string|null}
 */
export function getToken() {
    try {
        return localStorage.getItem(STORAGE_KEY);
    }
    catch {
        return null;
    }
}
/**
 * Store a PAT token.
 * @param {string} token
 */
export function setToken(token) {
    localStorage.setItem(STORAGE_KEY, token);
}
/**
 * Remove the stored PAT token and user.
 */
export function clearToken() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_KEY);
}
/**
 * Get the cached authenticated user info.
 * @returns {{ login: string, avatarUrl: string }|null}
 */
export function getCachedUser() {
    try {
        const raw = localStorage.getItem(USER_KEY);
        if (!raw)
            return null;
        const parsed = JSON.parse(raw);
        return isCachedCommentUser(parsed) ? parsed : null;
    }
    catch {
        return null;
    }
}
/**
 * Validate a PAT by fetching the authenticated user from GitHub,
 * then probing the GraphQL API to verify the token can access
 * the configured repository's discussions.
 *
 * Caches the user in localStorage on success.
 * @param {string} token - GitHub PAT to validate
 * @returns {Promise<{ login: string, avatarUrl: string }>}
 */
export async function validateToken(token) {
    // 1. Verify token is a valid GitHub token
    const res = await fetch('https://api.github.com/user', {
        headers: { Authorization: `bearer ${token}` },
    });
    if (!res.ok) {
        throw new Error('Invalid token — GitHub returned ' + res.status);
    }
    const rawUser = await res.json();
    const user = parseGitHubUser(rawUser);
    const scopes = (res.headers.get('x-oauth-scopes') || '').split(',').map(s => s.trim()).filter(Boolean);
    const userInfo = { login: user.login, avatarUrl: user.avatar_url, scopes };
    // 2. Verify the token can access repository discussions
    await validateTokenPermissions(token);
    localStorage.setItem(USER_KEY, JSON.stringify(userInfo));
    return userInfo;
}
/**
 * Probe the GraphQL API to verify the token has access to the
 * configured repository's discussions. Throws a descriptive error
 * if the token lacks the required scopes.
 * @param {string} token - GitHub PAT to test
 */
async function validateTokenPermissions(token) {
    const config = getCommentsConfig();
    if (!config)
        return; // no config = nothing to probe
    const { owner, name } = config.repo;
    if (!owner || !name)
        return;
    const query = `query { repository(owner: "${owner}", name: "${name}") { id discussionCategories(first: 1) { nodes { id } } } }`;
    const res = await fetch(GITHUB_GRAPHQL_URL, {
        method: 'POST',
        headers: {
            Authorization: `bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
    });
    if (res.status === 401) {
        throw new Error('Token is invalid or expired.');
    }
    if (!res.ok) {
        throw new Error(`GitHub API error: ${res.status}`);
    }
    const rawJson = await res.json();
    if (!isRecord(rawJson))
        throw new Error('GitHub API returned an invalid response');
    const json = rawJson;
    if (Array.isArray(json.errors) && json.errors.length > 0) {
        const messages = json.errors.map((error) => isRecord(error) && typeof error.message === 'string' ? error.message : 'Unknown GraphQL error');
        const msg = messages.join(', ');
        if (msg.includes('not accessible') || msg.includes('insufficient')) {
            throw new Error(`Token doesn't have access to ${owner}/${name} discussions. ` +
                'Fine-grained tokens need "Discussions: Read and write". ' +
                'Classic tokens need the "repo" scope.');
        }
        throw new Error(`GitHub API error: ${msg}`);
    }
    const data = isRecord(json.data) ? json.data : null;
    const repository = data && isRecord(data.repository) ? data.repository : null;
    if (!repository) {
        throw new Error(`Repository ${owner}/${name} not found. Check that the token has access to this repository.`);
    }
    const discussionCategories = isRecord(repository.discussionCategories) ? repository.discussionCategories : null;
    const nodes = discussionCategories?.nodes;
    if (!Array.isArray(nodes) || nodes.length === 0) {
        throw new Error(`No discussion categories found in ${owner}/${name}. Enable Discussions in the repository settings.`);
    }
}
/**
 * Check whether the user is currently authenticated.
 * @returns {boolean}
 */
export function isAuthenticated() {
    return getToken() !== null;
}
