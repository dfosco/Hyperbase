/**
 * Browser-safe validation for first-look descriptors and Doc frontmatter.
 *
 * Rules mirror the pinned upstream JSON Schemas (prototype, site, and Doc
 * frontmatter) and emit the same diagnostic codes. Unknown fields are never
 * rejected; they are preserved by the caller.
 */
import { type FirstLookKind } from './contract.js';
export type DescriptorIssue = {
    code: string;
    message: string;
    field?: string;
};
type JsonRecord = Record<string, unknown>;
export declare function isHttpUrl(value: unknown): value is string;
/** A portable forward-slash relative path that stays inside its base. */
export declare function isPortableRelativePath(value: unknown): value is string;
/** Validate a parsed prototype descriptor without rejecting unknown fields. */
export declare function validatePrototypeDescriptor(descriptor: JsonRecord): DescriptorIssue[];
/** Validate a parsed Site descriptor, including local and published separation. */
export declare function validateSiteDescriptor(descriptor: JsonRecord): DescriptorIssue[];
/** Validate Doc frontmatter identity fields, preserving extension metadata. */
export declare function validateDocFrontmatter(frontmatter: JsonRecord): DescriptorIssue[];
/** Shared dispatch used by discovery; keeps the kind-to-validator mapping in one place. */
export declare function validateFirstLookDescriptor(kind: FirstLookKind, descriptor: JsonRecord): DescriptorIssue[];
export {};
