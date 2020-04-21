import { useEffect, useRef, useState, SetStateAction } from "react";

export const useSafeSetState = <T>(val: T) => {
  const isMountedRef = useRef(false);
  const [value, setValue] = useState(val);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeSetValue = (newValue: SetStateAction<T>) => {
    if (!isMountedRef.current) return;
    if (value === newValue) return;
    setValue(newValue);
  };

  return [value, safeSetValue];
};
