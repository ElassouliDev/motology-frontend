import Image from 'next/image'
import { Icon } from '@/components/ui/Icon'
import { safeImageUrl } from '@/lib/format'
import { cn } from '@/lib/utils'

interface Props {
  src: string | null
  alt: string
  className?: string
  imageClassName?: string
  sizes: string
  priority?: boolean
}

/**
 * Inventory photos come from arbitrary dealer/CDN hosts, so they are served
 * unoptimised (no allow-list of remote hosts to maintain, no image proxy).
 */
export function VehicleImage({ src, alt, className, imageClassName, sizes, priority = false }: Props) {
  const url = safeImageUrl(src)
  return (
    <div className={cn('relative overflow-hidden bg-surface-2', className)}>
      {url ? (
        <Image
          src={url}
          alt={alt}
          fill
          sizes={sizes}
          className={cn('object-cover', imageClassName)}
          unoptimized
          priority={priority}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted">
          <Icon name="car" size={28} strokeWidth={1.5} />
          <span className="text-xs">Photo coming soon</span>
        </div>
      )}
    </div>
  )
}
