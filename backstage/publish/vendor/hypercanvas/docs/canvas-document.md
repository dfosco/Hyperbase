# Persisted canvas JSONL format

`canvas.schema.json` describes inputs for creating a canvas artifact. It does not describe a saved `.canvas.jsonl` document. A saved document is an ordered stream of event records. The public persisted-event schema is available at `@dfosco/hypercanvas/canvas/document.schema.json`; browser-neutral replay and validation are available at `@dfosco/hypercanvas/canvas/materializer`.

## Versions and playback

Legacy documents without a version marker and format v1 retain their existing replay rules. Missing `scroll.axis` means `both`. Format v1 supports the event records already recognized by its reader. Unknown optional events are ignored; fields on known event records and widget/source/connector records remain extensible.

Format v2 is required for compound layout events. Its first `canvas_created` event carries `formatVersion: 2`. A v1-only reader must reject that version before returning materialized state. An event with `required: true` that the reader does not understand is an incompatibility and prevents successful playback. Unknown events without that marker are optional and may be ignored.

Events replay in file order. Widget and source updates apply to the state produced by earlier records. `canvas_layout_updated` applies its axis and complete geometry snapshot as one state transition. The canonical state is `scroll.axis`, whose values are `both`, `vertical`, `horizontal`, and `none`. A legacy state defaults to `both`; an authoring unlock writes `both` and preserves row geometry.

## Compound layout event

```json
{
  "event": "canvas_layout_updated",
  "scroll": { "axis": "vertical" },
  "widgets": [
    { "id": "sticky-1", "position": { "x": 24, "y": 24 }, "width": 320, "height": 180 }
  ],
  "sources": [
    { "export": "PrimaryButtons", "position": { "x": 24, "y": 220 }, "width": 560, "height": 400 }
  ]
}
```

`widgets` covers every JSONL-backed widget exactly once. Geometry is written to fields consumed by the current renderer: `position` maps to `widget.position`; `width` and `height` map to `widget.props.width` and `widget.props.height`. The snapshot preserves widget props, ids, order, connectors and unknown fields.

`sources` carries JSX companion geometry. `position`, `width`, and `height` map to the current source record's fields. Replay merges those fields into the existing source record and preserves source metadata. An authoring writer may include a newly discovered export only after resolving it through the current canvas/module/importer binding. It must reject ambiguous or missing discovery and arbitrary export-name injection. This authoring check is not performed by browser-neutral playback, which has no module importer.

All widget and source geometry must have finite coordinates and finite positive dimensions. The snapshot must cover every current JSONL widget and every persisted source export; duplicate or missing entries invalidate the whole event. No part of an invalid layout event is applied. Events after the layout event continue in stream order.

## Layout undo and redo records

V2 also defines the distinct required event `canvas_layout_restored`. It restores the layout-owned subset of state after a `canvas_layout_updated` event. Existing `canvas_layout_updated` records keep their original forward semantics. Because restoration is a required new event, an older v2 reader rejects it as an unsupported required event. No v3 marker is needed.

`captureCanvasLayoutRestoration(state, layout)` is a browser-neutral typed helper exported from the materializer module. It takes the pre-layout materialized state and the forward layout event and returns an `action: "undo"` restoration event. `reverseCanvasLayoutRestoration(event)` swaps the expected and restore sides and changes `action` between `undo` and `redo`. Both events use this shape:

```json
{
  "event": "canvas_layout_restored",
  "required": true,
  "action": "undo",
  "snapshot": {
    "axis": { "expected": "vertical", "restore": "both" },
    "widgets": [{
      "id": "note-1",
      "expected": {
        "position": { "present": true, "value": { "x": 24, "y": 24 } },
        "width": { "present": true, "value": 300 },
        "height": { "present": true, "value": 160 },
        "propsContainer": "object"
      },
      "restore": {
        "position": { "present": true, "value": { "x": 800, "y": 600 } },
        "width": { "present": true, "value": 300 },
        "height": { "present": true, "value": 160 },
        "propsContainer": "object"
      }
    }],
    "sources": [],
    "sourcesContainer": { "expected": "array", "restore": "array" }
  }
}
```

