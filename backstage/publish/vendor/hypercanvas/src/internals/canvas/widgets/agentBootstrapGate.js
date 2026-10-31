/** Gate interactive agent input only while native startup is in progress.
 * The pre-start CLI may need the same terminal for a coding-target choice,
 * so an unknown/null context must remain interactive.
 */
export function shouldGateAgentInput(isAgent, contextState, bypassed = false) {
  return Boolean(isAgent && !bypassed && contextState?.phase === 'starting')
}
