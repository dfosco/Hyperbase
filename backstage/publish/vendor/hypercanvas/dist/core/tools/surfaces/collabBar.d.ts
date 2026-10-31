/**
 * Collab Bar surface — floating bar at top-right on canvas pages.
 *
 * Hosts collaboration / agent affordances (e.g. "Agents ready" jump button).
 * Other tools can register here purely via toolbar.config.json.
 */
export declare const id = "collab-bar";
export declare const label = "Collab Bar";
export declare const position = "top-right";
export declare const renderTypes: readonly ["button", "menu"];
