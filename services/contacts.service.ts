// SDK 56 deprecated the function API on 'expo-contacts'; the legacy entrypoint keeps
// presentContactPickerAsync / getContactsAsync working without migrating to the class API.
import * as Contacts from 'expo-contacts/legacy';
import { normalizePhone } from '@/utils/format';

export interface PickedContact {
  name: string;
  phone: string;
  phoneRaw: string;
  photo?: string;
}

const cleanPhone = (raw: string): string => raw.replace(/[\s\-()]/g, '');

export const requestContactsPermission = async (): Promise<boolean> => {
  const { status } = await Contacts.requestPermissionsAsync();
  return status === 'granted';
};

export const pickContact = async (): Promise<PickedContact | null> => {
  const granted = await requestContactsPermission();
  if (!granted) return null;
  const contact = await Contacts.presentContactPickerAsync();
  if (!contact) return null;
  const rawPhone = contact.phoneNumbers?.[0]?.number || '';
  const phoneRaw = cleanPhone(rawPhone);
  return {
    name: contact.name || '',
    phone: normalizePhone(phoneRaw),
    phoneRaw,
    photo: contact.image?.uri,
  };
};

export const searchContacts = async (query: string): Promise<PickedContact[]> => {
  const granted = await requestContactsPermission();
  if (!granted) return [];
  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Image],
    name: query,
  });
  return data
    .filter((c) => c.phoneNumbers && c.phoneNumbers.length > 0)
    .map((c) => {
      const rawPhone = c.phoneNumbers?.[0]?.number || '';
      const phoneRaw = cleanPhone(rawPhone);
      return {
        name: c.name || '',
        phone: normalizePhone(phoneRaw),
        phoneRaw,
        photo: c.image?.uri,
      };
    });
};
