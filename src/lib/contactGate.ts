/**
 * Finger-contact & brightness gate for the PPG camera.
 * Pure logic: no DOM, no React, no side effects (unit-testable).
 */

export const RED_MIN = 120; // mean red channel must exceed this
export const RG_RATIO_MIN = 1.4; // red dominance over green+blue (fingertip absorbs G/B)
export const LUMA_FLOOR = 60; // overall brightness floor (0.299R + 0.587G + 0.114B)
export const GATE_FAIL_FRAMES = 10; // ~0.5 s of consecutive failures at 30 fps before "no contact"

export interface RgbMean {
    r: number;
    g: number;
    b: number;
}

export function computeLuma(rgb: RgbMean): number {
    return 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
}

/** Contact is valid when: R > 120 && R / max(1, G+B) > 1.4 && meanLuma > LUMA_FLOOR */
export function passesContactThresholds(rgb: RgbMean): boolean {
    const dominance = rgb.r / Math.max(1, rgb.g + rgb.b);
    return rgb.r > RED_MIN && dominance > RG_RATIO_MIN && computeLuma(rgb) > LUMA_FLOOR;
}

export interface GateUpdate {
    isContact: boolean;
    justGained: boolean;
    justLost: boolean;
}

export interface ContactGate {
    readonly isContact: boolean;
    update(rgb: RgbMean): GateUpdate;
    reset(): void;
}

/**
 * Stateful tracker (owned by the hook in a useRef — never React state).
 * Debounce: the FAIL condition must hold on >= GATE_FAIL_FRAMES consecutive
 * frames before contact is declared lost, so pressure flicker doesn't toggle the gate.
 * A single passing frame re-establishes contact.
 */
export function createContactGate(): ContactGate {
    let contact = false;
    let consecutiveFails = 0;
    return {
        get isContact(): boolean {
            return contact;
        },
        update(rgb: RgbMean): GateUpdate {
            if (passesContactThresholds(rgb)) {
                consecutiveFails = 0;
                if (!contact) {
                    contact = true;
                    return { isContact: true, justGained: true, justLost: false };
                }
                return { isContact: true, justGained: false, justLost: false };
            }
            consecutiveFails += 1;
            if (contact && consecutiveFails >= GATE_FAIL_FRAMES) {
                contact = false;
                return { isContact: false, justGained: false, justLost: true };
            }
            return { isContact: contact, justGained: false, justLost: false };
        },
        reset(): void {
            contact = false;
            consecutiveFails = 0;
        },
    };
}