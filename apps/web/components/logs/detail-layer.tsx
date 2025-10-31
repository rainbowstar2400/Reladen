'use client'

import { Suspense } from 'react'
import DetailLayerInner from './detail-layer.inner'

export default function DetailLayer() {
  return <Suspense fallback={null}><DetailLayerInner /></Suspense>
}
