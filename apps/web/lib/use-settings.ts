'use client'
import { useEffect, useState } from 'react'

type ThemeMode = 'light'|'dark'|'system'
type FontSize = 'small'|'medium'|'large'
type Settings = {
  theme: ThemeMode
  fontSize: FontSize
  reduceMotion: boolean
  dayRollover: '00:00'|'04:00'|'05:00'|'06:00'|'07:00'|'08:00'
  syncEnabled: boolean
  contactUrl?: string
}
const KEY = 'reladen:settings:v1'
const DEF: Settings = {
  theme:'system', fontSize:'medium', reduceMotion:false,
  dayRollover:'05:00', syncEnabled:true,
}

export function useSettings(){
  const [s, setS] = useState<Settings>(DEF)
  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if(raw) setS({ ...DEF, ...JSON.parse(raw) }) } catch {}
  }, [])
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch {} }, [s])

  // apply: font scale
  useEffect(() => {
    const scale = s.fontSize==='small'?0.95 : s.fontSize==='large'?1.10 : 1
    document.documentElement.style.setProperty('--app-font-scale', String(scale))
  }, [s.fontSize])

  return { s, setS }
}
