export declare const id = "flows";
interface FlowContext {
    basePath?: string;
}
interface FlowMenuItem {
    id: string;
    label: string;
    type: 'radio';
    active: boolean;
    href: string;
    execute(): void;
}
export declare function handler(ctx?: FlowContext): Promise<{
    getChildren(): FlowMenuItem[];
}>;
export declare function component(): Promise<unknown>;
export {};
