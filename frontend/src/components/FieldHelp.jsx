/**
 * FieldHelp — Contextual tooltip trigger (FR-TTIP-1 – FR-TTIP-4)
 *
 * Renders an ℹ icon button next to a field label. When hovered or focused
 * the tooltip text appears via Bootstrap 5's Tooltip plugin. A
 * visually-hidden <span role="tooltip"> element is always present in the DOM
 * so screen readers can announce the description via aria-describedby.
 *
 * Usage:
 *   <label htmlFor="myField">
 *     My Field <FieldHelp text={TOOLTIPS.namespace.fieldName} />
 *   </label>
 *
 * Props:
 *   text       {string}  Required. Plain-text tooltip content (no HTML).
 *   id         {string}  Optional. Explicit ID for the hidden span.
 *   placement  {string}  Optional. 'top' | 'bottom' | 'left' | 'right'.
 *                        Defaults to 'top'.
 */

import { useEffect, useRef, useId } from "react";
import { Tooltip } from "bootstrap";

export default function FieldHelp({ text, id: idProp, placement = "top" }) {
  const generatedId = useId();
  const tooltipId = idProp ?? `fh-${generatedId}`;
  const btnRef = useRef(null);

  useEffect(() => {
    if (!btnRef.current) return;

    const instance = new Tooltip(btnRef.current, {
      title: text,
      placement,
      trigger: "hover focus",
      html: false,
    });

    return () => {
      instance.dispose();
    };
  }, [text, placement]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="field-help-btn btn btn-link p-0 ms-1 border-0"
        aria-label="Help"
        aria-describedby={tooltipId}
        tabIndex={0}
      >
        <i className="bi bi-info-circle" aria-hidden="true" />
      </button>
      {/* Always-present text for screen readers */}
      <span id={tooltipId} role="tooltip" className="visually-hidden">
        {text}
      </span>
    </>
  );
}
