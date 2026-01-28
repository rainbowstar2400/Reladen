'use client';

import { ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import skyImage from '@/app/ui-demo/pre_sky.jpg';
import deskImage from '@/app/ui-demo/desk.png';
import { DeskPanelVisibilityProvider } from '@/components/room/desk-panel-context';
import { DeskTransitionProvider } from '@/components/room/room-transition-context';

type RoomFace = 'front' | 'right' | 'left';

type RoomStageProps = {
  activeFace: RoomFace;
  children: ReactNode;
};

const FACE_ROTATION: Record<RoomFace, { y: number; x: number }> = {
  front: { y: 0, x: 0 },
  right: { y: -90, x: 8 },
  left: { y: 90, x: 8 },
};

const FACE_TRANSFORMS: Record<RoomFace, string> = {
  front: 'rotateY(0deg) translateZ(0px)',
  right: 'rotateY(90deg) translateZ(0px)',
  left: 'rotateY(-90deg) translateZ(0px)',
};

export function RoomStage({ activeFace, children }: RoomStageProps) {
  const rotation = FACE_ROTATION[activeFace];
  const isDeskMode = activeFace !== 'front';
  const prevFaceRef = useRef<RoomFace>(activeFace);
  const prevChildrenRef = useRef<ReactNode>(children);
  const [outgoingDesk, setOutgoingDesk] = useState<{ face: RoomFace; node: ReactNode } | null>(
    null
  );
  const deskSlideSeconds = 0.45;
  const deskContentFadeSeconds = 0.2;
  const [deskReady, setDeskReady] = useState(activeFace === 'front');
  const [deskView, setDeskView] = useState(isDeskMode);
  const [deskContentHidden, setDeskContentHidden] = useState(false);
  const preFadeRef = useRef(false);
  const prevFace = prevFaceRef.current;
  const isDeskSwitch =
    prevFace !== activeFace && prevFace !== 'front' && activeFace !== 'front';
  const outgoingSnapshot = isDeskSwitch
    ? { face: prevFace, node: prevChildrenRef.current }
    : null;
  const outgoingToRender = outgoingDesk ?? outgoingSnapshot;
  const beginDeskTransition = useCallback(() => {
    preFadeRef.current = true;
    setDeskContentHidden(true);
    return deskContentFadeSeconds * 1000;
  }, [deskContentFadeSeconds]);

  const faceContent = useMemo(
    () => ({
      front: activeFace === 'front' ? children : null,
      right: activeFace === 'right' ? children : null,
      left: activeFace === 'left' ? children : null,
    }),
    [activeFace, children]
  );

  useLayoutEffect(() => {
    const prevFace = prevFaceRef.current;
    const nextFace = activeFace;

    if (prevFace !== nextFace) {
      if (prevFace !== 'front' && nextFace !== 'front') {
        setOutgoingDesk({ face: prevFace, node: prevChildrenRef.current });
        setDeskContentHidden(true);
      } else {
        setOutgoingDesk(null);
      }

      if (prevFace === 'front' && nextFace !== 'front') {
        setDeskView(true);
        setDeskReady(false);
        if (!preFadeRef.current) {
          setDeskContentHidden(true);
        }
        const slideDelaySeconds = preFadeRef.current ? 0 : deskContentFadeSeconds;
        const timeoutId = window.setTimeout(() => {
          setDeskReady(true);
        }, slideDelaySeconds * 1000);
        const showId = window.setTimeout(() => {
          setDeskContentHidden(false);
          preFadeRef.current = false;
        }, (slideDelaySeconds + deskSlideSeconds) * 1000);
        prevChildrenRef.current = children;
        prevFaceRef.current = activeFace;
        return () => {
          window.clearTimeout(timeoutId);
          window.clearTimeout(showId);
        };
      }

      if (prevFace !== 'front' && nextFace === 'front') {
        setDeskView(false);
        setDeskReady(true);
        setDeskContentHidden(false);
        preFadeRef.current = false;
      }
    }

    prevChildrenRef.current = children;
    prevFaceRef.current = activeFace;
  }, [activeFace, children, deskContentFadeSeconds, deskSlideSeconds]);

  useEffect(() => {
    if (!outgoingDesk) return;
    const timeoutId = window.setTimeout(() => {
      setOutgoingDesk(null);
      setDeskContentHidden(false);
      preFadeRef.current = false;
    }, deskSlideSeconds * 1000);
    return () => window.clearTimeout(timeoutId);
  }, [outgoingDesk, deskSlideSeconds]);


  return (
    <div className="relative min-h-screen overflow-hidden bg-[#a5b7c8] text-[#0a1b2b]">
      <div className="absolute inset-0">
        <motion.div
          className="absolute inset-0"
          animate={deskView ? { y: '-110%', opacity: 0 } : { y: '0%', opacity: 1 }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${skyImage.src})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
            aria-hidden="true"
          />
          <div className="pointer-events-none absolute left-0 top-0 bottom-[24%] w-12 bg-[linear-gradient(180deg,rgba(13,33,54,0.32),rgba(13,33,54,0.22)),linear-gradient(90deg,rgba(255,255,255,0.5),rgba(255,255,255,0))] shadow-[inset_0_0_0_2px_rgba(13,33,54,0.5),inset_0_0_18px_rgba(8,20,34,0.35)]" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-[24%] w-12 bg-[linear-gradient(180deg,rgba(13,33,54,0.32),rgba(13,33,54,0.22)),linear-gradient(90deg,rgba(255,255,255,0.5),rgba(255,255,255,0))] shadow-[inset_0_0_0_2px_rgba(13,33,54,0.5),inset_0_0_18px_rgba(8,20,34,0.35)] scale-x-[-1]" />
          <div
            className="absolute inset-x-0 bottom-[24%] h-[6%] bg-[linear-gradient(to_top,rgba(0,0,0,0.26),rgba(0,0,0,0))] opacity-40"
            aria-hidden="true"
          />
        </motion.div>

        <motion.div
          className="absolute inset-x-0 bottom-0 overflow-hidden"
          animate={{ height: deskView ? '100%' : '24%' }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          aria-hidden="true"
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${deskImage.src})`,
              backgroundSize: deskView ? '100% 100%' : '100% auto',
              backgroundPosition: deskView ? 'center center' : 'center top',
              backgroundRepeat: 'no-repeat',
            }}
          />
        </motion.div>
      </div>

      <DeskTransitionProvider beginDeskTransition={beginDeskTransition}>
        <div className="relative z-10 min-h-screen" style={isDeskMode ? undefined : { perspective: '1800px' }}>
        {isDeskMode ? (
          <div className="absolute inset-0 overflow-hidden">
            {outgoingToRender && (
              <motion.div
                key={`desk-outgoing-${outgoingToRender.face}`}
                className="absolute inset-0"
                initial={{ x: 0 }}
                animate={{ x: outgoingToRender.face === 'right' ? '100%' : '-100%' }}
                transition={{ duration: deskSlideSeconds, ease: 'easeInOut' }}
                style={{ pointerEvents: 'none' }}
              >
                <DeskPanelVisibilityProvider visible={!deskContentHidden}>
                  {outgoingToRender.node}
                </DeskPanelVisibilityProvider>
              </motion.div>
            )}
            {deskReady && (
              <motion.div
                key={`desk-incoming-${activeFace}`}
                className="absolute inset-0"
                initial={{ x: activeFace === 'right' ? '100%' : '-100%' }}
                animate={{ x: 0 }}
                transition={{ duration: deskSlideSeconds, ease: 'easeOut' }}
              >
                <DeskPanelVisibilityProvider visible={!deskContentHidden}>
                  {children}
                </DeskPanelVisibilityProvider>
              </motion.div>
            )}
          </div>
        ) : (
          <motion.div
            className="absolute inset-0"
            animate={{ rotateY: rotation.y, rotateX: rotation.x }}
            transition={{ type: 'spring', stiffness: 140, damping: 22 }}
            style={{ transformStyle: 'preserve-3d' }}
          >
            <div
              className="absolute inset-0"
              style={{
                transform: FACE_TRANSFORMS.front,
                backfaceVisibility: 'hidden',
                transformStyle: 'preserve-3d',
                pointerEvents: 'auto',
              }}
            >
              {faceContent.front}
            </div>
            <div
              className="absolute inset-0"
              style={{
                transform: FACE_TRANSFORMS.right,
                backfaceVisibility: 'hidden',
                transformStyle: 'preserve-3d',
                pointerEvents: 'none',
              }}
            >
              {faceContent.right}
            </div>
            <div
              className="absolute inset-0"
              style={{
                transform: FACE_TRANSFORMS.left,
                backfaceVisibility: 'hidden',
                transformStyle: 'preserve-3d',
                pointerEvents: 'none',
              }}
            >
              {faceContent.left}
            </div>
          </motion.div>
        )}
        </div>
      </DeskTransitionProvider>
    </div>
  );
}
