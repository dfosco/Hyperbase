import type { ComponentType } from 'react';
export interface WorkshopOverlayProps {
    onClose: () => void;
}
export interface WorkshopFeatureModule {
    name: string;
    label: string;
    icon: string;
    overlayId: string;
    overlay: ComponentType<WorkshopOverlayProps>;
}
