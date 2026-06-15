import { CollisionDetection, closestCorners } from '@dnd-kit/core';

/**
 * A custom collision detection strategy optimized for a single-row horizontal list of slide cards.
 * Instead of calculating intersection area (which can trigger feedback loops when elements shift),
 * this strategy calculates the distance between the pointer's X coordinate and the horizontal center
 * of each slide's bounding rectangle.
 *
 * For drag items coming from the library (e.g. 'presentation-item-drag'), it falls back to standard
 * closestCorners to allow dropping onto the background droppable zone.
 */
export const horizontalCollisionDetection: CollisionDetection = (args) => {
    const { active, droppableContainers, pointerCoordinates } = args;

    // Fall back to closestCorners for non-sorting actions (dragging a new item onto the timeline)
    if (active.id === 'presentation-item-drag') {
        return closestCorners(args);
    }

    if (!pointerCoordinates) return [];
    const pointerX = pointerCoordinates.x;

    // Filter to slide containers only (exclude the background droppable zone and library drag handles)
    const slideContainers = droppableContainers.filter(
        (container) =>
            !container.disabled &&
            container.id !== 'timeline-droppable' &&
            container.id !== 'presentation-item-drag'
    );

    if (slideContainers.length === 0) return [];

    const collisions = slideContainers
        .map((container) => {
            const rect = container.rect.current;
            if (!rect) return null;

            const centerX = rect.left + rect.width / 2;
            const distance = Math.abs(pointerX - centerX);

            return {
                id: container.id,
                data: {
                    droppableContainer: container,
                    value: distance,
                },
            };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null);

    // Sort by distance (closest center first)
    collisions.sort((a, b) => a.data.value - b.data.value);

    return collisions;
};
