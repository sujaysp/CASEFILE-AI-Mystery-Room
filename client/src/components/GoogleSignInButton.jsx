
import { useEffect, useRef } from "react";

const GOOGLE_IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client";

let initializedClientId = null;
let activeHandlersRef = null;

/**
 * Renders Google's official Sign in with Google button.
 * The browser receives an ID token; the backend verifies it
 * before issuing CASEFILE's JWT.
 */
export default function GoogleSignInButton({
  clientId,
  onCredential,
  onError,
}) {
  const containerRef = useRef(null);
  const handlersRef = useRef({ onCredential, onError });

  useEffect(() => {
    handlersRef.current = { onCredential, onError };
  }, [onCredential, onError]);

  useEffect(() => {
    if (!clientId || !containerRef.current) {
      return undefined;
    }

    let active = true;
    const container = containerRef.current;

    let script = document.querySelector(
      `script[src="${GOOGLE_IDENTITY_SCRIPT}"]`
    );

    const renderGoogleButton = () => {
      if (!active || !window.google?.accounts?.id) {
        return;
      }

      try {
        activeHandlersRef = handlersRef;

        // Initialize Google Identity Services once per client ID.
        if (initializedClientId !== clientId) {
          window.google.accounts.id.initialize({
            client_id: clientId,

            callback: (response) => {
              const handlers = activeHandlersRef?.current;

              if (response?.credential) {
                handlers?.onCredential?.(response.credential);
              } else {
                handlers?.onError?.();
              }
            },

            cancel_on_tap_outside: true,
            use_fedcm_for_prompt: true,
          });

          initializedClientId = clientId;
        }

        container.replaceChildren();

        const availableWidth = Math.floor(
          container.getBoundingClientRect().width || 360
        );

        window.google.accounts.id.renderButton(container, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: Math.min(360, Math.max(220, availableWidth)),
        });
      } catch (error) {
        console.error(
          "Google Identity Services could not initialize:",
          error
        );

        handlersRef.current.onError?.();
      }
    };

    const handleScriptError = () => {
      if (active) {
        handlersRef.current.onError?.();
      }
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
    } else {
      if (!script) {
        script = document.createElement("script");
        script.src = GOOGLE_IDENTITY_SCRIPT;
        script.async = true;
        script.defer = true;
        script.dataset.casefileGoogleIdentity = "true";

        document.head.appendChild(script);
      }

      script.addEventListener("load", renderGoogleButton);
      script.addEventListener("error", handleScriptError);

      if (script.dataset.loaded === "true") {
        renderGoogleButton();
      }

      script.addEventListener(
        "load",
        () => {
          script.dataset.loaded = "true";
        },
        { once: true }
      );
    }

    return () => {
      active = false;

      script?.removeEventListener("load", renderGoogleButton);
      script?.removeEventListener("error", handleScriptError);

      if (activeHandlersRef === handlersRef) {
        activeHandlersRef = null;
      }

      container.replaceChildren();
    };
  }, [clientId]);

  return (
    <div
      className="google-button-container"
      ref={containerRef}
    />
  );
}
