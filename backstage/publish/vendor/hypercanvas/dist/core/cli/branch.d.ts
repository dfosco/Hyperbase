/**
 * storyboard branch — Interactive guide to switch to a branch worktree.
 *
 * Deterministic flow (no AI):
 *   1. Ask which branch to work on (or accept --worktree flag)
 *   2. If existing worktree:
 *      a. Stash uncommitted work in source (named stash)
 *      b. Ensure target is on the correct branch
 *      c. Apply source stash in target
 *   3. If new worktree:
 *      a. Stash uncommitted work in source
 *      b. Create worktree (git worktree add + npm install)
 *      c. Pull --rebase from origin
 *      d. Apply source stash in target
 *   4. Confirm to user
 *
 * Also available as post-setup prompt in setup.js.
 *
 * Usage:
 *   npx hypercanvas branch                    # interactive
 *   npx hypercanvas branch <name>             # positional, skip prompt
 *   npx hypercanvas branch --worktree=<name>  # non-interactive flag
 */
export declare function runBranchGuide(branchArg?: string): Promise<string | undefined>;
