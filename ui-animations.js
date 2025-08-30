/**
 * ZETALAB UI Animation Enhancements
 * Adds micro-interactions and smooth animations to improve UX
 */

(function() {
  'use strict';

  // Animation utilities
  const AnimationUtils = {
    // Add ripple effect to buttons
    addRippleEffect(button, event) {
      const rect = button.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = event.clientX - rect.left - size / 2;
      const y = event.clientY - rect.top - size / 2;
      
      const ripple = document.createElement('span');
      ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        background: radial-gradient(circle, rgba(79, 154, 101, 0.6) 0%, transparent 70%);
        border-radius: 50%;
        transform: scale(0);
        animation: rippleAnimation 0.6s ease-out;
        pointer-events: none;
        z-index: 1;
      `;
      
      // Add ripple animation keyframes if not exists
      if (!document.querySelector('#ripple-styles')) {
        const style = document.createElement('style');
        style.id = 'ripple-styles';
        style.textContent = `
          @keyframes rippleAnimation {
            to {
              transform: scale(4);
              opacity: 0;
            }
          }
        `;
        document.head.appendChild(style);
      }
      
      button.style.position = 'relative';
      button.style.overflow = 'hidden';
      button.appendChild(ripple);
      
      setTimeout(() => ripple.remove(), 600);
    },

    // Smooth scroll with easing
    smoothScrollTo(element, duration = 500) {
      const startPosition = window.pageYOffset;
      const targetPosition = element.offsetTop - 100;
      const distance = targetPosition - startPosition;
      let startTime = null;

      function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
      }

      function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const progress = Math.min(timeElapsed / duration, 1);
        
        window.scrollTo(0, startPosition + distance * easeInOutCubic(progress));
        
        if (progress < 1) {
          requestAnimationFrame(animation);
        }
      }

      requestAnimationFrame(animation);
    },

    // Add floating animation to elements
    addFloatingAnimation(element, delay = 0) {
      element.style.animationDelay = `${delay}s`;
      element.classList.add('float');
    },

    // Stagger animation for multiple elements
    staggerAnimation(elements, animationClass, delay = 100) {
      elements.forEach((el, index) => {
        setTimeout(() => {
          el.classList.add(animationClass);
        }, index * delay);
      });
    }
  };

  // Initialize when DOM is ready
  function initializeAnimations() {
    // Add ripple effects to all buttons
    document.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') {
        AnimationUtils.addRippleEffect(e.target, e);
      }
    });

    // Add focus enhancement for inputs
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      input.addEventListener('focus', () => {
        const label = document.querySelector(`label[for="${input.id}"]`) || 
                     input.parentElement.querySelector('label');
        if (label) {
          label.classList.add('focused');
        }
        input.parentElement?.classList.add('input-focused');
      });

      input.addEventListener('blur', () => {
        const label = document.querySelector(`label[for="${input.id}"]`) || 
                     input.parentElement.querySelector('label');
        if (label) {
          label.classList.remove('focused');
        }
        input.parentElement?.classList.remove('input-focused');
      });

      // Add success animation for valid inputs
      input.addEventListener('input', () => {
        if (input.validity.valid && input.value.length > 0) {
          input.classList.remove('error-shake');
          input.classList.add('success-flash');
          setTimeout(() => input.classList.remove('success-flash'), 600);
        }
      });
    });

    // Enhance card entrance animations
    const cards = document.querySelectorAll('.card');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    cards.forEach(card => observer.observe(card));

    // Add hover effects to tiles
    document.querySelectorAll('.tile').forEach((tile, index) => {
      tile.style.animationDelay = `${index * 0.1}s`;
      
      tile.addEventListener('mouseenter', () => {
        tile.classList.add('bounce-attention');
      });
      
      tile.addEventListener('animationend', () => {
        tile.classList.remove('bounce-attention');
      });
    });

    // Enhanced loading states
    const loadingManager = {
      show(element) {
        element.classList.add('loading');
        element.style.pointerEvents = 'none';
      },
      
      hide(element) {
        element.classList.remove('loading');
        element.style.pointerEvents = '';
        element.classList.add('success-flash');
        setTimeout(() => element.classList.remove('success-flash'), 600);
      },
      
      error(element) {
        element.classList.remove('loading');
        element.style.pointerEvents = '';
        element.classList.add('error-shake');
        setTimeout(() => element.classList.remove('error-shake'), 500);
      }
    };

    // Expose loading manager globally
    window.LoadingManager = loadingManager;

    // Add smooth transitions for navigation
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
          AnimationUtils.smoothScrollTo(target);
        }
      });
    });

    // Add typing effect to terminal cursor elements
    document.querySelectorAll('.terminal-cursor').forEach(element => {
      element.style.borderRight = '2px solid var(--terminal-green)';
      element.style.paddingRight = '2px';
    });

    // Progressive enhancement for auth bar
    const authBar = document.getElementById('auth-bar');
    if (authBar) {
      // Add subtle breathing animation when idle
      let idleTimer;
      const resetIdleTimer = () => {
        clearTimeout(idleTimer);
        authBar.classList.remove('idle-pulse');
        idleTimer = setTimeout(() => {
          authBar.classList.add('idle-pulse');
        }, 30000); // 30 seconds of inactivity
      };

      document.addEventListener('mousemove', resetIdleTimer);
      document.addEventListener('keypress', resetIdleTimer);
      resetIdleTimer();
    }

    console.log('🎨 ZETALAB UI Animations initialized');
  }

  // Wait for DOM content to be loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAnimations);
  } else {
    initializeAnimations();
  }

})();