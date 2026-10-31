/** Read Git from the selected Notebook, including containing repos and worktrees. */
export declare function readNotebookGitBranch(root: string): {
    isRepository: boolean;
    branch: string | null;
    commit: string | null;
    detached: boolean;
};
/** Read optional Git metadata without replaying a failed Git command's stderr. */
export declare function readOptionalGitValue(cwd: string, args: string[]): string | null;
