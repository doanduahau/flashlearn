import { useEffect, useRef, useState } from "react";

export function useVisibilityPause(initialPaused = false) {
  const [isPaused, setIsPaused] = useState(initialPaused);
  const wasPausedByVisibilityRef = useRef(false);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) {
        setIsPaused((prev) => {
          if (!prev) {
            wasPausedByVisibilityRef.current = true;
            return true;
          }
          return prev;
        });
      } else {
        if (wasPausedByVisibilityRef.current) {
          setIsPaused(false);
          wasPausedByVisibilityRef.current = false;
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const resume = () => {
    setIsPaused(false);
    wasPausedByVisibilityRef.current = false;
  };

  const pause = () => {
    setIsPaused(true);
    wasPausedByVisibilityRef.current = false;
  };

  return { isPaused, resume, pause };
}
