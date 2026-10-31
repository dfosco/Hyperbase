export type CanvasEventFields = Record<string, unknown>;
export type CanvasCreatedEvent = CanvasEventFields & {
    event: 'canvas_created';
};
export type WidgetAddedEvent = CanvasEventFields & {
    event: 'widget_added';
    widget: CanvasEventFields & {
        id: string;
    };
};
export type WidgetUpdatedEvent = CanvasEventFields & {
    event: 'widget_updated';
    widgetId: string;
    props: CanvasEventFields;
};
export type WidgetMovedEvent = CanvasEventFields & {
    event: 'widget_moved';
    widgetId: string;
    position: CanvasEventFields;
};
export type WidgetRemovedEvent = CanvasEventFields & {
    event: 'widget_removed';
    widgetId?: string;
    widget?: CanvasEventFields;
};
export type SettingsUpdatedEvent = CanvasEventFields & {
    event: 'settings_updated';
    settings: CanvasEventFields;
};
export type SourceUpdatedEvent = CanvasEventFields & {
    event: 'source_updated';
    sources: unknown[];
};
export type CanvasWidgetRecord = CanvasEventFields & {
    id: string;
};
export type CanvasConnectorRecord = CanvasEventFields & {
    id: string;
    start: CanvasEventFields & {
        widgetId: string;
    };
    end: CanvasEventFields & {
        widgetId: string;
    };
};
export type WidgetsReplacedEvent = CanvasEventFields & {
    event: 'widgets_replaced';
    widgets: CanvasWidgetRecord[];
};
export type ConnectorAddedEvent = CanvasEventFields & {
    event: 'connector_added';
    connector: CanvasConnectorRecord;
};
export type ConnectorRemovedEvent = CanvasEventFields & {
    event: 'connector_removed';
    connectorId?: string;
    connector?: CanvasEventFields;
};
export type ConnectorsReplacedEvent = CanvasEventFields & {
    event: 'connectors_replaced';
    connectors?: CanvasConnectorRecord[] | null;
};
export type ConnectorWaypointsSetEvent = CanvasEventFields & {
    event: 'connector_waypoints_set';
    connectorId: string;
    waypoints?: unknown;
};
export type ConnectorWaypointsClearedEvent = CanvasEventFields & {
    event: 'connector_waypoints_cleared';
    connectorId: string;
};
export type ConnectorUpdatedEvent = CanvasEventFields & {
    event: 'connector_updated';
    connectorId: string;
    updates?: CanvasEventFields | null;
};
export type CanvasLayoutGeometry = {
    id: string;
    position: {
        x: number;
        y: number;
    };
    width: number;
    height: number;
};
export type CanvasSourceGeometry = {
    export: string;
    position: {
        x: number;
        y: number;
    };
    width: number;
    height: number;
};
export type CanvasScrollAxis = 'both' | 'vertical' | 'horizontal' | 'none';
export type CanvasLayoutUpdatedEvent = CanvasEventFields & {
    event: 'canvas_layout_updated';
    scroll: {
        axis: CanvasScrollAxis;
    };
    widgets: CanvasLayoutGeometry[];
    sources: CanvasSourceGeometry[];
};
export type LegacyLayoutItem = CanvasEventFields & {
    key?: string;
    id?: string;
    export?: string;
};
export type LegacyLayoutSnapshot = {
    widgets: LegacyLayoutItem[];
    sources: LegacyLayoutItem[];
    scroll?: {
        axis: CanvasScrollAxis;
    };
};
export type LegacyCanvasLayoutUpdatedEvent = CanvasEventFields & {
    event: 'canvas_layout_updated';
    layout: LegacyLayoutSnapshot;
    prevLayout?: LegacyLayoutSnapshot;
};
export type CanvasLayoutFieldSnapshot = {
    present: false;
} | {
    present: true;
    value: unknown;
};
export type CanvasLayoutSourceSnapshot = {
    present: false;
} | {
    present: true;
    position: CanvasLayoutFieldSnapshot;
    width: CanvasLayoutFieldSnapshot;
    height: CanvasLayoutFieldSnapshot;
} | {
    present: true;
    index: number;
    record: CanvasEventFields;
};
export type CanvasLayoutRestorationEvent = CanvasEventFields & {
    event: 'canvas_layout_restored';
    required: true;
    action: 'undo' | 'redo';
    snapshot: {
        axis: {
            expected: CanvasScrollAxis;
            restore: CanvasScrollAxis;
        };
        widgets: Array<{
            id: string;
            expected: {
                position: CanvasLayoutFieldSnapshot;
                width: CanvasLayoutFieldSnapshot;
                height: CanvasLayoutFieldSnapshot;
                propsContainer: 'absent' | 'null' | 'object';
            };
            restore: {
                position: CanvasLayoutFieldSnapshot;
                width: CanvasLayoutFieldSnapshot;
                height: CanvasLayoutFieldSnapshot;
                propsContainer: 'absent' | 'null' | 'object';
            };
        }>;
        sources: Array<{
            export: string;
            expected: CanvasLayoutSourceSnapshot;
            restore: CanvasLayoutSourceSnapshot;
        }>;
        sourcesContainer: {
            expected: 'absent' | 'null' | 'array';
            restore: 'absent' | 'null' | 'array';
        };
    };
};
export type DecodedCanvasEvent = CanvasCreatedEvent | WidgetAddedEvent | WidgetUpdatedEvent | WidgetMovedEvent | WidgetRemovedEvent | SettingsUpdatedEvent | SourceUpdatedEvent | WidgetsReplacedEvent | ConnectorAddedEvent | ConnectorRemovedEvent | ConnectorsReplacedEvent | ConnectorWaypointsSetEvent | ConnectorWaypointsClearedEvent | ConnectorUpdatedEvent | CanvasLayoutUpdatedEvent | LegacyCanvasLayoutUpdatedEvent | CanvasLayoutRestorationEvent;
/** Default version used by legacy writers. New layout semantics require v2. */
export declare const CANVAS_FORMAT_VERSION = 1;
export declare const CANVAS_FORMAT_VERSION_WITH_LAYOUT = 2;
export declare const SUPPORTED_CANVAS_FORMAT_VERSIONS: readonly [1, 2];
/** Nested transactions and flat v2 geometry must never share a decoder path. */
export declare function isLegacyCanvasLayoutEvent(value: CanvasEventFields): boolean;
export declare function isKnownCanvasEventName(eventName: string): boolean;
/**
 * Validate a parsed JSON value as a canvas event. This intentionally validates
 * only fields required by the reducer; widget props, connector metadata, and
 * event metadata remain extensible.
 *
 * @param {unknown} value
 * @returns {DecodedCanvasEvent | null}
 */
export declare function decodeCanvasEvent(value: unknown): DecodedCanvasEvent | null;
/** @param {unknown[]} values @returns {DecodedCanvasEvent[]} */
export declare function decodeCanvasEvents(values: unknown[]): DecodedCanvasEvent[];
/**
 * Verify format markers and required semantics. Unversioned streams retain
 * the permissive legacy decoder. Layout events require a v2 header.
 *
 * @param {unknown[]} values
 */
export declare function assertSupportedCanvasFormat(values: unknown[]): void;
/** Return the explicit header version, or undefined for an unversioned legacy stream. */
export declare function getCanvasFormatVersion(values: unknown[]): number | undefined;
/** @param {unknown} event */
export declare function assertSerializableCanvasEvent(event: unknown): asserts event is Record<string, unknown>;
