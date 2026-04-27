import React, { useEffect, useState } from 'react';
import { isOnboardingCompleted, markOnboardingCompleted } from '../lib/onboarding-storage';

export interface OnboardingTourProps {
    /**
     * Force the tour open. By default it shows automatically on first visit
     * (driven by localStorage) and stays hidden afterwards. Setting this to
     * true lets the consumer's "?" button reopen it any time.
     */
    open?: boolean;
    /** Called when the user completes or dismisses the tour. */
    onClose?: () => void;
}

interface Step {
    title: string;
    body: string;
    shortcut?: string;
}

/**
 * Excalidraw-style guided tour. Shown on first visit; consumer can reopen
 * via the help button (BottomControls.onHelpClick → set open=true). Single
 * modal-style overlay with prev/next navigation and step indicators.
 */
const STEPS: Step[] = [
    {
        title: 'Welcome to your whiteboard',
        body: 'Pick a tool from the floating bar at the top. Each tool has a single-letter keyboard shortcut shown in its tooltip.',
        shortcut: 'V R D O A L P T I',
    },
    {
        title: 'Draw a shape',
        body: 'Press R for rectangle, then click and drag on the canvas. Hold Shift to constrain to a perfect square.',
        shortcut: 'R + drag',
    },
    {
        title: 'Edit properties',
        body: 'Press V to switch to Select, then click a shape. The properties panel on the left lets you change color, fill style, stroke width, and sloppiness.',
        shortcut: 'V → click',
    },
    {
        title: 'Sketchy or clean?',
        body: 'Use the Sloppiness control to switch between Architect (perfectly clean lines), Artist (default hand-drawn), and Cartoonist (very wobbly).',
    },
    {
        title: 'Saves automatically',
        body: 'Every change is saved as you draw. Refresh the page anytime — your board persists. Other people viewing the same board see your edits in real time.',
    },
];

export function OnboardingTour({ open: openProp, onClose }: OnboardingTourProps) {
    const [openInternal, setOpenInternal] = useState<boolean>(false);
    const [step, setStep] = useState(0);
    // First-mount: open if not yet completed AND consumer didn't override.
    useEffect(() => {
        if (openProp === undefined && !isOnboardingCompleted()) {
            setOpenInternal(true);
        }
    }, [openProp]);

    const open = openProp ?? openInternal;
    const finish = () => {
        markOnboardingCompleted();
        setOpenInternal(false);
        onClose?.();
        setStep(0);
    };

    if (!open) return null;
    const current = STEPS[step];
    const isLast = step === STEPS.length - 1;

    return (
        <div
            className="bk-onboarding-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Whiteboard tour"
            onClick={(e) => {
                // Click on the dim backdrop dismisses; click on the dialog body doesn't.
                if (e.target === e.currentTarget) finish();
            }}
        >
            <div className="bk-onboarding-dialog">
                <h2 className="bk-onboarding-title">{current.title}</h2>
                <p className="bk-onboarding-body">{current.body}</p>
                {current.shortcut && (
                    <p className="bk-onboarding-shortcut">{current.shortcut}</p>
                )}
                <div className="bk-onboarding-dots" role="tablist">
                    {STEPS.map((_, i) => (
                        <span
                            key={i}
                            className="bk-onboarding-dot"
                            data-active={i === step}
                            aria-label={`Step ${i + 1}`}
                        />
                    ))}
                </div>
                <div className="bk-onboarding-actions">
                    <button
                        type="button"
                        className="bk-control-btn"
                        onClick={finish}
                    >
                        Skip
                    </button>
                    {step > 0 && (
                        <button
                            type="button"
                            className="bk-control-btn"
                            onClick={() => setStep((s) => s - 1)}
                        >
                            Back
                        </button>
                    )}
                    <button
                        type="button"
                        className="bk-control-btn"
                        data-selected="true"
                        onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
                    >
                        {isLast ? 'Get started' : 'Next'}
                    </button>
                </div>
            </div>
        </div>
    );
}
