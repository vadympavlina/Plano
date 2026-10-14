import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Opens a "create" dialog when the page is reached with ?new=1, then clears the flag. */
export function useOpenFromQuery(open: () => void) {
  const [params, setParams] = useSearchParams();
  const flag = params.get('new');
  useEffect(() => {
    if (flag === '1') {
      open();
      const p = new URLSearchParams(params);
      p.delete('new');
      setParams(p, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flag]);
}
