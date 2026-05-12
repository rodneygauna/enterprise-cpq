import { useState, useEffect } from "react";

/**
 * Reusable animated offcanvas drawer (slide-in from the right).
 *
 * Props:
 *   open     {boolean}  - controls visibility; the component manages its own
 *                         mount/unmount and the CSS enter/exit animation.
 *   title    {string}   - heading text and accessible dialog label.
 *   onClose  {function} - called when the close button or backdrop is clicked.
 *   width    {string}   - CSS width string (default: "min(520px, 95vw)").
 *   children {node}     - drawer body content.
 */
export default function OffcanvasDrawer({
  open,
  title,
  onClose,
  width = "min(520px, 95vw)",
  children,
}) {
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setShow(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setShow(false);
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!mounted) return null;

  return (
    <>
      <div
        className={`offcanvas-backdrop fade${show ? " show" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`offcanvas offcanvas-end${show ? " show" : ""}`}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ width, visibility: "visible" }}
      >
        <div className="offcanvas-header border-bottom cpq-glass">
          <h2 className="offcanvas-title h5">{title}</h2>
          <button
            type="button"
            className="btn-close"
            aria-label={`Close ${title}`}
            onClick={onClose}
          />
        </div>
        <div className="offcanvas-body">{children}</div>
      </div>
    </>
  );
}
