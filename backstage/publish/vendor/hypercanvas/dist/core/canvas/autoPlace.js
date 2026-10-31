import { AUTO_PLACE_DEFAULTS } from '../stores/canvasConfig.js';
const EPSILON = 1e-7;
function optionsWithDefaults(value) {
    return {
        top: value?.align?.['top-edge-nudge-offset'] ?? value?.['top-edge-nudge-offset'] ?? AUTO_PLACE_DEFAULTS.align['top-edge-nudge-offset'],
        left: value?.align?.['left-edge-nudge-offset'] ?? value?.['left-edge-nudge-offset'] ?? AUTO_PLACE_DEFAULTS.align['left-edge-nudge-offset'],
        trigger: value?.overlap?.['overlap-nudge-trigger'] ?? value?.['overlap-nudge-trigger'] ?? AUTO_PLACE_DEFAULTS.overlap['overlap-nudge-trigger'],
        gap: value?.overlap?.['overlap-nudge-offset'] ?? value?.['overlap-nudge-offset'] ?? AUTO_PLACE_DEFAULTS.overlap['overlap-nudge-offset'],
        stationary: value?.overlap?.['overlap-place-stationary'] ?? value?.['overlap-place-stationary'] ?? AUTO_PLACE_DEFAULTS.overlap['overlap-place-stationary'],
        multiselection: value?.overlap?.['overlap-place-multiselection'] ?? value?.['overlap-place-multiselection'] ?? AUTO_PLACE_DEFAULTS.overlap['overlap-place-multiselection'],
    };
}
function intersects(a, b, gap = 0) {
    return a.x < b.x + b.width + gap - EPSILON && a.x + a.width > b.x - gap + EPSILON &&
        a.y < b.y + b.height + gap - EPSILON && a.y + a.height > b.y - gap + EPSILON;
}
function translate(rects, { x, y }) {
    return rects.map((rect) => ({ ...rect, x: rect.x + x, y: rect.y + y }));
}
/** Find the closest integer outside the union of inclusive integer intervals. */
function nearestFreeY(intervals, minimum) {
    const preferred = Math.max(0, minimum);
    intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let start = null;
    let end = 0;
    for (let index = 0; index <= intervals.length; index++) {
        const interval = intervals[index];
        if (start !== null && (!interval || interval[0] > end + 1)) {
            if (preferred >= start && preferred <= end) {
                const before = start - 1;
                const after = end + 1;
                return before >= minimum && Math.abs(before) < Math.abs(after) ? before : after;
            }
            if (preferred < start)
                return preferred;
            start = null;
            end = 0;
        }
        if (interval) {
            end = start === null ? interval[1] : Math.max(end, interval[1]);
            start = start === null ? interval[0] : start;
        }
    }
    return preferred;
}
/**
 * Each rectangle pair forbids a rectangle in translation space. The nearest
 * free translation lies at x=0 or one of its vertical edges. Sweep those finite
 * candidates and solve their forbidden y intervals, rather than retrying moves.
 * Actual widget rectangles keep empty space inside a selection available.
 */
