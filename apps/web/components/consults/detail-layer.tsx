// apps/web/components/consults/detail-layer.tsx
'use client'

import { Suspense } from 'react'
import ConsultDetailLayerInner from './detail-layer.inner'

export default function ConsultDetailLayer() {
  return <Suspense fallback={null}><ConsultDetailLayerInner /></Suspense>
}
