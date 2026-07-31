import { gsap } from 'gsap'
import { Flip } from 'gsap/Flip'

gsap.registerPlugin(Flip)

export { Flip, gsap }

export function reduceMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

export function motionDuration(value) {
  return reduceMotion() ? 0 : value
}

// Reusable, low-cost press feedback for controls owned by a component.
export function bindInteractiveMotion(root, selector = '[data-motion-control]') {
  if (!root || reduceMotion()) return () => {}

  const cleanups = []
  root.querySelectorAll(selector).forEach(control => {
    const icon = control.querySelector('[data-motion-icon], svg')
    const targets = icon ? [control, icon] : [control]
    const enter = () => {
      gsap.killTweensOf(targets)
      gsap.to(control, { scale: 1.03, filter: 'brightness(1.025)', duration: 0.18, ease: 'power2.out', overwrite: 'auto' })
      if (icon) gsap.to(icon, { rotation: 2.5, duration: 0.2, ease: 'power2.out', overwrite: 'auto' })
    }
    const leave = () => {
      gsap.to(control, { scale: 1, filter: 'brightness(1)', duration: 0.2, ease: 'power2.out', overwrite: 'auto' })
      if (icon) gsap.to(icon, { rotation: 0, duration: 0.2, ease: 'power2.out', overwrite: 'auto' })
    }
    const down = () => gsap.to(control, { scale: 0.97, duration: 0.1, ease: 'power2.out', overwrite: 'auto' })
    const up = () => gsap.to(control, { scale: 1.03, duration: 0.18, ease: 'back.out(2)', overwrite: 'auto' })

    control.addEventListener('pointerenter', enter)
    control.addEventListener('pointerleave', leave)
    control.addEventListener('pointerdown', down)
    control.addEventListener('pointerup', up)
    control.style.willChange = 'transform, filter'
    cleanups.push(() => {
      control.removeEventListener('pointerenter', enter)
      control.removeEventListener('pointerleave', leave)
      control.removeEventListener('pointerdown', down)
      control.removeEventListener('pointerup', up)
      gsap.killTweensOf(targets)
      control.style.willChange = ''
    })
  })

  return () => cleanups.forEach(cleanup => cleanup())
}

export function playRipple(target, event) {
  if (!target || reduceMotion()) return
  const rect = target.getBoundingClientRect()
  const ripple = document.createElement('span')
  ripple.className = 'motion-ripple'
  ripple.style.left = `${event.clientX - rect.left}px`
  ripple.style.top = `${event.clientY - rect.top}px`
  target.appendChild(ripple)
  gsap.fromTo(ripple, { scale: 0, autoAlpha: 0.38 }, {
    scale: 14,
    autoAlpha: 0,
    duration: 0.48,
    ease: 'power2.out',
    onComplete: () => ripple.remove()
  })
}