function nearestFreeTranslation(rects, blockers, gap, boundaryPad) {
    const minimumX = Math.ceil(boundaryPad - Math.min(...rects.map((rect) => rect.x)));
    const minimumY = Math.ceil(boundaryPad - Math.min(...rects.map((rect) => rect.y)));
    if (minimumX <= 0 && minimumY <= 0 && !rects.some((rect) => blockers.some((blocker) => intersects(rect, blocker, gap)))) {
        return { x: 0, y: 0 };
    }
    const candidates = new Set([Math.max(0, minimumX)]);
    for (const rect of rects) {
        for (const blocker of blockers) {
            const before = Math.floor(blocker.x - gap - rect.x - rect.width + EPSILON);
            const after = Math.ceil(blocker.x + blocker.width + gap - rect.x - EPSILON);
            if (before >= minimumX)
                candidates.add(before);
            if (after >= minimumX)
                candidates.add(after);
        }
    }
    let best = null;
    let bestDistance = Infinity;
    for (const x of candidates) {
        const intervals = [];
        for (const rect of rects) {
            for (const blocker of blockers) {
                if (rect.x + x >= blocker.x + blocker.width + gap - EPSILON ||
                    rect.x + rect.width + x <= blocker.x - gap + EPSILON)
                    continue;
                const start = Math.floor(blocker.y - gap - rect.y - rect.height + EPSILON) + 1;
                const end = Math.ceil(blocker.y + blocker.height + gap - rect.y - EPSILON) - 1;
                if (start <= end)
                    intervals.push([start, end]);
            }
        }
        const y = nearestFreeY(intervals, minimumY);
        const distance = x * x + y * y;
        if (distance < bestDistance || (distance === bestDistance && Math.abs(y) < Math.abs(best?.y ?? 0))) {
            best = { x, y };
            bestDistance = distance;
        }
    }
    return best;
}
function alignmentForPeers(rects, peers, ranges, boundaryPad) {
    const inRangeIds = new Set();
    const adjustment = { x: 0, y: 0 };
    const nearest = { x: Infinity, y: Infinity };
    const minimumX = boundaryPad - Math.min(...rects.map((rect) => rect.x));
    const minimumY = boundaryPad - Math.min(...rects.map((rect) => rect.y));
    for (const rect of rects) {
        for (const peer of peers) {
            if (intersects(rect, peer))
                inRangeIds.add(peer.id);
            const gapX = Math.max(0, peer.x - rect.x - rect.width, rect.x - peer.x - peer.width);
            const gapY = Math.max(0, peer.y - rect.y - rect.height, rect.y - peer.y - peer.height);
            if (gapX > Math.max(ranges.left, ranges.trigger) || gapY > Math.max(ranges.top, ranges.trigger))
                continue;
            const axes = [
                ['x', 'width', ranges.left, minimumX],
                ['y', 'height', ranges.top, minimumY],
            ];
            for (const [axis, size, range, minimum] of axes) {
                if (range <= 0)
                    continue;
                for (const delta of [peer[axis] - rect[axis], peer[axis] + peer[size] - rect[axis] - rect[size]]) {
                    const rounded = Math.round(delta);
                    if (Math.abs(delta) > range || rounded < minimum)
                        continue;
                    inRangeIds.add(peer.id);
                    if (Math.abs(delta) < nearest[axis]) {
                        adjustment[axis] = rounded;
                        nearest[axis] = Math.abs(delta);
                    }
                }
            }
        }
    }
    return { adjustment, inRangeIds };
}
function adjacencyForPeers(rects, peers, ranges, gap, boundaryPad, inRangeIds) {
    let best = null;
    let distance = Infinity;
    if (ranges.trigger <= 0)
        return best;
    for (const rect of rects) {
        for (const peer of peers) {
            const axes = [
                ['x', 'y', 'width', 'height', ranges.top],
                ['y', 'x', 'height', 'width', ranges.left],
            ];
            for (const [axis, cross, size, crossSize, crossRange] of axes) {
                const crossOverlap = Math.min(rect[cross] + rect[crossSize], peer[cross] + peer[crossSize]) - Math.max(rect[cross], peer[cross]);
                if (crossOverlap <= 0)
                    continue;
                const crossDeltas = [peer[cross] - rect[cross], peer[cross] + peer[crossSize] - rect[cross] - rect[crossSize]];
                const crossDelta = crossDeltas.reduce((a, b) => Math.abs(a) <= Math.abs(b) ? a : b);
                if (Math.abs(crossDelta) > crossRange)
                    continue;
                for (const side of [-1, 1]) {
                    const edgeGap = side === 1
                        ? rect[axis] - peer[axis] - peer[size]
                        : peer[axis] - rect[axis] - rect[size];
                    // Actual intersections always use collision resolution, regardless
                    // of the proximity trigger or how deeply the widgets overlap.
                    if (edgeGap < 0 || edgeGap > ranges.trigger)
                        continue;
                    const next = {
                        x: 0,
                        y: 0,
                        [axis]: Math.round(side === 1 ? peer[axis] + peer[size] + gap - rect[axis] : peer[axis] - rect[size] - gap - rect[axis]),
                        [cross]: Math.round(crossDelta),
                    };
                    if (rects.some((item) => item.x + next.x < boundaryPad || item.y + next.y < boundaryPad))
                        continue;
                    inRangeIds.add(peer.id);
                    const nextDistance = Math.hypot(next.x, next.y);
                    if (nextDistance < distance) {
                        best = { adjustment: next, peerId: peer.id };
                        distance = nextDistance;
                    }
                }
            }
        }
    }
    return best;
}
function clearInternalOverlaps(rects, gap, boundaryPad, primaryId) {
    const ordered = [...rects].sort((a, b) => Number(b.id === primaryId) - Number(a.id === primaryId));
    const placed = [];
    for (const rect of ordered) {
        const adjustment = placed.some((peer) => intersects(rect, peer))
            ? nearestFreeTranslation([rect], placed, gap, boundaryPad)
            : { x: 0, y: 0 };
        placed.push(...translate([rect], adjustment));
    }
    return placed;
}
function placeStationary(rects, peers, adjacency, gap, boundaryPad, protectedPeers = []) {
    const fixed = [...rects, ...protectedPeers];
    const queued = new Set();
    const queue = [];
    const placements = new Map();
    const enqueue = (peer) => {
        if (!queued.has(peer.id)) {
            queued.add(peer.id);
            queue.push(peer);
        }
    };
    for (const peer of peers) {
        if (rects.some((rect) => intersects(rect, peer)) || peer.id === adjacency?.peerId)
            enqueue(peer);
    }
    for (let index = 0; index < queue.length; index++) {
        const peer = queue[index];
        const preferred = peer.id === adjacency?.peerId
            ? { ...peer, x: Math.round(peer.x - adjacency.adjustment.x), y: Math.round(peer.y - adjacency.adjustment.y) }
            : { ...peer, x: Math.round(peer.x), y: Math.round(peer.y) };
        const placed = translate([preferred], nearestFreeTranslation([preferred], fixed, gap, boundaryPad))[0];
        fixed.push(placed);
        if (placed.x !== peer.x || placed.y !== peer.y) {
            placements.set(peer.id, { x: placed.x, y: placed.y });
            for (const other of peers) {
                if (other.id !== peer.id && intersects(placed, other, gap))
                    enqueue(other);
            }
        }
    }
    return placements;
}
/** Shared geometry for drop nudges and live nudge/overlap feedback. */
export function getAutoPlacePreview({ moving, stationary, primaryId, primaryPosition, zoom = 100, align = true, nudgeOffsets = AUTO_PLACE_DEFAULTS, boundaryPad = 0, preserveMovingOffsets = false, fixedStationaryIds = [], movingPriority = false }) {
    const primary = moving.find((item) => item.id === primaryId);
    if (!primary)
        return { placements: new Map(), inRangeIds: new Set() };
    const minimumX = boundaryPad - Math.min(...moving.map((item) => item.position.x));
    const minimumY = boundaryPad - Math.min(...moving.map((item) => item.position.y));
    let dx = Math.max(primaryPosition.x - primary.position.x, minimumX);
    let dy = Math.max(primaryPosition.y - primary.position.y, minimumY);
    if (preserveMovingOffsets) {
        // Round one common translation, so even fractional saved offsets stay rigid.
        dx = Math.max(Math.round(dx), Math.ceil(minimumX));
        dy = Math.max(Math.round(dy), Math.ceil(minimumY));
    }
    let rects = moving.map((item) => ({
        ...item,
        x: preserveMovingOffsets ? item.position.x + dx : Math.round(item.position.x + dx),
        y: preserveMovingOffsets ? item.position.y + dy : Math.round(item.position.y + dy),
    }));
    const movingIds = new Set(moving.map((item) => item.id));
    const peers = stationary.filter((peer) => !movingIds.has(peer.id));
    const config = optionsWithDefaults(nudgeOffsets);
    const scale = Math.max(0.1, zoom / 100);
    const ranges = { top: config.top / scale, left: config.left / scale, trigger: config.trigger / scale };
    const { adjustment, inRangeIds } = align
        ? alignmentForPeers(rects, peers, ranges, boundaryPad)
        : { adjustment: { x: 0, y: 0 }, inRangeIds: new Set() };
    // Add adjacency hints at the user's current position, before any nudges.
    if (align)
        adjacencyForPeers(rects, peers, ranges, config.gap, boundaryPad, inRangeIds);
    rects = translate(rects, adjustment);
    let stationaryPlacements = new Map();
    if (align && (moving.length === 1 || config.multiselection || movingPriority)) {
        if (!preserveMovingOffsets)
            rects = clearInternalOverlaps(rects, config.gap, boundaryPad, primaryId);
        const adjacency = adjacencyForPeers(rects, peers, ranges, config.gap, boundaryPad, new Set());
        // Direct user drops have an explicit moving-first contract. Older
        // stationary/multiselection settings still govern creation and other
        // placement callers, but must not make a dragged widget yield its target.
        if (movingPriority || config.stationary) {
            const protectedIds = new Set(fixedStationaryIds);
            const protectedPeers = peers.filter((peer) => protectedIds.has(peer.id));
            if (rects.some((rect) => protectedPeers.some((peer) => intersects(rect, peer)))) {
                rects = translate(rects, nearestFreeTranslation(rects, protectedPeers, config.gap, boundaryPad));
            }
            // Keep the established proximity snap when the requested drop itself is
            // clear. A real collision is different: moving-priority drops keep that
            // requested position and make the stationary peers yield.
            const hasCollision = rects.some((rect) => peers.some((peer) => intersects(rect, peer)));
            if (movingPriority && !hasCollision && adjacency)
                rects = translate(rects, adjacency.adjustment);
            const resolvedAdjacency = adjacencyForPeers(rects, peers, ranges, config.gap, boundaryPad, new Set());
            stationaryPlacements = placeStationary(rects, peers.filter((peer) => !protectedIds.has(peer.id)), resolvedAdjacency, config.gap, boundaryPad, protectedPeers);
        }
        else if (adjacency || rects.some((rect) => peers.some((peer) => intersects(rect, peer)))) {
            if (adjacency)
                rects = translate(rects, adjacency.adjustment);
            rects = translate(rects, nearestFreeTranslation(rects, peers, config.gap, boundaryPad));
        }
    }
    const placements = new Map(rects.map((rect) => [rect.id, { x: rect.x, y: rect.y }]));
    for (const [id, position] of stationaryPlacements)
        placements.set(id, position);
    return { placements, inRangeIds };
}
export function resolveAutoPlaceDrop(options) {
    return getAutoPlacePreview(options).placements;
}
/** Prefer the current setting while continuing to read canvases saved before Auto place existed. */
export function isAutoPlaceEnabled(canvas) {
    return canvas?.autoPlace ?? canvas?.snapToGrid ?? false;
}
