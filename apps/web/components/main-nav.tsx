'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/', label: 'ホーム' },
  { href: '/manage', label: '管理室' },
  { href: '/reports', label: '日報' },
  { href: '/settings', label: '設定' },
] as const

export function MainNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const toggleMenu = () => {
    setOpen((prev) => !prev)
  }

  const renderLinks = (isMobile: boolean) =>
    NAV_ITEMS.map((item) => {
      const active = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href))

      return (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'rounded px-3 py-2 text-sm font-medium transition-colors',
            active ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
          )}
          onClick={isMobile ? () => setOpen(false) : undefined}
        >
          <span className="block">{item.label}</span>
        </Link>
      )
    })

  return (
    <div className="w-full border-b bg-background md:w-60 md:border-b-0 md:border-r md:bg-muted/30">
      <div className="flex items-center justify-between px-4 py-3 md:hidden">
        <span className="text-base font-semibold">メニュー</span>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={toggleMenu}
          aria-expanded={open}
          aria-controls="main-nav-mobile"
        >
          {open ? '閉じる' : '開く'}
        </Button>
      </div>
      {open && (
        <nav
          id="main-nav-mobile"
          className="grid gap-1 px-4 pb-4 md:hidden"
          aria-label="メインメニュー"
        >
          {renderLinks(true)}
        </nav>
      )}
      <nav className="hidden h-full flex-col gap-1 px-4 py-6 md:flex" aria-label="メインメニュー">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">主要画面</span>
        <div className="mt-3 flex flex-col gap-1">{renderLinks(false)}</div>
      </nav>
    </div>
  )
}
