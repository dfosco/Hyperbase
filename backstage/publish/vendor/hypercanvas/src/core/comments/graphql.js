/**
 * GitHub GraphQL client for comments.
 *
 * Minimal fetch wrapper with retry, auth header injection, and error handling.
 * PAT is read from auth module at call time.
 */
import { getToken } from './auth.js';
const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function errorMessage(error) {
    if (error !== null && typeof error === 'object' && 'message' in error) {
        const message = error.message;
        return typeof message === 'string' ? message : '';
    }
    return '';
}
/**
 * Execute a GitHub GraphQL query/mutation.
 * @param {string} query - GraphQL query or mutation string
 * @param {object} [variables] - GraphQL variables
 * @param {object} [options] - Options
 * @param {number} [options.retries=2] - Number of retries on transient errors
 * @returns {Promise<object>} - The `data` field from the GraphQL response
 */
export async function graphql(query, variables = {}, options = {}) {
    const { retries = 2 } = options;
    const token = getToken();
    if (!token) {
        throw new Error('Not authenticated — no GitHub PAT found. Please sign in.');
    }
    let lastError = new Error('GitHub GraphQL request failed');
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await fetch(GITHUB_GRAPHQL_URL, {
                method: 'POST',
                headers: {
                    Authorization: `bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query, variables }),
            });
            if (res.status === 401) {
                throw new Error('GitHub PAT is invalid or expired. Please sign in again.');
            }
            if (!res.ok) {
                throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
            }
            const payload = await res.json();
            if (!isRecord(payload))
                throw new Error('GitHub API returned an invalid GraphQL response');
            if (Array.isArray(payload.errors) && payload.errors.length > 0) {
                const messages = payload.errors.map((error) => isRecord(error) && typeof error.message === 'string' ? error.message : 'Unknown GraphQL error');
                throw new Error(`GraphQL error: ${messages.join(', ')}`);
            }
            return payload.data;
        }
        catch (err) {
            lastError = err;
            const message = errorMessage(err);
            // Don't retry auth errors
            if (message.includes('401') || message.includes('Not authenticated') || message.includes('invalid or expired')) {
                throw err;
            }
            if (attempt < retries) {
                await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
            }
        }
    }
    throw lastError;
}
