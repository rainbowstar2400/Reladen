'use client';

import { ReactNode, useMemo } from 'react';
import { motion } from 'framer-motion';
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

  const faceContent = useMemo(
    () => ({
      front: activeFace === 'front' ? children : null,
      right: activeFace === 'right' ? children : null,
      left: activeFace === 'left' ? children : null,
    }),
    [activeFace, children]
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#a5b7c8] text-[#0a1b2b]">
      <div
        className="absolute inset-0"
        style={{ backgroundImage: `url(${skyImage.src})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[24%]"
        style={{ backgroundImage: `url(${deskImage.src})`, backgroundSize: 'cover', backgroundPosition: 'center bottom' }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-x-0 bottom-[24%] h-[6%] bg-[linear-gradient(to_top,rgba(0,0,0,0.26),rgba(0,0,0,0))] opacity-40"
        aria-hidden="true"
      />

      <div className="pointer-events-none absolute left-0 top-0 bottom-[24%] w-12 bg-[linear-gradient(180deg,rgba(13,33,54,0.32),rgba(13,33,54,0.22)),linear-gradient(90deg,rgba(255,255,255,0.5),rgba(255,255,255,0))] shadow-[inset_0_0_0_2px_rgba(13,33,54,0.5),inset_0_0_18px_rgba(8,20,34,0.35)]" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-[24%] w-12 bg-[linear-gradient(180deg,rgba(13,33,54,0.32),rgba(13,33,54,0.22)),linear-gradient(90deg,rgba(255,255,255,0.5),rgba(255,255,255,0))] shadow-[inset_0_0_0_2px_rgba(13,33,54,0.5),inset_0_0_18px_rgba(8,20,34,0.35)] scale-x-[-1]" />

      <div className="relative z-10 min-h-screen" style={{ perspective: '1800px' }}>
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
              pointerEvents: activeFace === 'front' ? 'auto' : 'none',
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
              pointerEvents: activeFace === 'right' ? 'auto' : 'none',
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
              pointerEvents: activeFace === 'left' ? 'auto' : 'none',
            }}
          >
            {faceContent.left}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
