'use client';

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import skyImage from '@/app/ui-demo/pre_sky.jpg';
import deskImage from '@/app/ui-demo/desk.png';

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
  const deskFadeSeconds = 0.28;

  const faceContent = useMemo(
    () => ({
      front: activeFace === 'front' ? children : null,
      right: activeFace === 'right' ? children : null,
      left: activeFace === 'left' ? children : null,
    }),
    [activeFace, children]
  );

  useEffect(() => {
    if (prevFaceRef.current !== activeFace) {
      const prevFace = prevFaceRef.current;
      const nextFace = activeFace;
      if (prevFace !== 'front' && nextFace !== 'front') {
        setOutgoingDesk({ face: prevFace, node: prevChildrenRef.current });
      } else {
        setOutgoingDesk(null);
      }
      prevFaceRef.current = activeFace;
    }
    prevChildrenRef.current = children;
  }, [activeFace, children]);

  useEffect(() => {
    if (!outgoingDesk) return;
    const timeoutId = window.setTimeout(() => {
      setOutgoingDesk(null);
    }, deskFadeSeconds * 1000);
    return () => window.clearTimeout(timeoutId);
  }, [outgoingDesk, deskFadeSeconds]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#a5b7c8] text-[#0a1b2b]">
      <div className="absolute inset-0">
        <motion.div
          className="absolute inset-0"
          animate={isDeskMode ? { y: '-110%', opacity: 0 } : { y: '0%', opacity: 1 }}
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
          animate={{ height: isDeskMode ? '100%' : '24%' }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          aria-hidden="true"
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${deskImage.src})`,
              backgroundSize: isDeskMode ? '100% 100%' : '100% auto',
              backgroundPosition: isDeskMode ? 'center center' : 'center top',
              backgroundRepeat: 'no-repeat',
            }}
          />
        </motion.div>
      </div>

      <div className="relative z-10 min-h-screen" style={isDeskMode ? undefined : { perspective: '1800px' }}>
        {isDeskMode ? (
          <div className="absolute inset-0">
            {outgoingDesk && (
              <motion.div
                key={`desk-outgoing-${outgoingDesk.face}`}
                className="absolute inset-0"
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ duration: deskFadeSeconds }}
                style={{ pointerEvents: 'none' }}
              >
                {outgoingDesk.node}
              </motion.div>
            )}
            <motion.div
              key={`desk-incoming-${activeFace}`}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: deskFadeSeconds }}
            >
              {children}
            </motion.div>
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
    </div>
  );
}
