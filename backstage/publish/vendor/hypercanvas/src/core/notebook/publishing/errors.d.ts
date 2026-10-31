/**
 * Publishing error taxonomy.
 *
 * Every publishing failure carries a stable `code`. Codes marked actionable are
 * meant to pause a publish operation for user resolution and retry (see
 * DOCS/publishing.md — "Recovery").
 */
export declare const PUBLISHING_ERROR_CODES: readonly ["INVALID_NOTEBOOK", "INVALID_MODE", "INVALID_DESTINATION", "DESTINATION_INSIDE_NOTEBOOK", "DESTINATION_NOT_DIRECTORY", "DESTINATION_NOT_EMPTY", "NOT_A_PUBLICATION", "MARKER_MISMATCH", "PARENT_REPOSITORY", "IGNORED_REQUIRED_FILES", "GIT_UNAVAILABLE", "GIT_FAILED", "GIT_IDENTITY_UNAVAILABLE", "REMOTE_CONFLICT", "REMOTE_NOT_PUBLICATION", "GH_UNAVAILABLE", "GH_NOT_AUTHENTICATED", "GH_PROVISIONING_UNSUPPORTED", "GH_LOGIN_IN_PROGRESS", "GH_LOGIN_STALE", "GH_LOGIN_NOT_FOUND", "REPOSITORY_EXISTS", "REPOSITORY_NOT_FOUND", "REPOSITORY_UNAVAILABLE", "INVALID_REPOSITORY", "INVALID_REPOSITORY_MODE", "INVALID_VISIBILITY", "INVALID_BRANCH", "ORIGIN_MISMATCH", "PAGES_SITE_CONFIGURED", "PAGES_WORKFLOW_CONFLICT", "PAGES_REQUEST_FAILED", "WORKFLOW_DISPATCH_FAILED", "BUILD_INSTALL_FAILED", "PUBLISH_SOURCE_CONFLICT", "PUBLISH_IGNORE_INVALID", "PUBLISH_BUILD_FAILED", "NPM_UNAVAILABLE", "OPERATION_NOT_FOUND", "OPERATION_NOT_RETRYABLE", "UNSUPPORTED_PROVIDER", "PROVIDER_NOT_CONNECTED", "INVALID_CREDENTIAL", "PROJECT_NOT_FOUND", "GITHUB_NOT_CONNECTED", "GITHUB_REQUEST_FAILED", "PUBLISHING_FAILED"];
export type PublishingErrorCode = typeof PUBLISHING_ERROR_CODES[number];
export type PublishingError = Error & {
    code: string;
    detail: unknown;
    hint: unknown;
    actionable: boolean;
};
/** Error codes that pause an operation for user resolution instead of failing it. */
export declare const ACTIONABLE_ERROR_CODES: Set<string>;
export declare function publishingError(code: string, message: string, detail?: unknown, hint?: unknown): PublishingError;
