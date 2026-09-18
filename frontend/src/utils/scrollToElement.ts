export function scrollToElement(id: string, offset: number = 80) {
  const element = document.getElementById(id);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (element) {
    const mainContent = document.querySelector('main');
    
    if (mainContent) {
      // If we are scrolling inside a container with overflow-y-auto
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + mainContent.scrollTop - offset;
      
      mainContent.scrollTo({
        top: offsetPosition,
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
    } else {
      // Fallback for window scrolling
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - offset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
    }
  }
}
