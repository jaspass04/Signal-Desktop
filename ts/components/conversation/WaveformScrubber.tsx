// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
 
import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useRefMerger } from '../../hooks/useRefMerger';
import type { LocalizerType } from '../../types/Util';
import { durationToPlaybackText } from '../../util/durationToPlaybackText';
import { Waveform } from './Waveform';
import { arrow } from '../../util/keyboard';
 
type Props = Readonly<{
  i18n: LocalizerType;
  peaks: ReadonlyArray<number>;
  currentTime: number;
  duration: number | undefined;
  barMinHeight: number;
  barMaxHeight: number;
  onClick: (positionAsRatio: number) => void;
  onScrub: (positionAsRatio: number) => void;
}>;
 
const BAR_COUNT = 47;
const REWIND_BAR_COUNT = 2;
 
const SMALL_INCREMENT = 1;
const BIG_INCREMENT = 5;
 
export const WaveformScrubber = React.forwardRef(function WaveformScrubber(
  {
    i18n,
    peaks,
    barMinHeight,
    barMaxHeight,
    currentTime,
    duration,
    onClick,
    onScrub,
  }: Props,
  ref
): JSX.Element {
  console.log('[WaveformScrubber] Mounted'); // 👈 shows if the component is being used
 
  const refMerger = useRefMerger();
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
 
  const getProgressFromEvent = (e: MouseEvent | React.MouseEvent): number => {
    if (!waveformRef.current || !duration) return 0;
 
    const rect = waveformRef.current.getBoundingClientRect();
    const x = 'clientX' in e ? e.clientX : 0;
    let progress = (x - rect.left) / rect.width;
    if (progress <= REWIND_BAR_COUNT / BAR_COUNT) {
      progress = 0;
    }
    return Math.max(0, Math.min(1, progress));
  };
 
  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
 
      const progress = getProgressFromEvent(event);
      console.log(`[WaveformScrubber] Clicked: progress = ${progress.toFixed(3)}`);
      onClick(progress);
    },
    [onClick]
  );
 
  const handleMouseDown = (event: React.MouseEvent) => {
    console.log('[WaveformScrubber] handleMouseDown triggered'); // 👈 added
    setIsDragging(true);
    const progress = getProgressFromEvent(event);
    console.log(`[WaveformScrubber] Drag started: progress = ${progress.toFixed(3)}`);
    onScrub(progress);
    console.log('[WaveformScrubber] onScrub fired with:', progress);
  };
 
  useEffect(() => {
    console.log('[WaveformScrubber] useEffect mounted'); // 👈 shows when drag listeners are active
 
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const progress = getProgressFromEvent(e);
      console.log(`[WaveformScrubber] Dragging: progress = ${progress.toFixed(3)}`);
      onScrub(progress);
    };
 
    const handleMouseUp = () => {
      if (isDragging) {
        console.log('[WaveformScrubber] Drag ended');
        setIsDragging(false);
      }
    };
 
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onScrub]);
 
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!duration) return;
 
    let increment: number;
 
    if (event.key === 'ArrowUp' || event.key === arrow('end')) {
      increment = +SMALL_INCREMENT;
    } else if (event.key === 'ArrowDown' || event.key === arrow('start')) {
      increment = -SMALL_INCREMENT;
    } else if (event.key === 'PageUp') {
      increment = +BIG_INCREMENT;
    } else if (event.key === 'PageDown') {
      increment = -BIG_INCREMENT;
    } else {
      return;
    }
 
    event.preventDefault();
    event.stopPropagation();
 
    const currentPosition = currentTime / duration;
    const newPosition = currentPosition + increment / duration;
    console.log(`[WaveformScrubber] Keyboard seek: newPosition = ${newPosition.toFixed(3)}`);
 
    onScrub(newPosition);
  };
 
  return (
    <div
      ref={refMerger(waveformRef, ref)}
      className="WaveformScrubber"
      style={{ backgroundColor: 'rgba(255,0,0,0.1)' }} // 👈 temporary highlight to ensure it’s clickable
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="slider"
      aria-label={i18n('icu:MessageAudio--slider')}
      aria-orientation="horizontal"
      aria-valuenow={currentTime}
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuetext={durationToPlaybackText(currentTime)}
    >
      <Waveform
        peaks={peaks}
        barMinHeight={barMinHeight}
        barMaxHeight={barMaxHeight}
        currentTime={currentTime}
        duration={duration}
      />
    </div>
  );
});
