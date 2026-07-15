import { useEffect, useState } from 'react';
import { isSMSAvailable } from '@/services/sms.service';

export const useSMSAvailability = (): { available: boolean | null } => {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    isSMSAvailable()
      .then((ok) => {
        if (active) setAvailable(ok);
      })
      .catch(() => {
        if (active) setAvailable(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { available };
};
