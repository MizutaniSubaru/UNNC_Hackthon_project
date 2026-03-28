'use client';

import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef } from 'react';

type MotionButtonPreset = 'default' | 'subtle' | 'card' | 'overlay';

export type MotionButtonProps = HTMLMotionProps<'button'> & {
    motionPreset?: MotionButtonPreset;
};

type MotionPresetState = {
    hover: NonNullable<HTMLMotionProps<'button'>['whileHover']>;
    tap: NonNullable<HTMLMotionProps<'button'>['whileTap']>;
};

const MOTION_PRESETS: Record<MotionButtonPreset, MotionPresetState> = {
    card: {
        hover: { scale: 1.008, y: -0.8 },
        tap: { scale: 0.99, y: 0 },
    },
    default: {
        hover: { scale: 1.015, y: -1.2 },
        tap: { scale: 0.975, y: 0.2 },
    },
    overlay: {
        hover: { opacity: 1 },
        tap: { opacity: 0.94 },
    },
    subtle: {
        hover: { scale: 1.008, y: -0.8 },
        tap: { scale: 0.985, y: 0.1 },
    },
};

const DEFAULT_TRANSITION: HTMLMotionProps<'button'>['transition'] = {
    damping: 28,
    mass: 0.8,
    stiffness: 410,
    type: 'spring',
};

function isAriaDisabled(value: HTMLMotionProps<'button'>['aria-disabled']) {
    return value === true || value === 'true';
}

export const MotionButton = forwardRef<HTMLButtonElement, MotionButtonProps>(
    function MotionButton(
        {
            motionPreset = 'default',
            transition,
            whileHover,
            whileTap,
            ...props
        },
        ref
    ) {
        const reducedMotion = useReducedMotion();
        const interactive =
            !reducedMotion &&
            !props.disabled &&
            !isAriaDisabled(props['aria-disabled']);

        const preset = MOTION_PRESETS[motionPreset];

        return (
            <motion.button
                ref={ref}
                transition={transition ?? DEFAULT_TRANSITION}
                whileHover={interactive ? whileHover ?? preset.hover : undefined}
                whileTap={interactive ? whileTap ?? preset.tap : undefined}
                {...props}
            />
        );
    }
);