A field snapshot is `{ "present": false }` or `{ "present": true, "value": ... }`; the `value` key is required when present is true, even if its value is null. This lets omitted position, width, and height fields remain omitted on restore. `propsContainer` records whether the widget originally had no `props`, `props: null`, or a props object, and both sides are swapped on every undo/redo reversal. The `expected.propsContainer` marker is descriptive restoration metadata; conflict checks use the expected position/width/height key presence and values. This allows unrelated props added after undo to survive redo while still guarding geometry. Restoring geometry preserves unrelated props added later; when the restored geometry leaves no props keys, the original absent/null/object form is restored. Existing source snapshots include only position, width, and height key snapshots, so later source metadata edits survive. A source record first introduced by the layout instead carries its exact generated record and array index on the present side. Undo removes it only while the full record still matches; redo reinserts it at the recorded index while retaining unrelated source additions. `sourcesContainer.expected` and `.restore` each record `absent`, `null`, or `array`, allowing redo after undo restores the original container form.

Restoration checks the expected axis, geometry keys, and source membership before constructing a new state. A stale axis/geometry value, missing expected source, or changed layout-created source record fails before any state is returned. The strict decoder also requires each embedded source record's `export` to match its enclosing source entry; JSON Schema validates each record's shape but does not express that cross-field identity rule. Unrelated widget props, content, widgets, source metadata, and source additions are retained. The event does not replace widget/source records wholesale and does not implement an undo stack or persistence. E remains responsible for recording and reloading undo/redo events.

## Strict validation and tolerant playback

Playback preserves tolerant legacy JSONL handling for existing documents. Authors can run strict validation before writing or publishing:

```js
import { materializeFromText, validateCanvasJsonl } from '@dfosco/hypercanvas/canvas/materializer'

const diagnostics = validateCanvasJsonl(sourceText)
if (diagnostics.length) throw new Error(JSON.stringify(diagnostics))
const canvas = materializeFromText(sourceText)
```

Diagnostics include a code, one-based line, optional event name, and message. They identify malformed JSON, missing headers, malformed known events, unsupported versions, incomplete layouts, and unknown required events. `materialize` and `materializeFromText` are pure and do not require a Core server or filesystem access.

The exported JSON Schema validates individual records. It accepts unknown optional records and rejects unknown records marked `required: true`, matching the strict validator's capability policy. It does not validate JSONL ordering or cross-record constraints; `validateCanvasJsonl` checks those, including duplicate canvas headers and complete layout snapshots. For authoring, `widget_moved.position` must contain finite numeric `x` and `y`. Legacy playback remains tolerant of partial position objects because older streams are decoded as extensible records and replayed as stored. Schema and strict authoring validation therefore agree on the declared authoring shape while playback retains its legacy tolerance.

## Compaction and history

Compaction writes one `canvas_created` event containing the materialized state and preserves an explicit format marker, `scroll.axis`, widgets, connectors, sources, and their extensions. It may discard the prior event sequence and optional unknown events. This playback contract does not implement undo or establish authoring history guarantees. An authoring implementation that promises atomic undo/reload must preserve and verify those guarantees independently.

## Portable subset and fixtures

The shared reference is [`src/canvas/button-patterns.canvas.jsonl`](../../../src/canvas/button-patterns.canvas.jsonl). Its supported data subset contains sticky-note, Markdown, and prototype Frame widgets, plus the `PrimaryButtons` and `DangerButtons` JSX exports listed in `sources`. The source document remains the complete reference; normalized fixtures under `packages/storyboard/test/fixtures/canvas-document/` isolate protocol cases for deterministic browser-neutral tests.

Widget types and route/resource strings are portable data references. This document does not promise that a consumer can execute an agent, terminal, server, or arbitrary widget implementation. Consumers declare the widget/resource capabilities they implement and report unsupported required semantics explicitly.
