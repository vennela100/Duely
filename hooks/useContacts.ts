import { useCallback, useState } from 'react';
import {
  pickContact,
  searchContacts,
  type PickedContact,
} from '@/services/contacts.service';

export const useContactPicker = () => {
  const [picking, setPicking] = useState(false);
  const [denied, setDenied] = useState(false);

  const pick = useCallback(async (): Promise<PickedContact | null> => {
    setPicking(true);
    try {
      const result = await pickContact();
      if (!result) setDenied(true);
      else setDenied(false);
      return result;
    } finally {
      setPicking(false);
    }
  }, []);

  return { pick, picking, denied };
};

export const useContactSearch = () => {
  const [results, setResults] = useState<PickedContact[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string): Promise<PickedContact[]> => {
    setLoading(true);
    try {
      const list = await searchContacts(q);
      setResults(list);
      return list;
    } finally {
      setLoading(false);
    }
  }, []);

  return { search, results, loading };
};
