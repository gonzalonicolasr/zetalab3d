/* ============================================================================
   ZETALAB Enhanced Animation System
   Advanced micro-interactions, transitions, and visual feedback
   ============================================================================ */

class EnhancedAnimationSystem {
  constructor() {
    this.init();
  }

  init() {
    this.setupIntersectionObserver();
    this.setupFormAnimations();
    this.setupButtonEffects();
    this.setupCardAnimations();
    this.setupLoadingAnimations();
    this.setupHoverEffects();
    this.setupFocusEffects();
    this.setupScrollEffects();
    this.setupParallaxEffects();
  }

  // Intersection Observer for reveal animations
  setupIntersectionObserver() {
    if (!('IntersectionObserver' in window)) return;

    const options = {
      root: null,
      rootMargin: '0px 0px -50px 0px',
      threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          observer.unobserve(entry.target);
        }
      });
    }, options);

    // Observe cards, tiles, and form sections
    document.querySelectorAll('.card, .tile, section').forEach(el => {
      observer.observe(el);
    });
  }

  // Enhanced form animations
  setupFormAnimations() {
    const inputs = document.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      // Label animation on focus
      input.addEventListener('focus', (e) => {
        const label = this.findLabel(e.target);
        if (label) {
          label.classList.add('focused');
          this.animateLabel(label);
        }
        this.animateInputFocus(e.target);
      });

      input.addEventListener('blur', (e) => {
        const label = this.findLabel(e.target);
        if (label && !e.target.value) {
          label.classList.remove('focused');
        }
        this.animateInputBlur(e.target);
      });

      // Value change animations
      input.addEventListener('input', (e) => {
        this.animateInputChange(e.target);
      });

      // Validation state animations
      input.addEventListener('invalid', (e) => {
        this.animateValidationError(e.target);
      });
    });
  }

  // Advanced button effects
  setupButtonEffects() {
    const buttons = document.querySelectorAll('button');
    
    buttons.forEach(button => {
      // Ripple effect
      button.addEventListener('click', (e) => {
        this.createRippleEffect(e);
      });

      // Advanced hover effects
      button.addEventListener('mouseenter', (e) => {
        this.enhancedButtonHover(e.target, true);
      });

      button.addEventListener('mouseleave', (e) => {
        this.enhancedButtonHover(e.target, false);
      });

      // Success animation for primary buttons
      if (button.classList.contains('primary')) {
        button.addEventListener('click', (e) => {
          this.animatePrimaryClick(e.target);
        });
      }
    });
  }

  // Card interaction animations
  setupCardAnimations() {
    const cards = document.querySelectorAll('.card');
    
    cards.forEach((card, index) => {
      // Staggered entrance animation
      card.style.animationDelay = `${index * 0.1}s`;

      // Enhanced hover effects
      card.addEventListener('mouseenter', () => {
        this.animateCardHover(card, true);
      });

      card.addEventListener('mouseleave', () => {
        this.animateCardHover(card, false);
      });

      // Tilt effect based on mouse position
      card.addEventListener('mousemove', (e) => {
        this.animateCardTilt(card, e);
      });
    });
  }

  // Loading state animations
  setupLoadingAnimations() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1 && node.classList?.contains('loading')) {
            this.animateLoadingStart(node);
          }
        });

        mutation.removedNodes.forEach((node) => {
          if (node.nodeType === 1 && node.classList?.contains('loading')) {
            this.animateLoadingEnd(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  // Enhanced hover effects for various elements
  setupHoverEffects() {
    // Pills
    document.querySelectorAll('.pill').forEach(pill => {
      pill.addEventListener('mouseenter', () => {
        this.animatePillHover(pill, true);
      });
      pill.addEventListener('mouseleave', () => {
        this.animatePillHover(pill, false);
      });
    });

    // Tiles
    document.querySelectorAll('.tile').forEach(tile => {
      tile.addEventListener('mouseenter', () => {
        this.animateTileHover(tile, true);
      });
      tile.addEventListener('mouseleave', () => {
        this.animateTileHover(tile, false);
      });
    });
  }

  // Focus management system
  setupFocusEffects() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        document.body.classList.add('keyboard-navigation');
      }
    });

    document.addEventListener('mousedown', () => {
      document.body.classList.remove('keyboard-navigation');
    });

    // Enhanced focus indicators
    const focusableElements = document.querySelectorAll('input, button, select, textarea, [tabindex]');
    focusableElements.forEach(el => {
      el.addEventListener('focus', () => {
        this.animateFocusIn(el);
      });
      el.addEventListener('blur', () => {
        this.animateFocusOut(el);
      });
    });
  }

  // Scroll-based animations
  setupScrollEffects() {
    let ticking = false;

    const updateScrollEffects = () => {
      const scrollY = window.scrollY;
      const header = document.querySelector('header');
      
      if (header) {
        const opacity = Math.max(0.95, 1 - scrollY / 200);
        const blur = Math.min(20, scrollY / 10);
        header.style.backgroundColor = `rgba(14, 27, 23, ${opacity})`;
        header.style.backdropFilter = `blur(${blur}px) saturate(1.2)`;
      }

      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateScrollEffects);
        ticking = true;
      }
    });
  }

  // Subtle parallax effects
  setupParallaxEffects() {
    const parallaxElements = document.querySelectorAll('.card, .tile');
    let ticking = false;

    const updateParallax = () => {
      const scrollY = window.scrollY;
      
      parallaxElements.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        const speed = 0.02 + (index % 3) * 0.01;
        const yPos = -(scrollY * speed);
        el.style.transform = `translate3d(0, ${yPos}px, 0)`;
      });

      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    });
  }

  // Helper methods
  findLabel(input) {
    const id = input.id;
    return id ? document.querySelector(`label[for="${id}"]`) : input.previousElementSibling?.tagName === 'LABEL' ? input.previousElementSibling : null;
  }

  animateLabel(label) {
    label.style.transform = 'translateX(2px) scale(1.02)';
    label.style.color = 'var(--terminal-emerald)';
  }

  animateInputFocus(input) {
    input.style.transform = 'translateY(-2px) scale(1.01)';
    input.classList.add('input-focused');
  }

  animateInputBlur(input) {
    input.style.transform = '';
    input.classList.remove('input-focused');
  }

  animateInputChange(input) {
    input.classList.add('input-changed');
    setTimeout(() => input.classList.remove('input-changed'), 300);
  }

  animateValidationError(input) {
    input.classList.add('error-shake');
    setTimeout(() => input.classList.remove('error-shake'), 500);
  }

  createRippleEffect(e) {
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    const ripple = document.createElement('div');
    ripple.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      left: ${x}px;
      top: ${y}px;
      background: radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%);
      border-radius: 50%;
      transform: scale(0);
      animation: ripple 0.6s ease-out;
      pointer-events: none;
      z-index: 1;
    `;

    button.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }

  enhancedButtonHover(button, isHover) {
    if (isHover) {
      button.style.filter = 'brightness(1.1) contrast(1.05)';
      button.style.textShadow = '0 0 8px rgba(79, 154, 101, 0.3)';
    } else {
      button.style.filter = '';
      button.style.textShadow = '';
    }
  }

  animatePrimaryClick(button) {
    button.classList.add('success-flash');
    setTimeout(() => button.classList.remove('success-flash'), 600);
  }

  animateCardHover(card, isHover) {
    const before = card.querySelector('::before');
    if (isHover) {
      card.style.filter = 'brightness(1.02) contrast(1.05)';
    } else {
      card.style.filter = '';
    }
  }

  animateCardTilt(card, e) {
    const rect = card.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = (e.clientX - centerX) / rect.width;
    const deltaY = (e.clientY - centerY) / rect.height;

    const tiltX = deltaY * 2;
    const tiltY = deltaX * -2;

    card.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-6px) scale(1.02)`;
  }

  animateLoadingStart(element) {
    element.style.filter = 'blur(0.5px) brightness(0.9)';
    element.style.transform = 'scale(0.98)';
  }

  animateLoadingEnd(element) {
    element.style.filter = '';
    element.style.transform = '';
    element.classList.add('success-flash');
    setTimeout(() => element.classList.remove('success-flash'), 600);
  }

  animatePillHover(pill, isHover) {
    if (isHover) {
      pill.style.textShadow = '0 0 8px rgba(79, 154, 101, 0.4)';
      pill.style.filter = 'brightness(1.05)';
    } else {
      pill.style.textShadow = '';
      pill.style.filter = '';
    }
  }

  animateTileHover(tile, isHover) {
    const h3 = tile.querySelector('h3');
    const p = tile.querySelector('p');

    if (isHover) {
      if (h3) h3.style.color = 'var(--terminal-green)';
      if (p) {
        p.style.transform = 'scale(1.05)';
        p.style.textShadow = '0 2px 4px rgba(79, 154, 101, 0.2)';
      }
    } else {
      if (h3) h3.style.color = '';
      if (p) {
        p.style.transform = '';
        p.style.textShadow = '';
      }
    }
  }

  animateFocusIn(element) {
    element.style.boxShadow = '0 0 0 3px rgba(79, 154, 101, 0.4), 0 0 20px rgba(79, 154, 101, 0.2)';
    element.style.transform = 'translateY(-1px) scale(1.01)';
  }

  animateFocusOut(element) {
    element.style.boxShadow = '';
    element.style.transform = '';
  }

  // Public API methods
  pulseElement(selector) {
    const element = document.querySelector(selector);
    if (element) {
      element.classList.add('bounce-attention');
      setTimeout(() => element.classList.remove('bounce-attention'), 1000);
    }
  }

  highlightElement(selector) {
    const element = document.querySelector(selector);
    if (element) {
      element.classList.add('highlight-flash');
      setTimeout(() => element.classList.remove('highlight-flash'), 1000);
    }
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 24px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-primary);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      font-family: inherit;
      font-size: var(--text-sm);
      box-shadow: var(--shadow-lg);
      z-index: 10000;
      transform: translateX(100%);
      transition: transform var(--duration-slow) var(--ease-out);
    `;

    if (type === 'success') {
      notification.style.borderColor = 'var(--terminal-emerald)';
      notification.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
    } else if (type === 'error') {
      notification.style.borderColor = 'var(--text-error)';
      notification.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
    }

    document.body.appendChild(notification);

    // Animate in
    requestAnimationFrame(() => {
      notification.style.transform = 'translateX(0)';
    });

    // Auto remove
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

// CSS for additional animations
const additionalStyles = `
/* Enhanced Animation Classes */
.animate-in {
  animation: slideInFromBottom 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@keyframes slideInFromBottom {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes ripple {
  to {
    transform: scale(4);
    opacity: 0;
  }
}

.input-changed {
  animation: inputChange 0.3s ease-out;
}

@keyframes inputChange {
  0% { background-color: rgba(79, 154, 101, 0.1); }
  100% { background-color: transparent; }
}

.keyboard-navigation *:focus {
  outline: 2px solid var(--terminal-emerald);
  outline-offset: 2px;
}

/* Smooth scrolling for better UX */
html {
  scroll-behavior: smooth;
}

/* Enhanced transitions for reduced motion users */
@media (prefers-reduced-motion: reduce) {
  .animate-in {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
`;

// Inject additional styles
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);

// Initialize the animation system when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.enhancedAnimations = new EnhancedAnimationSystem();
  });
} else {
  window.enhancedAnimations = new EnhancedAnimationSystem();
}

// Export for use in other modules
window.EnhancedAnimationSystem = EnhancedAnimationSystem;