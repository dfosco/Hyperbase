/**
 * GitHub GraphQL client for comments.
 *
 * Minimal fetch wrapper with retry, auth header injection, and error handling.
 * PAT is read from auth module at call time.
 */
export interface GraphqlOptions {
    retries?: number;
}
type GraphqlVariables = Record<string, unknown>;
/**
 * Execute a GitHub GraphQL query/mutation.
 * @param {string} query - GraphQL query or mutation string
 * @param {object} [variables] - GraphQL variables
 * @param {object} [options] - Options
 * @param {number} [options.retries=2] - Number of retries on transient errors
 * @returns {Promise<object>} - The `data` field from the GraphQL response
 */
export declare function graphql(query: string, variables?: GraphqlVariables, options?: GraphqlOptions): Promise<unknown>;
export {};
