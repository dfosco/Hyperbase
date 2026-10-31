/**
 * Browser-safe validation for first-look descriptors and Doc frontmatter.
 *
 * Rules mirror the pinned upstream JSON Schemas (prototype, site, and Doc
 * frontmatter) and emit the same diagnostic codes. Unknown fields are never
 * rejected; they are preserved by the caller.
 */
import { FIRST_LOOK_FORMAT_VERSION, FIRST_LOOK_PROTOTYPE_RUNTIME, isFirstLookId, } from './contract.js';
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function nonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}
export function isHttpUrl(value) {
    if (typeof value !== 'string')
        return false;
    try {
        const url = new URL(value);
        return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.length > 0;
    }
    catch {
        return false;
    }
}
/** A portable forward-slash relative path that stays inside its base. */
export function isPortableRelativePath(value) {
    if (typeof value !== 'string' || value.length === 0)
        return false;
    if (value.includes('\\') || value.startsWith('/') || /^[A-Za-z]:/.test(value))
        return false;
    return value.split('/').every(segment => segment !== '' && segment !== '.');
}
function identityIssues(descriptor, issues) {
    if (descriptor.formatVersion !== FIRST_LOOK_FORMAT_VERSION) {
        issues.push({ code: 'UNSUPPORTED_FORMAT_VERSION', message: 'formatVersion must be 1.', field: 'formatVersion' });
    }
    if (!isFirstLookId(descriptor.id)) {
        issues.push({ code: 'MISSING_OR_INVALID_ID', message: 'id must be a stable artifact ID.', field: 'id' });
    }
    if (!nonEmptyString(descriptor.title)) {
        issues.push({ code: 'MISSING_OR_INVALID_TITLE', message: 'title must be a non-empty string.', field: 'title' });
    }
}
function referenceIssues(descriptor, issues) {
    if (descriptor.references === undefined)
        return;
    if (!Array.isArray(descriptor.references)) {
        issues.push({ code: 'INVALID_REFERENCES', message: 'references must be an array of stable artifact IDs.', field: 'references' });
        return;
    }
    const invalid = descriptor.references.some(value => !isFirstLookId(value));
    const unique = new Set(descriptor.references).size === descriptor.references.length;
    if (invalid || !unique) {
        issues.push({ code: 'INVALID_REFERENCES', message: 'references must contain unique stable artifact IDs.', field: 'references' });
    }
}
function viewIssues(descriptor, issues, kind) {
    if (descriptor.views === undefined)
        return;
    if (!Array.isArray(descriptor.views)) {
        issues.push({ code: 'INVALID_DESCRIPTOR', message: 'views must be an array.', field: 'views' });
        return;
    }
    descriptor.views.forEach((view, index) => {
        const field = `views.${index}`;
        if (!isRecord(view)) {
            issues.push({ code: 'INVALID_DESCRIPTOR', message: `${field} must be an object.`, field });
            return;
        }
        if (!isFirstLookId(view.id)) {
            issues.push({ code: 'INVALID_DESCRIPTOR', message: `${field}.id must be a stable view ID.`, field: `${field}.id` });
        }
        if (!nonEmptyString(view.title)) {
            issues.push({ code: 'INVALID_DESCRIPTOR', message: `${field}.title must be a non-empty string.`, field: `${field}.title` });
        }
        if (kind === 'prototype') {
            if (typeof view.path !== 'string' || !view.path.startsWith('/')) {
                issues.push({ code: 'INVALID_DESCRIPTOR', message: `${field}.path must start with "/".`, field: `${field}.path` });
            }
        }
        else if (view.path !== undefined && typeof view.path !== 'string') {
            issues.push({ code: 'INVALID_DESCRIPTOR', message: `${field}.path must be a string.`, field: `${field}.path` });
        }
    });
}
function duplicateViewIssues(descriptor, issues) {
    if (!Array.isArray(descriptor.views))
        return;
    const seen = new Set();
    descriptor.views.forEach((view, index) => {
        if (!isRecord(view) || typeof view.id !== 'string')
            return;
        if (seen.has(view.id)) {
            issues.push({ code: 'DUPLICATE_VIEW_ID', message: `View id "${view.id}" is used more than once.`, field: `views.${index}.id` });
        }
        seen.add(view.id);
    });
}
/** Validate a parsed prototype descriptor without rejecting unknown fields. */
export function validatePrototypeDescriptor(descriptor) {
    const issues = [];
    identityIssues(descriptor, issues);
    const runtime = descriptor.runtime;
    if (!isRecord(runtime) || runtime.id !== FIRST_LOOK_PROTOTYPE_RUNTIME.id || runtime.version !== FIRST_LOOK_PROTOTYPE_RUNTIME.version) {
        issues.push({
            code: 'UNSUPPORTED_PROTOTYPE_RUNTIME',
            message: `Prototype runtime must use ${FIRST_LOOK_PROTOTYPE_RUNTIME.id}@${FIRST_LOOK_PROTOTYPE_RUNTIME.version}.`,
            field: 'runtime',
        });
    }
    if (!nonEmptyString(descriptor.entry)) {
        issues.push({ code: 'INVALID_DESCRIPTOR', message: 'entry must be a non-empty string.', field: 'entry' });
    }
    referenceIssues(descriptor, issues);
    viewIssues(descriptor, issues, 'prototype');
    duplicateViewIssues(descriptor, issues);
    return issues;
}
/** Validate a parsed Site descriptor, including local and published separation. */
export function validateSiteDescriptor(descriptor) {
    const issues = [];
    identityIssues(descriptor, issues);
    if (descriptor.description !== undefined && typeof descriptor.description !== 'string') {
        issues.push({ code: 'INVALID_DESCRIPTOR', message: 'description must be a string.', field: 'description' });
    }
    referenceIssues(descriptor, issues);
    if (descriptor.local !== undefined) {
        if (!isRecord(descriptor.local)) {
            issues.push({ code: 'INVALID_SITE_LOCAL_REFERENCE', message: 'local must be an object.', field: 'local' });
        }
        else {
            if (descriptor.local.sourcePath !== undefined && !nonEmptyString(descriptor.local.sourcePath)) {
                issues.push({ code: 'INVALID_LOCAL_SOURCE_PATH', message: 'local.sourcePath must be a non-empty local filesystem path.', field: 'local.sourcePath' });
            }
            if (descriptor.local.developmentUrl !== undefined && !isHttpUrl(descriptor.local.developmentUrl)) {
                issues.push({ code: 'INVALID_LOCAL_DEVELOPMENT_URL', message: 'local.developmentUrl must be an absolute HTTP(S) URL.', field: 'local.developmentUrl' });
            }
        }
    }
    if (descriptor.published !== undefined) {
        if (!isRecord(descriptor.published)) {
            issues.push({ code: 'INVALID_SITE_PUBLISHED_REFERENCE', message: 'published must be an object.', field: 'published' });
        }
        else if (!isHttpUrl(descriptor.published.url)) {
            issues.push({ code: 'INVALID_PUBLISHED_URL', message: 'published.url must be an absolute HTTP(S) URL.', field: 'published.url' });
        }
    }
    viewIssues(descriptor, issues, 'site');
    duplicateViewIssues(descriptor, issues);
    if (Array.isArray(descriptor.views)) {
        descriptor.views.forEach((view, index) => {
            if (!isRecord(view))
                return;
            if (view.localUrl !== undefined && !isHttpUrl(view.localUrl)) {
                issues.push({ code: 'INVALID_VIEW_LOCAL_URL', message: `views[${index}].localUrl must be an absolute HTTP(S) URL.`, field: `views.${index}.localUrl` });
            }
            if (view.publishedUrl !== undefined && !isHttpUrl(view.publishedUrl)) {
                issues.push({ code: 'INVALID_VIEW_PUBLISHED_URL', message: `views[${index}].publishedUrl must be an absolute HTTP(S) URL.`, field: `views.${index}.publishedUrl` });
            }
            if (view.screenshot !== undefined && !isPortableRelativePath(view.screenshot)) {
                issues.push({ code: 'INVALID_RELATIVE_PATH', message: `views[${index}].screenshot must be a portable relative path.`, field: `views.${index}.screenshot` });
            }
        });
    }
    return issues;
}
/** Validate Doc frontmatter identity fields, preserving extension metadata. */
export function validateDocFrontmatter(frontmatter) {
    const issues = [];
    identityIssues(frontmatter, issues);
    referenceIssues(frontmatter, issues);
    return issues;
}
/** Shared dispatch used by discovery; keeps the kind-to-validator mapping in one place. */
export function validateFirstLookDescriptor(kind, descriptor) {
    if (kind === 'prototype')
        return validatePrototypeDescriptor(descriptor);
    if (kind === 'site')
        return validateSiteDescriptor(descriptor);
    if (kind === 'doc')
        return validateDocFrontmatter(descriptor);
    return [];
}
