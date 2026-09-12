// Les modules de src/ utilisent des imports sans extension (style bundler).
// Ce hook les résout pour Node, afin de tester la logique sans build.
import { existsSync } from 'node:fs'

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
    try {
      if (existsSync(new URL(specifier + '.js', context.parentURL))) return next(specifier + '.js', context)
    } catch {
      /* spécificateur non résolvable en URL : on laisse Node décider */
    }
  }
  return next(specifier, context)
}
